import json
from pathlib import Path
import yaml
from jsonschema import Draft202012Validator

REPO=Path(__file__).resolve().parents[2]
SCHEMAS=REPO/"docs"/"policy"/"schemas"

def load_yaml(path):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))

def schema(path):
    value=load_yaml(SCHEMAS/path)
    Draft202012Validator.check_schema(value)
    return value

def validate(instance_path,schema_path,json_input=False):
    instance=json.loads(Path(instance_path).read_text(encoding="utf-8")) if json_input else load_yaml(instance_path)
    Draft202012Validator(schema(schema_path)).validate(instance)

def check_all_schemas():
    checked=0
    for path in sorted(SCHEMAS.glob("*/*.yaml")):
        Draft202012Validator.check_schema(load_yaml(path))
        checked+=1
    return checked

def run():
    checked=check_all_schemas()
    validate(REPO/"docs/policy/index.yaml","index/policy-index.schema.yaml")
    validate(REPO/"docs/policy/governance/routing_policy.yaml","routing/routing-contract.schema.yaml")
    validate(REPO/"docs/policy/governance/authority_policy.yaml","authority/authority-contract.schema.yaml")
    validate(REPO/"docs/policy/governance/normalization_rules.yaml","preparation/normalization-rules.schema.yaml")
    rules_path=REPO/"docs/policy/governance/namespace_rules.yaml"
    validate(rules_path,"namespace/namespace-rules.schema.yaml")
    rules=load_yaml(rules_path)
    for code,meta in rules["namespace_sources"].items():
        source=rules_path.parent/meta["source"]
        validate(source,"namespace/namespace-source.schema.yaml")
        actual=load_yaml(source).get("namespace")
        if actual!=code:
            raise SystemExit(f"SCHEMA_CONTRACT_FAILED: {source}: namespace {actual!r} != {code!r}")
    validate(REPO/".github/policy-tools/namespace-classifier/generated/compiled_registry.json","namespace/compiled-registry.schema.yaml",True)
    validate(REPO/".github/policy-tools/namespace-classifier/generated/compiled_registry.lock.json","namespace/semantic-lock.schema.yaml",True)
    print(f"PASS policy schema contracts ({checked} schemas checked)")

if __name__=="__main__":
    run()
