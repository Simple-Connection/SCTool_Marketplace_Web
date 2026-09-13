#!/usr/bin/env python3
import argparse
import hashlib
import json
import shutil
import stat
import time
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import urljoin

EXPECTED_PRODUCER = "Simple-Connection/sctool-registry"
EXPECTED_WORKFLOW = ".github/workflows/pages.yml"
EXPECTED_SOURCE_REF = "refs/heads/main"
EVIDENCE_SCHEMA = "registry-signed-distribution-handoff/v1"
LOCK_SCHEMA = "marketplace-registry-handoff-lock/v1"


class HandoffError(RuntimeError):
    pass


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise HandoffError(message)


def load_json_bytes(data: bytes, label: str):
    try:
        return json.loads(data.decode("utf-8"))
    except Exception as exc:
        raise HandoffError(f"{label} is not valid UTF-8 JSON: {exc}") from exc


def safe_zip_members(archive: zipfile.ZipFile):
    result = {}
    for info in archive.infolist():
        name = info.filename
        require(not info.is_dir(), f"ZIP directories are not allowed: {name}")
        require("\\" not in name, f"ZIP path contains backslash: {name}")
        parts = Path(name).parts
        require(name and not name.startswith("/") and ".." not in parts, f"Unsafe ZIP path: {name}")
        mode = (info.external_attr >> 16) & 0xFFFF
        require(not stat.S_ISLNK(mode), f"ZIP symlink is forbidden: {name}")
        require(name not in result, f"Duplicate ZIP member: {name}")
        result[name] = archive.read(info)
    return result


def digest_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def read_lock(lock_path: Path):
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    require(lock.get("schemaVersion") == LOCK_SCHEMA, "Unsupported handoff lock schema.")
    producer = lock.get("producer", {})
    require(producer.get("repository") == EXPECTED_PRODUCER, "Producer repository mismatch.")
    require(producer.get("workflow") == EXPECTED_WORKFLOW, "Producer workflow mismatch.")
    require(producer.get("sourceRef") == EXPECTED_SOURCE_REF, "Producer source ref mismatch.")
    require(producer.get("conclusion") == "success", "Producer run conclusion is not success.")
    revision = producer.get("sourceRevision", "")
    require(len(revision) in range(40, 65) and all(c in "0123456789abcdef" for c in revision), "Invalid source revision.")
    require(isinstance(producer.get("runId"), int) and producer["runId"] > 0, "Invalid producer run ID.")
    require(isinstance(producer.get("runAttempt"), int) and producer["runAttempt"] > 0, "Invalid producer run attempt.")
    return lock


def artifact_path(lock_path: Path, artifact) -> Path:
    return lock_path.parent / artifact["file"]


def verify_zip_digest(path: Path, expected: str, label: str):
    require(path.is_file(), f"{label} is missing: {path}")
    require(expected.startswith("sha256:"), f"{label} digest format is invalid.")
    actual = digest_file(path)
    require(actual == expected.removeprefix("sha256:"), f"{label} digest mismatch: {actual}")


def load_evidence(lock, lock_path: Path):
    evidence_artifact = lock["evidenceArtifact"]
    evidence_zip_path = artifact_path(lock_path, evidence_artifact)
    verify_zip_digest(evidence_zip_path, evidence_artifact["digest"], "Evidence artifact ZIP")
    with zipfile.ZipFile(evidence_zip_path, "r") as archive:
        members = safe_zip_members(archive)
    evidence_name = evidence_artifact["evidenceFile"]
    require(set(members) == {evidence_name}, f"Evidence artifact must contain exactly {evidence_name}.")
    evidence = load_json_bytes(members[evidence_name], evidence_name)
    require(evidence.get("schemaVersion") == EVIDENCE_SCHEMA, "Evidence schema mismatch.")
    return evidence, members[evidence_name]


def validate_evidence_binding(lock, evidence):
    producer = lock["producer"]
    ep = evidence.get("producer", {})
    require(ep.get("repository") == producer["repository"], "Evidence producer repository mismatch.")
    require(ep.get("workflow") == producer["workflow"], "Evidence producer workflow mismatch.")
    require(ep.get("runId") == producer["runId"], "Evidence producer run ID mismatch.")
    require(ep.get("runAttempt") == producer["runAttempt"], "Evidence producer run attempt mismatch.")
    require(ep.get("sourceRevision") == producer["sourceRevision"], "Evidence source revision mismatch.")
    require(ep.get("sourceRef") == producer["sourceRef"], "Evidence source ref mismatch.")

    locked_artifact = lock["distributionArtifact"]
    ea = evidence.get("artifact", {})
    for key in ("name", "id", "digest"):
        require(ea.get(key) == locked_artifact[key], f"Evidence distribution artifact {key} mismatch.")

    registry = evidence.get("registry", {})
    require(registry.get("revision") == producer["sourceRevision"], "Registry revision does not equal producer source revision.")
    require(registry.get("snapshotPath") == f"snapshots/{producer['sourceRevision']}.json", "Registry snapshot path mismatch.")

    verification = evidence.get("verification", {})
    for key in ("jsonSchemas", "rootSignature", "distributionSignature", "snapshotIntegrity", "exactFileSet"):
        require(verification.get(key) == "PASS", f"Producer verification gate is not PASS: {key}")


def load_distribution(lock, lock_path: Path, evidence):
    artifact = lock["distributionArtifact"]
    distribution_zip_path = artifact_path(lock_path, artifact)
    verify_zip_digest(distribution_zip_path, artifact["digest"], "Distribution artifact ZIP")
    with zipfile.ZipFile(distribution_zip_path, "r") as archive:
        members = safe_zip_members(archive)

    expected_files = {item["path"]: item for item in evidence["files"]}
    require(set(members) == set(expected_files), f"Distribution exact file set mismatch: {sorted(members)}")
    for path, descriptor in expected_files.items():
        data = members[path]
        require(len(data) == descriptor["size"], f"Distribution file size mismatch: {path}")
        require(sha256_bytes(data) == descriptor["sha256"], f"Distribution file digest mismatch: {path}")

    head = load_json_bytes(members["registry-head.json"], "registry-head.json")
    trust = load_json_bytes(members["trust.json"], "trust.json")
    snapshot_path = evidence["registry"]["snapshotPath"]
    snapshot = load_json_bytes(members[snapshot_path], snapshot_path)

    require(head.get("signed", {}).get("trustSequence") == trust.get("signed", {}).get("sequence"), "Head trustSequence mismatch.")
    require(head.get("signed", {}).get("revision") == evidence["registry"]["revision"], "Head revision mismatch.")
    require(head.get("signed", {}).get("sequence") == evidence["registry"]["sequence"], "Head sequence mismatch.")
    require(head.get("signed", {}).get("snapshot", {}).get("path") == snapshot_path, "Head snapshot path mismatch.")
    require(head.get("signed", {}).get("snapshot", {}).get("size") == len(members[snapshot_path]), "Head snapshot size mismatch.")
    require(head.get("signed", {}).get("snapshot", {}).get("sha256") == sha256_bytes(members[snapshot_path]), "Head snapshot digest mismatch.")
    require(snapshot.get("revision") == evidence["registry"]["revision"], "Snapshot revision mismatch.")
    require(snapshot.get("sequence") == evidence["registry"]["sequence"], "Snapshot sequence mismatch.")
    require(snapshot.get("source", {}).get("repository") == EXPECTED_PRODUCER, "Snapshot source repository mismatch.")
    require(snapshot.get("source", {}).get("commit") == evidence["registry"]["revision"], "Snapshot source commit mismatch.")
    return members


def materialize(members, destination: Path):
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)
    for name, data in members.items():
        output = destination.joinpath(*name.split("/"))
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
        require(output.read_bytes() == data, f"Byte preservation failed after materialization: {name}")


def fetch_exact(base_url: str, path: str) -> bytes:
    url = urljoin(base_url.rstrip("/") + "/", path)
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": "SCTool-Marketplace-Web-handoff-validator",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        require(response.status == 200, f"Public Registry request failed: {url} HTTP {response.status}")
        return response.read()


def verify_public(base_url: str, members, attempts: int = 12, delay: float = 2.0):
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            for path, expected in members.items():
                actual = fetch_exact(base_url, path)
                require(actual == expected, f"Public hosted bytes differ from signed artifact: {path}")
            return
        except Exception as exc:
            last_error = exc
            if attempt == attempts:
                break
            time.sleep(delay)
    raise HandoffError(f"Public Registry endpoint did not converge to exact handoff bytes: {last_error}")


def write_deployment_evidence(path: Path, lock, evidence, base_url: str, target_revision: str, members):
    payload = {
        "schemaVersion": "marketplace-registry-hosting-evidence/v1",
        "consumer": {
            "repository": "Simple-Connection/SCTool_Marketplace_Web",
            "targetRevision": target_revision,
            "publicBaseUrl": base_url.rstrip("/") + "/",
        },
        "producer": lock["producer"],
        "distributionArtifact": {
            "name": lock["distributionArtifact"]["name"],
            "id": lock["distributionArtifact"]["id"],
            "digest": lock["distributionArtifact"]["digest"],
        },
        "evidenceArtifact": {
            "name": lock["evidenceArtifact"]["name"],
            "id": lock["evidenceArtifact"]["id"],
            "digest": lock["evidenceArtifact"]["digest"],
        },
        "registry": evidence["registry"],
        "files": [
            {"path": name, "sha256": sha256_bytes(data), "size": len(data)}
            for name, data in sorted(members.items())
        ],
        "verification": {
            "exactArtifactDigest": "PASS",
            "exactEvidenceDigest": "PASS",
            "exactEvidenceBinding": "PASS",
            "exactFileSet": "PASS",
            "fileSha256": "PASS",
            "fileSize": "PASS",
            "bytePreservation": "PASS",
            "publicEndpointExactBytes": "PASS",
        },
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lock", required=True)
    parser.add_argument("--materialize")
    parser.add_argument("--public-base-url")
    parser.add_argument("--deployment-evidence")
    parser.add_argument("--target-revision", default="")
    args = parser.parse_args()

    lock_path = Path(args.lock).resolve()
    lock = read_lock(lock_path)
    evidence, _ = load_evidence(lock, lock_path)
    validate_evidence_binding(lock, evidence)
    members = load_distribution(lock, lock_path, evidence)

    if args.materialize:
        materialize(members, Path(args.materialize).resolve())

    if args.public_base_url:
        verify_public(args.public_base_url, members)
        require(args.deployment_evidence, "--deployment-evidence is required with --public-base-url")
        require(args.target_revision, "--target-revision is required with --public-base-url")
        write_deployment_evidence(
            Path(args.deployment_evidence).resolve(),
            lock,
            evidence,
            args.public_base_url,
            args.target_revision,
            members,
        )

    print("Registry signed distribution handoff verification PASS")
    print(f"producer_run_id={lock['producer']['runId']}")
    print(f"producer_run_attempt={lock['producer']['runAttempt']}")
    print(f"source_revision={lock['producer']['sourceRevision']}")
    print(f"artifact_id={lock['distributionArtifact']['id']}")
    print(f"artifact_digest={lock['distributionArtifact']['digest']}")
    print(f"registry_sequence={evidence['registry']['sequence']}")
    print(f"trust_sequence={evidence['registry']['trustSequence']}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        raise SystemExit(f"Registry signed distribution handoff verification FAILED: {exc}")
