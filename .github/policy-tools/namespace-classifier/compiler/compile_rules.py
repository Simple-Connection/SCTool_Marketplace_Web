import argparse
from registry_builder import build_registry,lock_from_registry,render_lock,render_registry
from source_loader import LOCK,REGISTRY

def render_outputs():
    reg=build_registry()
    return reg,render_registry(reg),render_lock(lock_from_registry(reg))

def write_outputs():
    reg,registry_text,lock_text=render_outputs()
    REGISTRY.parent.mkdir(parents=True,exist_ok=True)
    REGISTRY.write_text(registry_text,encoding="utf-8")
    LOCK.write_text(lock_text,encoding="utf-8")
    return reg

def verify_outputs():
    if not REGISTRY.exists(): return False,"compiled registry missing"
    if not LOCK.exists(): return False,"compiled registry lock missing"
    _,registry_text,lock_text=render_outputs()
    if REGISTRY.read_text(encoding="utf-8")!=registry_text: return False,"compiled registry drift detected"
    if LOCK.read_text(encoding="utf-8")!=lock_text: return False,"compiled registry lock drift detected"
    return True,"compiled registry and lock match authority source set"

if __name__=="__main__":
    p=argparse.ArgumentParser(); p.add_argument("--check",action="store_true"); a=p.parse_args()
    if a.check:
        ok,msg=verify_outputs(); print(msg); raise SystemExit(0 if ok else 1)
    reg=write_outputs(); print(f"compiled {len(reg['namespaces'])} namespaces / {len(reg['tuple_index'])} variants")
