from copy import deepcopy
from pathlib import Path
import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
RULES_PATH = REPO_ROOT / "docs/policy/governance/normalization_rules.yaml"

def load_rules(path=RULES_PATH):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))

def _field_alias(claim, rule):
    field = rule["field"]
    if claim.get(field) != rule["from"]:
        return False
    claim[field] = rule["to"]
    return True

def _claim_completion(claim, rule):
    when = rule["when"]
    if any(claim.get(field) != value for field, value in when.items()):
        return False
    updates = rule["set"]
    for field, value in updates.items():
        if field in claim and claim[field] != value:
            return False
    changed = False
    for field, value in updates.items():
        if field not in claim:
            claim[field] = value
            changed = True
    return changed

def normalize_candidate(candidate, rules=None):
    rules = rules or load_rules()
    out = deepcopy(candidate)
    applied = []
    active = [r for r in rules.get("rules", []) if r.get("status") == "ACTIVE"]
    for claim in out.get("claims", []):
        for rule in active:
            changed = False
            if rule.get("type") == "FIELD_ALIAS":
                changed = _field_alias(claim, rule)
            elif rule.get("type") == "CLAIM_COMPLETION":
                changed = _claim_completion(claim, rule)
            if changed:
                applied.append(rule["id"])
    return out, sorted(set(applied))
