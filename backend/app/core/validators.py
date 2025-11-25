import bleach

def sanitize_html(value: str) -> str:
    """
    Remove qualquer tag HTML ou script de uma string.
    Ex: "<script>alert(1)</script>Olá" -> "alert(1)Olá" (ou escapado)
    """
    if isinstance(value, str):
        # bleach.clean remove tags perigosas
        return bleach.clean(value, tags=[], attributes={}, strip=True)
    return value