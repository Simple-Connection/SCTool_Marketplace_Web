import hashlib,json,sys
from pathlib import Path
TOOL_ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(TOOL_ROOT/"compiler"))
from source_loader import SOURCE,REGISTRY,LOCK,compute_source_set_sha256

def _read_json(path,missing_code,invalid_code):
    path=Path(path)
    if not path.exists():
        raise RuntimeError(missing_code)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(invalid_code) from exc

def load_verified_registry(source_path=SOURCE,registry_path=REGISTRY,lock_path=LOCK):
    lock=_read_json(lock_path,"LOCK_MISSING","LOCK_INVALID")
    reg=_read_json(registry_path,"COMPILED_REGISTRY_MISSING","COMPILED_REGISTRY_INVALID")
    actual_registry_sha=hashlib.sha256(Path(registry_path).read_bytes()).hexdigest()
    if lock.get("compiled_registry_sha256")!=actual_registry_sha:
        raise RuntimeError("COMPILED_REGISTRY_HASH_MISMATCH")
    if reg.get("source",{}).get("source_set_sha256")!=lock.get("source_set_sha256") or reg.get("semantic_sha256")!=lock.get("semantic_sha256"):
        raise RuntimeError("LOCK_REGISTRY_METADATA_MISMATCH")
    if compute_source_set_sha256(source_path)!=lock.get("source_set_sha256"):
        raise RuntimeError("SOURCE_LOCK_STALE")
    if reg.get("generated") is not True or reg.get("do_not_edit") is not True:
        raise RuntimeError("COMPILED_REGISTRY_CONTRACT_INVALID")
    return reg
