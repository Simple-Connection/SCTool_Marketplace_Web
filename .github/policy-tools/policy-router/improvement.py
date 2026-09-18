import argparse
import hashlib
import json
from pathlib import Path
import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
RULES_PATH = REPO_ROOT / "docs/policy/governance/normalization_rules.yaml"
FIELDS = ["subject_type","operation","object_type","state_owner","effect","authority","phase","relation"]

class PromotionError(Exception):
    pass

def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def _fingerprint(value):
    return hashlib.sha256(_canonical(value).encode()).hexdigest()

def _candidate_id(original, assisted):
    return "IMP-" + _fingerprint({"original": original, "assisted": assisted})[:16]

def _normalization_rule_proposals(original_claims, assisted_claims):
    rules = []
    if len(original_claims) != len(assisted_claims):
        return rules
    for idx, (before, after) in enumerate(zip(original_claims, assisted_claims)):
        if not isinstance(before, dict) or not isinstance(after, dict):
            continue
        if set(before) != set(after):
            continue
        diffs = [(field, before[field], after[field]) for field in FIELDS if before.get(field) != after.get(field)]
        for field, old, new in diffs:
            rules.append({"type": "FIELD_ALIAS", "field": field, "from": old, "to": new, "claim_index": idx})
    return rules

def _completion_rule_proposals(original_claims, assisted_claims):
    rules = []
    if len(original_claims) != len(assisted_claims):
        return rules
    for idx, (before, after) in enumerate(zip(original_claims, assisted_claims)):
        if not isinstance(before, dict) or not isinstance(after, dict):
            continue
        missing = {f: after[f] for f in FIELDS if f not in before and f in after}
        if not missing or not before:
            continue
        when = {k: v for k, v in before.items() if k in FIELDS}
        if when:
            rules.append({"type": "CLAIM_COMPLETION", "when": when, "set": missing, "claim_index": idx})
    return rules

def build_candidate(original_candidate, ai_response, original_machine, recheck):
    if recheck.get("status") not in {"CLASSIFIED", "MULTI_RESPONSIBILITY"}:
        return None
    before = original_candidate.get("claims", [])
    after = ai_response.get("claims", [])
    status = original_machine.get("status")
    if status == "INCOMPLETE":
        gap_class = "CLAIM_COMPLETION_GAP"
        action = "PROPOSE_PREPARATION_RULE"
        proposals = _completion_rule_proposals(before, after)
    else:
        gap_class = "NORMALIZATION_GAP"
        action = "PROPOSE_DETERMINISTIC_NORMALIZATION_RULE"
        proposals = _normalization_rule_proposals(before, after)
    if not proposals:
        return None
    cid = _candidate_id(original_candidate, ai_response)
    matched = None
    for result in recheck.get("claim_results", []):
        if result.get("variant"):
            matched = result["variant"]
            break
    namespace = recheck.get("primary") or (recheck.get("namespaces") or [None])[0]
    result = {
        "schema_version": "1.0",
        "candidate_id": cid,
        "status": "PROPOSED",
        "gap_class": gap_class,
        "proposed_action": action,
        "evidence": {
            "ai_assist_used": True,
            "machine_recheck_passed": True,
            "input_fingerprint": _fingerprint(original_candidate),
            **({"matched_variant": matched} if matched else {}),
        },
        "proposal": {
            "normalization_rules": proposals,
            "assisted_claims": after,
        },
    }
    if namespace:
        result["namespace"] = namespace
    return result

def promote_candidate(candidate, approval, rules_path=RULES_PATH):
    if approval.get("schema_version") != "1.0" or approval.get("authority") != "USER" or approval.get("decision") != "APPROVE":
        raise PromotionError("APPROVAL_REQUIRED")
    if approval.get("candidate_id") != candidate.get("candidate_id"):
        raise PromotionError("APPROVAL_CANDIDATE_MISMATCH")
    proposals = candidate.get("proposal", {}).get("normalization_rules", [])
    if not proposals:
        raise PromotionError("NO_PROMOTABLE_RULES")
    path = Path(rules_path)
    rules_doc = yaml.safe_load(path.read_text(encoding="utf-8"))
    existing = {r["id"] for r in rules_doc.get("rules", [])}
    added = []
    for idx, proposal in enumerate(proposals, start=1):
        if proposal.get("type") not in {"FIELD_ALIAS", "CLAIM_COMPLETION"}:
            continue
        rid = f"NORM-{candidate['candidate_id'][4:].upper()}-{idx:02d}"
        if rid in existing:
            continue
        rule = {"id": rid, "type": proposal["type"], "status": "ACTIVE"}
        if proposal["type"] == "FIELD_ALIAS":
            rule.update({k: proposal[k] for k in ("field", "from", "to")})
        else:
            rule.update({"when": proposal["when"], "set": proposal["set"]})
        rules_doc.setdefault("rules", []).append(rule)
        existing.add(rid)
        added.append(rid)
    if not added:
        raise PromotionError("NO_NEW_RULES")
    path.write_text(yaml.safe_dump(rules_doc, sort_keys=False, allow_unicode=True), encoding="utf-8")
    return added

def _load(path):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8")) if str(path).endswith((".yaml",".yml")) else json.loads(Path(path).read_text(encoding="utf-8"))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("candidate")
    p.add_argument("--approval", required=True)
    p.add_argument("--rules", default=str(RULES_PATH))
    args = p.parse_args()
    print(json.dumps({"promoted_rule_ids": promote_candidate(_load(args.candidate), _load(args.approval), args.rules)}, indent=2))
