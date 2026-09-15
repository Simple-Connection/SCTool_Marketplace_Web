import hashlib,json
from source_loader import FIELDS,SOURCE,canonical,load_source
from validator import validate

def build_registry(source_path=SOURCE):
    data,source_sha=load_source(source_path); variants,boundaries=validate(data)
    tuple_index={}
    for v in variants:
        key=hashlib.sha256(canonical([v[f] for f in FIELDS]).encode()).hexdigest()
        tuple_index[key]={"namespace":v["namespace"],"variant_id":v["variant_id"],"namespace_status":v["namespace_status"]}
    semantic={
        "claim_fields":FIELDS,
        "namespaces":boundaries,
        "cross_namespace_edges":data.get("cross_namespace_edges",{}),
        "tuple_index":tuple_index,
    }
    sem_sha=hashlib.sha256(canonical(semantic).encode()).hexdigest()
    return {
        "schema_version":"1.0",
        "generated":True,
        "do_not_edit":True,
        "source":{
            "path":"docs/policy/governance/namespace_rules.yaml",
            "mode":"MANIFEST_BOUND_SOURCE_SET",
            "schema_version":str(data["schema_version"]),
            "source_set_sha256":source_sha,
        },
        "semantic_sha256":sem_sha,
        **semantic,
    }

def render_registry(reg):
    return json.dumps(reg,ensure_ascii=False,indent=2,sort_keys=True)+"\n"

def registry_sha256(reg):
    return hashlib.sha256(render_registry(reg).encode()).hexdigest()

def lock_from_registry(reg):
    return {
        "schema_version":"1.0",
        "generated":True,
        "do_not_edit":True,
        "source":reg["source"]["path"],
        "source_mode":reg["source"]["mode"],
        "source_schema_version":reg["source"]["schema_version"],
        "source_set_sha256":reg["source"]["source_set_sha256"],
        "semantic_sha256":reg["semantic_sha256"],
        "compiled_registry_sha256":registry_sha256(reg),
        "namespace_count":len(reg["namespaces"]),
        "variant_count":len(reg["tuple_index"]),
    }

def render_lock(lock):
    return json.dumps(lock,ensure_ascii=False,indent=2,sort_keys=True)+"\n"
