import hashlib
from source_loader import FIELDS,SOURCE,LOCK,canonical,load_source
from validator import validate
def build_registry(source_path=SOURCE):
    data,source_sha=load_source(source_path); variants,boundaries=validate(data)
    semantic={"claim_fields":FIELDS,"namespace_boundaries":boundaries,"cross_namespace_edges":data.get("cross_namespace_edges",{}),"variants":variants}
    sem_sha=hashlib.sha256(canonical(semantic).encode()).hexdigest()
    return {"source_schema_version":data["schema_version"],"source_set_sha256":source_sha,"semantic_sha256":sem_sha,"claim_fields":FIELDS,"namespace_contract":data.get("namespace_contract",{}),"vocabulary":data.get("vocabulary",{}),"boundary_terms":data.get("boundary_terms",{}),"namespace_boundaries":boundaries,"cross_namespace_edges":data.get("cross_namespace_edges",{}),"variants":variants}
def lock_from_registry(reg):
    return {"generated":True,"do_not_edit":True,"source":"docs/policy/governance/namespace_rules.yaml","source_mode":"MANIFEST_BOUND_SOURCE_SET","source_schema_version":reg["source_schema_version"],"source_set_sha256":reg["source_set_sha256"],"semantic_sha256":reg["semantic_sha256"],"namespace_count":len(reg["namespace_boundaries"]),"variant_count":len(reg["variants"])}
