"""Descriptions OpenAPI des réponses XML et des fichiers servis sans JSON."""


def content_response(*media_types: str, binary: bool = False) -> dict:
    """Décrit les contenus bruts sans ajouter de réponse application/json."""
    schema = {"type": "string"}
    if binary:
        schema["format"] = "binary"
    return {200: {"content": {media_type: {"schema": schema} for media_type in media_types}}}


# Le type des fichiers dépend de leur extension ou de la couverture distante.
# Le joker conserve les autres types déjà servis par ces routes.
FILE_RESPONSES = content_response(
    "application/epub+zip",
    "application/pdf",
    "application/x-mobipocket-ebook",
    "application/vnd.amazon.ebook",
    "application/octet-stream",
    "*/*",
    binary=True,
)
COVER_RESPONSES = content_response(
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "*/*",
    binary=True,
)
