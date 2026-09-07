"""Helpers de tests unitaires mockes (FakeSession / overrides FastAPI).

Factorises hors de `tests/conftest.py` pour eviter le clash `from conftest import ...`
avec `tests/integration/conftest.py` (pytest met le dossier du conftest le plus
proche en tete de `sys.path`). `tests/conftest.py` reexporte ces symboles.
"""

from __future__ import annotations

import uuid


class ScalarResult:
    """Resultat minimal compatible `scalar_one_or_none` / `scalars().all()`."""

    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        values = self.value if isinstance(self.value, list) else []
        return _ScalarList(values)

    def all(self):
        return self.value if isinstance(self.value, list) else []


class _ScalarList:
    def __init__(self, values):
        self.values = values

    def all(self):
        return self.values


class FakeSession:
    """Session async minimale pour les tests unitaires sans Postgres.

    - `execute_values` : file de retours pour `execute()` (pop).
    - `always` : si fourni, `execute()` renvoie toujours cette valeur
      (patron auth : utilisateur deja present).
    """

    def __init__(self, execute_values=(), *, always=None):
        self.execute_values = list(execute_values)
        self.always = always
        self.commits = 0
        self.statements = []
        self.deleted = []
        self.added = []

    async def execute(self, statement):
        self.statements.append(statement)
        # File prioritaire : permet d'injecter un SUM(quota) puis de
        # retomber sur `always` (ex. Source upload) pour le reste.
        if self.execute_values:
            return ScalarResult(self.execute_values.pop(0))
        if self.always is not None:
            return ScalarResult(self.always)
        return ScalarResult(None)

    async def commit(self):
        self.commits += 1

    async def refresh(self, _value):
        return None

    async def delete(self, value):
        self.deleted.append(value)

    def add(self, value):
        self.added.append(value)
        table = getattr(value, "__table__", None)
        if table is None:
            return
        # Pas de flush reel : applique les defauts client-side de la
        # colonne (id/created_at/status...) comme le ferait SQLAlchemy.
        for column in table.columns:
            if getattr(value, column.name, None) is not None:
                continue
            default = column.default
            if default is None:
                continue
            if getattr(default, "is_callable", False):
                try:
                    setattr(value, column.name, default.arg())
                except TypeError:
                    setattr(value, column.name, default.arg(None))
            elif getattr(default, "is_scalar", False):
                setattr(value, column.name, default.arg)


def override_app_deps(fake_db, *, user_id: uuid.UUID, email: str = "test@example.com") -> None:
    """Branche `get_db` + `get_current_user` / `get_library_user` sur l'app de test."""
    from ferry_agent.api.deps import CurrentUser, get_current_user, get_library_user
    from ferry_agent.db import get_db
    from ferry_agent.main import app

    current = CurrentUser(id=user_id, email=email)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: current
    app.dependency_overrides[get_library_user] = lambda: current


def clear_app_deps() -> None:
    from ferry_agent.main import app

    app.dependency_overrides.clear()
