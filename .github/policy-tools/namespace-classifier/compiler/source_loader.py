import hashlib,json
from pathlib import Path
import yaml
TOOL_ROOT=Path(__file__).resolve().parents[1]
REPO_ROOT=Path(__file__).resolve().parents[4]
SOURCE=REPO_ROOT/"docs"/"policy"/"governance"/"namespace_rules.yaml"
LOCK=TOOL_ROOT/"generated"/"compiled_registry.lock.json"
FIELDS=["subject_type","operation","object_type","state_owner","effect","authority","phase","relation"]
def canonical(obj): return json.dumps(obj,ensure_ascii=False,sort_keys=True,separators=(",",":"))
def load_source(source_path=SOURCE):
    source_path=Path(source_path); root=source_path.parent
    raw=source_path.read_text(encoding="utf-8"); data=yaml.safe_load(raw); namespaces={}
    try: anchor=str(source_path.relative_to(REPO_ROOT))
    except ValueError: anchor=source_path.name
    parts=[(anchor,raw)]
    for code,rel in data.get("namespace_sources",{}).items():
        p=root/rel; text=p.read_text(encoding="utf-8"); shard=yaml.safe_load(text)
        if shard.get("namespace")!=code: raise SystemExit(f"COMPILE_FAILED\n{rel}: namespace must be {code}")
        namespaces[code]={k:v for k,v in shard.items() if k not in ("schema_version","namespace")}; parts.append((rel,text))
    data["namespaces"]=namespaces
    return data,hashlib.sha256(canonical(parts).encode()).hexdigest()
