import copy,sys,tempfile
from pathlib import Path
import yaml
ROOT=Path(__file__).resolve().parents[1]; REPO=ROOT.parents[2]
sys.path.insert(0,str(ROOT/"compiler")); sys.path.insert(0,str(ROOT/"engine"))
from registry_builder import build_registry
from source_loader import load_source
import classifier

def eq(a,b,label):
    if a!=b: raise AssertionError(f"{label}: expected {b!r}, got {a!r}")

def test_exact_tax():
    c={"subject_type":"product","operation":"assign_classification","object_type":"assignment","state_owner":"taxonomy","effect":"assignment","authority":"registry","phase":"registered","relation":"assigns"}
    r=classifier.classify_claim(c); eq(r["status"],"CLASSIFIED","status"); eq(r["primary"],"TAX","namespace")

def test_multi():
    tax={"subject_type":"product","operation":"assign_classification","object_type":"assignment","state_owner":"taxonomy","effect":"assignment","authority":"registry","phase":"registered","relation":"assigns"}
    uix={"subject_type":"ui","operation":"define_navigation","object_type":"navigation","state_owner":"presentation","effect":"navigation","authority":"web","phase":"any","relation":"projects"}
    eq(classifier.classify_policy({"claims":[tax,uix]})["status"],"MULTI_RESPONSIBILITY","multi")

def test_boundary():
    tax={"subject_type":"taxonomy","operation":"define_term","object_type":"term","state_owner":"taxonomy","effect":"term_semantics","authority":"registry","phase":"authoring","relation":"owns"}
    r=classifier.classify_policy({"declared_namespace":"UIX","claims":[tax]}); eq(r["status"],"BOUNDARY_VIOLATION","boundary")

def test_edges():
    eq(classifier.validate_edge({"from":"UIX","relation":"projects_from","to":"TAX"})["status"],"VALID","edge")
    eq(classifier.validate_edge({"from":"TAX","relation":"projects_from","to":"UIX"})["status"],"INVALID_EDGE","edge direction")

def test_extensible_and_vocab():
    source=REPO/"docs/policy/governance/namespace_rules.yaml"; data,_=load_source(source)
    ext=copy.deepcopy(data); ext["namespaces"]["MOD"]={"responsibility":"Moderation","entity_scope":["record"],"decision_scope":["decision"],"exclusions":[],"owned_state":["moderation"],"allowed_relations":["owns"],"variants":{"MOD_DECIDE":{"subject_type":"moderator","operation":"decide_moderation","object_type":"record","state_owner":"moderation","effect":"decision","authority":"registry","phase":"registered","relation":"owns"}}}
    with tempfile.TemporaryDirectory() as td:
        td=Path(td); gov=td/"governance"; (gov/"namespaces").mkdir(parents=True)
        manifest=yaml.safe_load(source.read_text()); manifest["namespace_sources"]["MOD"]="namespaces/MOD.yaml"
        (gov/"namespace_rules.yaml").write_text(yaml.safe_dump(manifest,sort_keys=False))
        for code,body in ext["namespaces"].items():
            (gov/f"namespaces/{code}.yaml").write_text(yaml.safe_dump({"schema_version":"1.0","namespace":code,**body},sort_keys=False))
        eq(len(build_registry(gov/"namespace_rules.yaml")["namespace_boundaries"]),11,"extensible")
        bad=yaml.safe_load((gov/"namespaces/CAT.yaml").read_text()); bad["variants"]["CAT_VISIBILITY"]["authority"]="regsitry"; (gov/"namespaces/CAT.yaml").write_text(yaml.safe_dump(bad,sort_keys=False))
        try: build_registry(gov/"namespace_rules.yaml")
        except SystemExit as exc:
            if "closed vocabulary" not in str(exc): raise
        else: raise AssertionError("authority typo accepted")

def run():
    tests=[v for k,v in globals().items() if k.startswith("test_") and callable(v)]
    for t in sorted(tests,key=lambda f:f.__name__): t(); print(f"PASS {t.__name__}")
    print(f"PASS {len(tests)} tests")
if __name__=="__main__": run()
