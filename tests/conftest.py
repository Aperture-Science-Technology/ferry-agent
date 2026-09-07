"""Configuration pytest partagee.

Le paquet est en layout `src/` (cf. `pyproject.toml`,
`[tool.setuptools.packages.find] where = ["src"]`) mais n'est pas installe
en mode editable par les commandes de demarrage documentees (juste
`pip install -r requirements.txt`). On ajoute donc `src/` a `sys.path` ici
pour que `import ferry_agent` fonctionne tel quel.

Les tests unitaires mockent SQLAlchemy via `FakeSession` / `ScalarResult`
(factorises dans `tests/fakes.py`, reexportes ici). La couche Postgres
reelle vit dans `tests/integration/`.
"""

from __future__ import annotations

import sys
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parent.parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from tests.fakes import (  # noqa: E402
    FakeSession,
    ScalarResult,
    clear_app_deps,
    override_app_deps,
)

__all__ = [
    "FakeSession",
    "ScalarResult",
    "clear_app_deps",
    "override_app_deps",
]
