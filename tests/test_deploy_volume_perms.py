"""Régression permissions volumes nommés pour le core UID 10001.

Docker crée les named volumes en root:root 0755. Sans chown préalable,
appuser (10001) reçoit PermissionError à l'écriture (import_from_gateway).
Le contrat de déploiement (compose `volume-init` + même commande que
deploy.sh) doit rendre les montages inscriptibles sans wipe.
"""

from __future__ import annotations

import shutil
import subprocess
import uuid
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
COMPOSE_FILE = ROOT / "deploy" / "docker-compose.yml"
DEPLOY_SH = ROOT / "deploy" / "deploy.sh"
ALPINE = "alpine:3.20"
APP_UID_GID = "10001:10001"


def _docker_available() -> bool:
    if shutil.which("docker") is None:
        return False
    try:
        subprocess.run(
            ["docker", "info"],
            check=True,
            capture_output=True,
            timeout=15,
        )
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return False


docker_required = pytest.mark.skipif(
    not _docker_available(), reason="docker daemon required"
)


def test_compose_declares_volume_init_before_core() -> None:
    text = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "volume-init:" in text
    assert "chown -R 10001:10001 /data/library /data/tmp" in text
    assert "chmod 0755 /data/library /data/tmp" in text
    assert "ferry_library:/data/library" in text
    assert "ferry_tmp:/data/tmp" in text
    # Core must wait for the one-shot, same pattern as migrate.
    core_idx = text.index("ferry-agent-core:")
    depends = text[core_idx : core_idx + 800]
    assert "volume-init:" in depends
    assert "service_completed_successfully" in depends


def test_deploy_sh_reruns_volume_init_each_deploy() -> None:
    text = DEPLOY_SH.read_text(encoding="utf-8")
    assert "volume-init" in text
    assert "run --rm --no-deps volume-init" in text


@docker_required
def test_named_volume_root_owned_not_writable_by_uid_10001() -> None:
    """Baseline : volume neuf = PermissionError pour 10001 (échoue avant fix)."""
    vol = f"ferry_perm_baseline_{uuid.uuid4().hex[:10]}"
    try:
        subprocess.run(["docker", "volume", "create", vol], check=True, capture_output=True)
        probe = subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "--user",
                APP_UID_GID,
                "-v",
                f"{vol}:/data/library",
                ALPINE,
                "sh",
                "-c",
                "touch /data/library/probe",
            ],
            capture_output=True,
            text=True,
        )
        assert probe.returncode != 0, "nouveau volume root:root doit refuser UID 10001"
        combined = (probe.stderr or "") + (probe.stdout or "")
        assert "Permission denied" in combined
    finally:
        subprocess.run(["docker", "volume", "rm", "-f", vol], capture_output=True)


@docker_required
def test_volume_init_chown_makes_library_and_tmp_writable_by_uid_10001() -> None:
    """Après la commande de volume-init, 10001 écrit sur library et tmp."""
    suffix = uuid.uuid4().hex[:10]
    lib_vol = f"ferry_perm_lib_{suffix}"
    tmp_vol = f"ferry_perm_tmp_{suffix}"
    try:
        for vol in (lib_vol, tmp_vol):
            subprocess.run(
                ["docker", "volume", "create", vol], check=True, capture_output=True
            )

        # Preuve d'échec avant chown (régression : ce bloc échouait en prod).
        before = subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "--user",
                APP_UID_GID,
                "-v",
                f"{lib_vol}:/data/library",
                ALPINE,
                "sh",
                "-c",
                "touch /data/library/before",
            ],
            capture_output=True,
            text=True,
        )
        assert before.returncode != 0

        # Même correctif que deploy/docker-compose.yml service volume-init.
        init = subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "--user",
                "0:0",
                "-v",
                f"{lib_vol}:/data/library",
                "-v",
                f"{tmp_vol}:/data/tmp",
                ALPINE,
                "sh",
                "-c",
                "set -eu; chown -R 10001:10001 /data/library /data/tmp; "
                "chmod 0755 /data/library /data/tmp",
            ],
            capture_output=True,
            text=True,
        )
        assert init.returncode == 0, init.stderr

        after = subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "--user",
                APP_UID_GID,
                "-v",
                f"{lib_vol}:/data/library",
                "-v",
                f"{tmp_vol}:/data/tmp",
                ALPINE,
                "sh",
                "-c",
                "touch /data/library/probe /data/tmp/probe "
                "&& test -f /data/library/probe && test -f /data/tmp/probe",
            ],
            capture_output=True,
            text=True,
        )
        assert after.returncode == 0, after.stderr or after.stdout
    finally:
        for vol in (lib_vol, tmp_vol):
            subprocess.run(["docker", "volume", "rm", "-f", vol], capture_output=True)
