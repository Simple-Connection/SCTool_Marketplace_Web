import argparse
import json
from pathlib import Path
import sys
import yaml
from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
POLICY_TOOLS = HERE.parent
REPO_ROOT = HERE.parents[2]
NS_ENGINE = POLICY_TOOLS / "namespace-classifier" / "engine"
if str(NS_ENGINE) not in sys.path:
    sys.path.insert(0, str(NS_ENGINE))

import classifier
from preparation import PreparationError, prepare_candidate
from normalizer import normalize_candidate
from ai_eligibility import evaluate as evaluate_ai
from ai_assist import invoke as invoke_ai
from authority_resolver import AuthorityResolutionError, resolve_many
from improvement import build_candidate

RESULT_SCHEMA = REPO_ROOT / "docs/policy/schemas/routing/routing-result.schema.yaml"

HARD_BLOCK = {
    "BOUNDARY_VIOLATION",
    "DECLARED_NAMESPACE_MISMATCH",
    "INVALID_EDGE",
    "INVALID_CLAIM",
    "UNKNOWN_DECLARED_NAMESPACE",
    "INACTIVE_DECLARED_NAMESPACE",
}

def _load_yaml(path):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))

def _validate_result(result):
    Draft202012Validator(_load_yaml(RESULT_SCHEMA)).validate(result)
    return result

def _integrity(ok, semantic_sha=None):
    value = {"compiled_registry_verified": bool(ok), "semantic_lock_verified": bool(ok)}
    if semantic_sha:
        value["semantic_sha256"] = semantic_sha
    return value

def _provenance(machine_verified=False, ai_used=False, recheck=False, rules=None, improvement=None, provider=None):
    out = {
        "machine_verified": machine_verified,
        "ai_assist_used": ai_used,
        "machine_recheck_performed": recheck,
        "normalization_rule_ids": sorted(set(rules or [])),
        "classifier_improvement_candidate": improvement is not None,
    }
    if provider:
        out["ai_provider"] = provider
    return out

def _reason_for_machine(result):
    status = result.get("status")
    if status == "CLASSIFIED":
        return "EXACT_MATCH"
    if status == "MULTI_RESPONSIBILITY":
        return "MULTI_RESPONSIBILITY"
    if status == "INCOMPLETE":
        return "CLAIMS_MISSING" if not result.get("claim_results") else "CLAIM_FIELDS_MISSING"
    if status == "UNKNOWN_SEMANTIC_TUPLE":
        return "NO_EXACT_MATCH"
    return status or "UNKNOWN_MACHINE_RESULT"

def _result(candidate_id, outcome, reasons, integrity, *, namespaces=None, primary=None, classification=None,
            authority=None, provenance=None, improvement=None):
    out = {
        "schema_version": "1.0",
        "outcome": outcome,
        "reason_codes": list(dict.fromkeys(reasons)),
        "namespaces": namespaces or [],
        "primary_namespace": primary,
        "authority_resolution": authority or {},
        "provenance": provenance or _provenance(),
        "integrity": integrity,
    }
    if candidate_id:
        out["candidate_id"] = candidate_id
    if classification is not None:
        out["classification"] = classification
    if improvement is not None:
        out["improvement_candidate"] = improvement
    return _validate_result(out)

def _authority(namespaces):
    try:
        return resolve_many(namespaces), None
    except AuthorityResolutionError as exc:
        return {}, str(exc).split(":", 1)[0]

def route_candidate(candidate, *, ai_provider=None, ai_command=None, enable_ai=True):
    candidate_id = candidate.get("candidate_id") if isinstance(candidate, dict) else None
    try:
        prepared = prepare_candidate(candidate)
    except PreparationError as exc:
        return _result(candidate_id, "BLOCKED", [exc.code], _integrity(False),
                       classification={"preparation_error": exc.details}, provenance=_provenance())

    normalized, applied_rules = normalize_candidate(prepared)
    try:
        registry = classifier.refresh_registry()
        machine = classifier.classify_policy(normalized)
    except RuntimeError as exc:
        return _result(candidate_id, "BLOCKED", [str(exc)], _integrity(False),
                       classification={"status": "INTEGRITY_FAILURE"},
                       provenance=_provenance(rules=applied_rules))

    integrity = _integrity(True, registry.get("semantic_sha256"))
    status = machine.get("status")
    namespaces = machine.get("namespaces", [])
    primary = machine.get("primary")

    if status == "CLASSIFIED":
        authority, error = _authority(namespaces)
        if error:
            return _result(candidate_id, "REVIEW_REQUIRED", [error], integrity, namespaces=namespaces, primary=primary,
                           classification=machine, authority=authority,
                           provenance=_provenance(machine_verified=True, rules=applied_rules))
        reasons = ["EXACT_MATCH"]
        if applied_rules:
            reasons.append("DETERMINISTIC_NORMALIZATION_APPLIED")
        return _result(candidate_id, "ROUTED", reasons, integrity, namespaces=namespaces, primary=primary,
                       classification=machine, authority=authority,
                       provenance=_provenance(machine_verified=True, rules=applied_rules))

    if status == "MULTI_RESPONSIBILITY":
        authority, error = _authority(namespaces)
        reasons = ["MULTI_RESPONSIBILITY"]
        if error:
            reasons.append(error)
        return _result(candidate_id, "SPLIT_REQUIRED", reasons, integrity, namespaces=namespaces,
                       classification=machine, authority=authority,
                       provenance=_provenance(machine_verified=True, rules=applied_rules))

    if status in HARD_BLOCK:
        return _result(candidate_id, "BLOCKED", [_reason_for_machine(machine)], integrity, namespaces=namespaces,
                       classification=machine, provenance=_provenance(rules=applied_rules))

    eligibility = evaluate_ai(machine, normalized)
    machine_reason = _reason_for_machine(machine)
    if not eligibility.get("eligible"):
        return _result(candidate_id, "REVIEW_REQUIRED", [machine_reason, "AI_NOT_ELIGIBLE"], integrity,
                       namespaces=namespaces, classification=machine,
                       provenance=_provenance(rules=applied_rules))
    if not enable_ai:
        return _result(candidate_id, "REVIEW_REQUIRED", [machine_reason, "AI_ASSIST_DISABLED"], integrity,
                       namespaces=namespaces, classification=machine,
                       provenance=_provenance(rules=applied_rules))

    ai = invoke_ai(normalized, machine, eligibility, provider=ai_provider, command=ai_command)
    if ai["status"] != "AI_ASSIST_USED":
        return _result(candidate_id, "REVIEW_REQUIRED", [machine_reason, ai["status"]], integrity,
                       namespaces=namespaces, classification=machine,
                       provenance=_provenance(rules=applied_rules, provider=ai.get("provider")))

    response = ai["response"]
    assisted = dict(normalized)
    assisted["claims"] = response["claims"]
    if "edges" in response:
        assisted["edges"] = response["edges"]
    assisted, post_ai_rules = normalize_candidate(assisted)
    all_rules = sorted(set(applied_rules + post_ai_rules))
    try:
        registry = classifier.refresh_registry()
        recheck = classifier.classify_policy(assisted)
    except RuntimeError as exc:
        return _result(candidate_id, "BLOCKED", [str(exc)], _integrity(False),
                       classification={"pre_ai": machine, "post_ai": {"status": "INTEGRITY_FAILURE"}},
                       provenance=_provenance(ai_used=True, recheck=True, rules=all_rules, provider=ai.get("provider")))

    integrity = _integrity(True, registry.get("semantic_sha256"))
    re_status = recheck.get("status")
    re_namespaces = recheck.get("namespaces", [])
    improvement = build_candidate(normalized, response, machine, recheck)

    if re_status in {"CLASSIFIED", "MULTI_RESPONSIBILITY"}:
        authority, error = _authority(re_namespaces)
        reasons = ["AI_ASSIST_USED", _reason_for_machine(recheck)]
        if error:
            reasons.append(error)
        if re_status == "MULTI_RESPONSIBILITY":
            outcome = "SPLIT_REQUIRED"
        elif error:
            outcome = "REVIEW_REQUIRED"
        else:
            outcome = "ROUTED"
        return _result(candidate_id, outcome, reasons, integrity, namespaces=re_namespaces, primary=recheck.get("primary"),
                       classification={"pre_ai": machine, "post_ai": recheck}, authority=authority,
                       provenance=_provenance(machine_verified=True, ai_used=True, recheck=True, rules=all_rules,
                                              improvement=improvement, provider=ai.get("provider")),
                       improvement=improvement)

    return _result(candidate_id, "REVIEW_REQUIRED",
                   ["AI_ASSIST_USED", "AI_EXACT_CONFIRMATION_FAILED", _reason_for_machine(recheck)],
                   integrity, namespaces=re_namespaces, classification={"pre_ai": machine, "post_ai": recheck},
                   provenance=_provenance(ai_used=True, recheck=True, rules=all_rules, provider=ai.get("provider")))

def _load_candidate(path):
    text = Path(path).read_text(encoding="utf-8")
    if str(path).endswith((".yaml", ".yml")):
        return yaml.safe_load(text)
    return json.loads(text)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("candidate")
    p.add_argument("--ai-command")
    p.add_argument("--disable-ai", action="store_true")
    p.add_argument("--output")
    p.add_argument("--improvement-output")
    args = p.parse_args()
    result = route_candidate(_load_candidate(args.candidate), ai_command=args.ai_command, enable_ai=not args.disable_ai)
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")
    if args.improvement_output and result.get("improvement_candidate"):
        Path(args.improvement_output).write_text(
            json.dumps(result["improvement_candidate"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    raise SystemExit(0 if result["outcome"] in {"ROUTED", "SPLIT_REQUIRED"} else 2)
