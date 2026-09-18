from pathlib import Path
import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
POLICY_PATH = REPO_ROOT / "docs/policy/governance/authority_policy.yaml"

class AuthorityResolutionError(Exception):
    pass

def load_policy(path=POLICY_PATH):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))

def resolve(namespace, policy=None):
    policy = policy or load_policy()
    row = policy.get("namespace_authorities", {}).get(namespace)
    if not row:
        raise AuthorityResolutionError(f"AUTHORITY_MAPPING_MISSING:{namespace}")
    return {
        "schema_version": "1.0",
        "namespace": namespace,
        "decision_authority": row["decision_authority"],
        "execution_boundary": row["execution_boundary"],
        "repository_owner": row["repository_owner"],
        "evidence": {
            "policy": "docs/policy/governance/authority_policy.yaml",
            "ownership_scope": row.get("ownership_scope"),
        },
    }

def resolve_many(namespaces, policy=None):
    policy = policy or load_policy()
    return {"by_namespace": {ns: resolve(ns, policy) for ns in namespaces}}
