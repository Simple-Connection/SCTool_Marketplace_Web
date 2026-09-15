import re
from source_loader import FIELDS

def validate(data):
    errors=[]
    if data.get("claim_fields")!=FIELDS:
        errors.append("claim_fields mismatch")
    ns=data.get("namespaces",{}); source_meta=data.get("_namespace_source_meta",{}); contract=data.get("namespace_contract",{})
    if not contract.get("extensible"):
        errors.append("namespace_contract.extensible must be true")
    if len(ns)<contract.get("minimum_count",1):
        errors.append("namespace count below minimum")
    pat=re.compile(contract.get("code_pattern",r"^[A-Z][A-Z0-9]{1,7}$"))
    vocab=data.get("vocabulary",{}); closed=vocab.get("closed_fields",{})
    ident=re.compile(vocab.get("identifier_pattern",r"^[a-z][a-z0-9_]*$"))
    status_pat=re.compile(r"^[A-Z][A-Z0-9_]*$")
    for f in ("authority","phase","relation"):
        if not closed.get(f):
            errors.append(f"closed vocabulary missing: {f}")
    codes=set(ns); terms=data.get("boundary_terms",{})
    for code in codes:
        if not pat.fullmatch(code):
            errors.append(f"invalid namespace code: {code}")
        meta=source_meta.get(code,{})
        if not meta.get("source"):
            errors.append(f"{code}: source missing")
        if not isinstance(meta.get("status"),str) or not status_pat.fullmatch(meta["status"]):
            errors.append(f"{code}: invalid status")
    for tid,t in terms.items():
        for target in t.get("namespaces",[]):
            if target not in codes:
                errors.append(f"{tid}: unknown namespace {target}")
    for eid,e in data.get("cross_namespace_edges",{}).items():
        for side in ("allowed_from","allowed_to"):
            for target in e.get(side,[]):
                if target!="*" and target not in codes:
                    errors.append(f"{eid}: unknown {side} {target}")
        if e.get("ownership_transfer") is not False:
            errors.append(f"{eid}: ownership_transfer must be false")
    seen_ids=set(); seen_tuples={}; variants=[]; boundaries={}
    for code,body in ns.items():
        meta=source_meta[code]; owned=set(body.get("owned_state",[])); rels=set(body.get("allowed_relations",[])); exclusion_rules=[]
        for tid in body.get("exclusions",[]):
            if tid not in terms:
                errors.append(f"{code}: unknown exclusion {tid}")
            else:
                exclusion_rules.append({"id":tid,**terms[tid]})
        boundaries[code]={k:body.get(k,[]) for k in ("entity_scope","decision_scope","owned_state","allowed_relations","exclusions")}
        boundaries[code].update({
            "responsibility":body.get("responsibility"),
            "exclusion_rules":exclusion_rules,
            "source":meta["source"],
            "status":meta["status"],
            "routable":meta["status"]=="ACTIVE",
        })
        for vid,v in body.get("variants",{}).items():
            if vid in seen_ids:
                errors.append(f"duplicate variant_id: {vid}")
            seen_ids.add(vid)
            missing=[f for f in FIELDS if f not in v]; extra=[f for f in v if f not in FIELDS]
            if missing or extra:
                errors.append(f"{vid}: invalid fields missing={missing} extra={extra}")
                continue
            for f in ("subject_type","operation","object_type","state_owner","effect"):
                if not isinstance(v[f],str) or not ident.fullmatch(v[f]):
                    errors.append(f"{vid}: invalid {f}")
            for f,allowed in closed.items():
                if v.get(f) not in allowed:
                    errors.append(f"{vid}: {f} not in closed vocabulary")
            if v["state_owner"] not in owned:
                errors.append(f"{vid}: state_owner not owned by {code}")
            if v["relation"] not in rels:
                errors.append(f"{vid}: relation not allowed by {code}")
            tup=tuple(v[f] for f in FIELDS)
            if tup in seen_tuples:
                errors.append(f"semantic tuple collision: {vid} and {seen_tuples[tup]}")
            seen_tuples[tup]=vid
            variants.append({"namespace":code,"namespace_status":meta["status"],"variant_id":vid,**{f:v[f] for f in FIELDS}})
    if errors:
        raise SystemExit("COMPILE_FAILED\n"+"\n".join(errors))
    variants.sort(key=lambda x:(x["namespace"],x["variant_id"]))
    return variants,boundaries
