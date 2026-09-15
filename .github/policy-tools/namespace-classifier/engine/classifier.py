import json,sys
from pathlib import Path
TOOL_ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(TOOL_ROOT/"compiler"))
from lock_verifier import load_verified_registry

REGISTRY=load_verified_registry()
FIELDS=REGISTRY["claim_fields"]
INDEX={}
for v in REGISTRY["variants"]:
    ns=REGISTRY["namespaces"].get(v["namespace"],{})
    if not ns.get("routable"):
        continue
    INDEX.setdefault(tuple(v[f] for f in FIELDS),[]).append(v)

def boundary_match(declared,claim,actual=None):
    b=REGISTRY.get("namespaces",{}).get(declared,{})
    out=[]
    for r in b.get("exclusion_rules",[]):
        if actual and actual in r.get("namespaces",[]):
            out.append(r["id"]); continue
        if claim.get("operation") in r.get("operations",[]):
            out.append(r["id"]); continue
        if claim.get("effect") in r.get("effects",[]):
            out.append(r["id"])
    return sorted(set(out))

def classify_claim(claim,declared_namespace=None):
    missing=[f for f in FIELDS if f not in claim]; extra=[f for f in claim if f not in FIELDS]
    if missing:
        return {"status":"INCOMPLETE","primary":None,"variant":None,"missing":missing,"extra":extra}
    if extra:
        return {"status":"INVALID_CLAIM","primary":None,"variant":None,"missing":[],"extra":extra}
    pre=boundary_match(declared_namespace,claim) if declared_namespace else []
    if pre:
        return {"status":"BOUNDARY_VIOLATION","primary":None,"variant":None,"declared_namespace":declared_namespace,"actual_namespace":None,"exclusion_rules":pre,"missing":[],"extra":[]}
    matches=INDEX.get(tuple(claim[f] for f in FIELDS),[])
    if len(matches)==1:
        v=matches[0]; actual=v["namespace"]
        if declared_namespace and actual!=declared_namespace:
            ex=boundary_match(declared_namespace,claim,actual)
            status="BOUNDARY_VIOLATION" if ex else "DECLARED_NAMESPACE_MISMATCH"
            result={"status":status,"primary":actual,"variant":v["variant_id"],"declared_namespace":declared_namespace,"actual_namespace":actual,"missing":[],"extra":[]}
            if ex:
                result["exclusion_rules"]=ex
            return result
        return {"status":"CLASSIFIED","primary":actual,"variant":v["variant_id"],"missing":[],"extra":[]}
    if len(matches)>1:
        return {"status":"AMBIGUOUS","primary":None,"variant":None,"candidates":sorted({m["namespace"] for m in matches}),"missing":[],"extra":[]}
    return {"status":"UNKNOWN_SEMANTIC_TUPLE","primary":None,"variant":None,"missing":[],"extra":[]}

def validate_edge(edge):
    req=["from","relation","to"]; missing=[k for k in req if k not in edge]; extra=[k for k in edge if k not in req]
    if missing or extra:
        return {"status":"INVALID_EDGE","missing":missing,"extra":extra,"edge":edge}
    src,tgt,rel=edge["from"],edge["to"],edge["relation"]; ns=REGISTRY["namespaces"]; c=REGISTRY["cross_namespace_edges"].get(rel)
    if src not in ns or tgt not in ns:
        return {"status":"INVALID_EDGE","reason":"UNKNOWN_NAMESPACE","edge":edge}
    if not c:
        return {"status":"INVALID_EDGE","reason":"UNKNOWN_RELATION","edge":edge}
    if "*" not in c["allowed_from"] and src not in c["allowed_from"]:
        return {"status":"INVALID_EDGE","reason":"SOURCE_NAMESPACE_NOT_ALLOWED","edge":edge}
    if "*" not in c["allowed_to"] and tgt not in c["allowed_to"]:
        return {"status":"INVALID_EDGE","reason":"TARGET_NAMESPACE_NOT_ALLOWED","edge":edge}
    return {"status":"VALID","ownership_transfer":False,"edge":edge}

def classify_policy(policy):
    claims=policy.get("claims",[]); edges=policy.get("edges",[]); declared=policy.get("declared_namespace")
    if declared is not None and declared not in REGISTRY["namespaces"]:
        return {"status":"UNKNOWN_DECLARED_NAMESPACE","primary":None,"namespaces":[],"claim_results":[],"edge_results":[]}
    if declared is not None and not REGISTRY["namespaces"][declared].get("routable"):
        return {"status":"INACTIVE_DECLARED_NAMESPACE","primary":None,"namespaces":[],"claim_results":[],"edge_results":[]}
    results=[classify_claim(c,declared) for c in claims]; edge_results=[validate_edge(e) for e in edges]
    if not claims:
        return {"status":"INCOMPLETE","primary":None,"namespaces":[],"claim_results":[],"edge_results":edge_results}
    priority=["BOUNDARY_VIOLATION","DECLARED_NAMESPACE_MISMATCH","AMBIGUOUS","UNKNOWN_SEMANTIC_TUPLE","INVALID_CLAIM","INCOMPLETE"]
    statuses={r["status"] for r in results}; namespaces=sorted({r["primary"] for r in results if r.get("primary")})
    for s in priority:
        if s in statuses:
            return {"status":s,"primary":None,"namespaces":namespaces,"claim_results":results,"edge_results":edge_results}
    if any(e["status"]!="VALID" for e in edge_results):
        return {"status":"INVALID_EDGE","primary":None,"namespaces":namespaces,"claim_results":results,"edge_results":edge_results}
    if len(namespaces)==1:
        return {"status":"CLASSIFIED","primary":namespaces[0],"namespaces":namespaces,"claim_results":results,"edge_results":edge_results}
    return {"status":"MULTI_RESPONSIBILITY","primary":None,"namespaces":namespaces,"claim_results":results,"edge_results":edge_results}

if __name__=="__main__":
    if len(sys.argv)!=2:
        raise SystemExit("usage: python classifier.py <policy.json>")
    print(json.dumps(classify_policy(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))),ensure_ascii=False,indent=2))
