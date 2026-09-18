HARD_BLOCK = {
    "BOUNDARY_VIOLATION",
    "DECLARED_NAMESPACE_MISMATCH",
    "INVALID_EDGE",
    "INVALID_CLAIM",
    "UNKNOWN_DECLARED_NAMESPACE",
    "INACTIVE_DECLARED_NAMESPACE",
}
AI_ELIGIBLE = {
    "INCOMPLETE": "CLAIM_COMPLETION_GAP",
    "UNKNOWN_SEMANTIC_TUPLE": "NORMALIZATION_GAP",
}

def evaluate(machine_result, candidate):
    status = machine_result.get("status")
    if status in HARD_BLOCK:
        return {"eligible": False, "required": False, "reason_class": "NON_AI_CORRECTABLE_FAILURE"}
    if status == "MULTI_RESPONSIBILITY":
        return {"eligible": True, "required": False, "reason_class": "SEMANTIC_SPLIT_PROPOSAL"}
    reason = AI_ELIGIBLE.get(status)
    if reason:
        has_context = bool(candidate.get("source_text") or candidate.get("claims"))
        return {"eligible": has_context, "required": has_context, "reason_class": reason}
    return {"eligible": False, "required": False, "reason_class": None}
