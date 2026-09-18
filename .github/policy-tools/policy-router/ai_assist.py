import json
import os
from pathlib import Path
import shlex
import subprocess
import yaml
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

REPO_ROOT = Path(__file__).resolve().parents[3]
REQUEST_SCHEMA = REPO_ROOT / "docs/policy/schemas/preparation/ai-assist-request.schema.yaml"
RESPONSE_SCHEMA = REPO_ROOT / "docs/policy/schemas/preparation/ai-assist-response.schema.yaml"

def _schema(path):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))

def build_request(candidate, machine_result, eligibility):
    return {
        "schema_version": "1.0",
        "candidate": candidate,
        "machine_result": machine_result,
        "eligibility": eligibility,
        "constraints": {
            "final_namespace_decision": "FORBIDDEN",
            "create_namespace": "FORBIDDEN",
            "create_variant": "FORBIDDEN",
            "bypass_machine_recheck": "FORBIDDEN",
        },
    }

def validate_response(response):
    try:
        Draft202012Validator(_schema(RESPONSE_SCHEMA)).validate(response)
    except ValidationError as exc:
        return False, {"code": "AI_OUTPUT_SCHEMA_INVALID", "message": exc.message, "path": list(exc.absolute_path)}
    return True, None

def command_provider(command, timeout=60):
    args = shlex.split(command)
    if not args:
        raise RuntimeError("AI_PROVIDER_COMMAND_EMPTY")
    def invoke(payload):
        proc = subprocess.run(
            args,
            input=json.dumps(payload, ensure_ascii=False),
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,
            check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"AI_PROVIDER_FAILED:{proc.returncode}")
        try:
            return json.loads(proc.stdout)
        except json.JSONDecodeError as exc:
            raise RuntimeError("AI_PROVIDER_INVALID_JSON") from exc
    return invoke

def invoke(candidate, machine_result, eligibility, provider=None, command=None):
    if not eligibility.get("eligible"):
        return {"status": "AI_NOT_ELIGIBLE", "provider": None, "response": None}
    request = build_request(candidate, machine_result, eligibility)
    try:
        Draft202012Validator(_schema(REQUEST_SCHEMA)).validate(request)
    except ValidationError as exc:
        return {"status": "AI_REQUEST_SCHEMA_INVALID", "provider": None, "response": None, "error": exc.message}
    provider_name = "INJECTED_CALLABLE"
    if provider is None:
        command = command or os.environ.get("POLICY_ROUTER_AI_COMMAND")
        if not command:
            return {"status": "AI_PROVIDER_UNAVAILABLE", "provider": None, "response": None}
        provider = command_provider(command)
        provider_name = "EXTERNAL_COMMAND"
    try:
        response = provider(request)
    except Exception as exc:
        return {"status": "AI_PROVIDER_FAILED", "provider": provider_name, "response": None, "error": str(exc)}
    ok, error = validate_response(response)
    if not ok:
        return {"status": "AI_OUTPUT_SCHEMA_INVALID", "provider": provider_name, "response": response, "error": error}
    return {"status": "AI_ASSIST_USED", "provider": provider_name, "response": response}
