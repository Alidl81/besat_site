def normalize_text(value: str | None) -> str:
    if value is None:
        return ""
    
    return " ".join(value.strip().split())


def empty_to_none(value: str | None) -> str | None:
    normalized = normalize_text(value)

    if normalized == "":
        return None
    
    return normalized