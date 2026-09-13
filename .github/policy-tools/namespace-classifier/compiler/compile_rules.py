import argparse
import json
from pathlib import Path
from registry_builder import LOCK, build_registry, lock_from_registry

def render_lock():
    return json.dumps(lock_from_registry(build_registry()),ensure_ascii=False,indent=2,sort_keys=True)+"\n"

def write_lock():
    LOCK.parent.mkdir(parents=True,exist_ok=True); LOCK.write_text(render_lock(),encoding="utf-8")

def verify_lock():
    if not LOCK.exists(): return False,"compiled registry lock missing"
    return (LOCK.read_text(encoding="utf-8")==render_lock(),"compiled registry lock matches source set")

if __name__ == "__main__":
    p=argparse.ArgumentParser(); p.add_argument("--check",action="store_true"); a=p.parse_args()
    if a.check:
        ok,msg=verify_lock(); print(msg if ok else "compiled registry lock drift detected"); raise SystemExit(0 if ok else 1)
    reg=build_registry(); write_lock(); print(f"compiled {len(reg['namespace_boundaries'])} namespaces / {len(reg['variants'])} variants")
