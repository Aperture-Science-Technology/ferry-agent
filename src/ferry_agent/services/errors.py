"""Erreurs metier partagees par les chemins d'entree de fichiers."""


class FileTooLargeError(ValueError):
    """Le corps uploadé dépasse la borne configuree (max_fetch_bytes)."""


class UnknownFormatError(ValueError):
    """Le contenu n'est pas un conteneur ebook reconnu (EPUB/PDF/MOBI/AZW3)."""


class QuotaExceededError(ValueError):
    """L'ajout ferait depasser le plafond de stockage de l'utilisateur."""


QUOTA_EXCEEDED_MESSAGE = (
    "Votre espace est plein. Supprimez des livres ou choisissez un fichier plus léger."
)

INVALID_KINDLE_EMAIL_MESSAGE = "Cette adresse email n'est pas valide."

INVALID_DEFAULT_FORMAT_MESSAGE = (
    "Format non pris en charge. Choisissez EPUB, MOBI, AZW3 ou PDF."
)

SUPPORTED_DEFAULT_FORMATS: frozenset[str] = frozenset({"epub", "mobi", "azw3", "pdf"})