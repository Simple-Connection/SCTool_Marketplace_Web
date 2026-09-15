import hashlib,json
from pathlib import Path
import yaml
TOOL_ROOT=Path(__file__).resolve().parents[1]
REPO_ROOT=Path(__file__).resolve().parents[4]
SOURCE=REPO_ROOT/"docs"/"policy"/"governance"/"namespace_rules.yaml"
GENERATED=TOOL_ROOT/"generated"
REGISTRY=GENERATED/"compiled_registry.json"
LOCK=GENERATED/"compiled_registry.lock.json"
FIELDS=["subject_type","operation","object_type","state_owner","effect","authority","phase","relation"]

def canonical(obj):
    return json.dumps(obj,ensure_ascii=False,sort_keys=True,separators=(",",":"))

def source_entry(value):
    if isinstance(value,str):
        return {"source":value,"status":"ACTIVE"}
    if not isinstance(value,dict) or not isinstance(value.get("source"),str):
        raise SystemExit("COMPILE_FAILED\nnamespace source entry requires source")
    return {"source":value["source"],"status":value.get("status","ACTIVE")}

def read_source_set(source_path=SOURCE):
    source_path=Path(source_path); root=source_path.parent
    raw=source_path.read_text(encoding="utf-8"); data=yaml.safe_load(raw); parts=[]
    try:
        anchor=str(source_path.relative_to(REPO_ROOT))
    except ValueError:
        anchor=source_path.name
    parts.append((anchor,raw)); records={}
    for code,value in data.get("namespace_sources",{}).items():
        meta=source_entry(value); rel=meta["source"]; p=root/rel; text=p.read_text(encoding="utf-8")
        records[code]={**meta,"path":p,"text":text}; parts.append((rel,text))
    return data,records,hashlib.sha256(canonical(parts).encode()).hexdigest()

def compute_source_set_sha256(source_path=SOURCE):
    return read_source_set(source_path)[2]

def load_source(source_path=SOURCE):
    data,records,source_sha=read_source_set(source_path); namespaces={}; source_meta={}
    for code,record in records.items():
        shard=yaml.safe_load(record["text"])
        if shard.get("namespace")!=code:
            raise SystemExit(f"COMPILE_FAILED\n{record['source']}: namespace must be {code}")
        namespaces[code]={k:v for k,v in shard.items() if k not in ("schema_version","namespace")}
        source_meta[code]={"source":record["source"],"status":record["status"]}
    data["namespaces"]=namespaces; data["_namespace_source_meta"]=source_meta
    return data,source_sha
