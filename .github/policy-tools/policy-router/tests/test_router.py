import sys
import tempfile
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from router import route_candidate
from normalizer import normalize_candidate
from authority_resolver import resolve
from improvement import PromotionError, promote_candidate

TAX = {
    "subject_type": "product",
    "operation": "assign_classification",
    "object_type": "assignment",
    "state_owner": "taxonomy",
    "effect": "assignment",
    "authority": "registry",
    "phase": "registered",
    "relation": "assigns",
}
UIX = {
    "subject_type": "ui",
    "operation": "define_navigation",
    "object_type": "navigation",
    "state_owner": "presentation",
    "effect": "navigation",
    "authority": "web",
    "phase": "any",
    "relation": "projects",
}

def eq(actual, expected, label):
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")

def test_exact_route():
    result = route_candidate({"schema_version": "1.0", "candidate_id": "tax-1", "claims": [TAX]}, enable_ai=False)
    eq(result["outcome"], "ROUTED", "outcome")
    eq(result["primary_namespace"], "TAX", "namespace")
    eq(result["authority_resolution"]["by_namespace"]["TAX"]["decision_authority"], "TAXONOMY_AUTHORITY", "authority")
    eq(result["provenance"]["ai_assist_used"], False, "ai")

def test_multi_split():
    result = route_candidate({"schema_version": "1.0", "claims": [TAX, UIX]}, enable_ai=False)
    eq(result["outcome"], "SPLIT_REQUIRED", "multi outcome")
    eq(result["namespaces"], ["TAX", "UIX"], "namespaces")

def test_boundary_blocks_without_ai():
    result = route_candidate({"schema_version": "1.0", "declared_namespace": "UIX", "claims": [TAX]})
    eq(result["outcome"], "BLOCKED", "boundary outcome")
    if "BOUNDARY_VIOLATION" not in result["reason_codes"]:
        raise AssertionError("boundary reason missing")
    eq(result["provenance"]["ai_assist_used"], False, "boundary ai")

def test_ai_unavailable_reviews():
    partial = {"subject_type": "product", "operation": "assign_classification", "object_type": "assignment"}
    result = route_candidate({"schema_version": "1.0", "claims": [partial]})
    eq(result["outcome"], "REVIEW_REQUIRED", "ai unavailable outcome")
    if "AI_PROVIDER_UNAVAILABLE" not in result["reason_codes"]:
        raise AssertionError("AI provider reason missing")

def test_ai_completion_and_improvement():
    partial = {"subject_type": "product", "operation": "assign_classification", "object_type": "assignment"}
    candidate = {"schema_version": "1.0", "claims": [partial]}
    def provider(_request):
        return {"schema_version": "1.0", "proposal_type": "CLAIM_COMPLETION", "claims": [TAX]}
    result = route_candidate(candidate, ai_provider=provider)
    eq(result["outcome"], "ROUTED", "ai completion outcome")
    eq(result["primary_namespace"], "TAX", "ai completion namespace")
    eq(result["provenance"]["ai_assist_used"], True, "ai used")
    imp = result.get("improvement_candidate")
    if not imp:
        raise AssertionError("improvement candidate missing")
    eq(imp["gap_class"], "CLAIM_COMPLETION_GAP", "completion gap")
    eq(imp["proposal"]["normalization_rules"][0]["type"], "CLAIM_COMPLETION", "completion rule")

def test_ai_normalization_and_promotion():
    unknown = dict(TAX)
    unknown["operation"] = "classify_product"
    candidate = {"schema_version": "1.0", "claims": [unknown]}
    def provider(_request):
        return {"schema_version": "1.0", "proposal_type": "CLAIM_NORMALIZATION", "claims": [TAX]}
    result = route_candidate(candidate, ai_provider=provider)
    eq(result["outcome"], "ROUTED", "ai normalization outcome")
    imp = result["improvement_candidate"]
    eq(imp["gap_class"], "NORMALIZATION_GAP", "normalization gap")
    proposal = imp["proposal"]["normalization_rules"][0]
    eq(proposal["field"], "operation", "alias field")
    eq(proposal["from"], "classify_product", "alias from")
    eq(proposal["to"], "assign_classification", "alias to")
    approval = {"schema_version": "1.0", "candidate_id": imp["candidate_id"], "authority": "USER", "decision": "APPROVE"}
    with tempfile.TemporaryDirectory() as td:
        rules_path = Path(td) / "normalization_rules.yaml"
        rules_path.write_text(yaml.safe_dump({
            "schema_version": "1.0",
            "document_type": "marketplace_normalization_rules",
            "status": "ACTIVE",
            "principles": {
                "explicit_rules_only": True,
                "semantic_guessing": "FORBIDDEN",
                "overwrite_existing_claim_value": "FORBIDDEN",
                "promotion_requires_approval": True,
                "promotion_authority": "USER",
            },
            "supported_rule_types": ["FIELD_ALIAS", "CLAIM_COMPLETION"],
            "rules": [],
        }, sort_keys=False), encoding="utf-8")
        try:
            promote_candidate(imp, {}, rules_path)
        except PromotionError as exc:
            eq(str(exc), "APPROVAL_REQUIRED", "promotion gate")
        else:
            raise AssertionError("promotion accepted without approval")
        added = promote_candidate(imp, approval, rules_path)
        if not added:
            raise AssertionError("promotion did not add a rule")
        doc = yaml.safe_load(rules_path.read_text(encoding="utf-8"))
        normalized, applied = normalize_candidate(candidate, doc)
        eq(normalized["claims"][0]["operation"], "assign_classification", "promoted alias")
        if added[0] not in applied:
            raise AssertionError("promoted rule not applied")

def test_authority_resolver():
    tax = resolve("TAX")
    eq(tax["execution_boundary"], "REGISTRY", "tax boundary")
    acc = resolve("ACC")
    eq(acc["repository_owner"], "Simple-Connection/SC_Linked_App", "acc repo")

def run():
    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    for test in sorted(tests, key=lambda f: f.__name__):
        test()
        print(f"PASS {test.__name__}")
    print(f"PASS {len(tests)} policy-router tests")

if __name__ == "__main__":
    run()
