from copy import deepcopy
from pathlib import Path
import yaml
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

REPO_ROOT = Path(__file__).resolve().parents[3]
CANDIDATE_SCHEMA = REPO_ROOT / "docs/policy/schemas/routing/routing-candidate.schema.yaml"

class PreparationError(Exception):
    def __init__(self, code, details=None):
        super().__init__(code)
        self.code = code
        self.details = details or {}

def _load_yaml(path):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))

def validate_candidate(candidate):
    try:
        Draft202012Validator(_load_yaml(CANDIDATE_SCHEMA)).validate(candidate)
    except ValidationError as exc:
        raise PreparationError("INPUT_SCHEMA_INVALID", {"message": exc.message, "path": list(exc.absolute_path)}) from exc

def prepare_candidate(candidate):
    if not isinstance(candidate, dict):
        raise PreparationError("INPUT_SCHEMA_INVALID", {"message": "candidate must be an object"})
    validate_candidate(candidate)
    prepared = deepcopy(candidate)
    prepared.setdefault("claims", [])
    prepared.setdefault("edges", [])
    prepared.setdefault("metadata", {})
    return prepared
