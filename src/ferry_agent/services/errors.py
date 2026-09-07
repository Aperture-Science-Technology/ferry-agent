"""Erreurs metier partagees par les chemins d'entree de fichiers."""


class FileTooLargeError(ValueError):
    """Le corps uploadé dépasse la borne configuree (max_fetch_bytes)."""


class UnknownFormatError(ValueError):
    """Le contenu n'est pas un conteneur ebook reconnu (EPUB/PDF/MOBI/AZW3)."""
