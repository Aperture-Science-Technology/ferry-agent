"""Exercise the actual shell functions without privileged container startup.

No existing shell harness exists. Python drives /bin/sh in a temporary config
root, then feeds the persisted result to the actual Forms-user reader.
"""

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

import pytest

IMAGE = Path(__file__).resolve().parents[2] / "image"


def run_credentials(tmp_path, **env):
    definitions = (IMAGE / "entrypoint.sh").read_text().split("\napply_timezone\n", 1)[0]
    script = definitions + '\nCONFIG_ROOT="$TEST_CONFIG_ROOT"\nensure_prowlarr_credentials\n'
    process_env = {k: v for k, v in os.environ.items() if k not in ("PROWLARR_USER", "PROWLARR_PASSWORD")}
    process_env.update(TEST_CONFIG_ROOT=str(tmp_path), **env)
    process_env["PATH"] = str(Path(sys.executable).parent) + os.pathsep + process_env.get("PATH", "")
    return subprocess.run(["/bin/sh", "-c", script], env=process_env, capture_output=True, text=True)


def read_effective(tmp_path):
    spec = importlib.util.spec_from_file_location("image_credentials", IMAGE / "ensure_prowlarr_user.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.CREDS_FILE = tmp_path / "prowlarr-credentials"
    return module.read_credentials()


def test_generated_reused_and_explicit_override(tmp_path):
    first = run_credentials(tmp_path)
    assert first.returncode == 0, first.stderr
    user, password = read_effective(tmp_path)
    assert user == "ferry" and len(password) >= 24
    assert password not in first.stdout
    assert (tmp_path / "prowlarr-credentials").stat().st_mode & 0o777 == 0o600
    assert run_credentials(tmp_path).returncode == 0
    assert read_effective(tmp_path) == (user, password)
    overridden = run_credentials(tmp_path, PROWLARR_USER="reader", PROWLARR_PASSWORD=" secret=a b ")
    assert overridden.returncode == 0, overridden.stderr
    assert read_effective(tmp_path) == ("reader", " secret=a b ")
    assert "secret=a b" not in overridden.stdout
    assert run_credentials(tmp_path).returncode == 0
    assert read_effective(tmp_path) == ("reader", " secret=a b ")


@pytest.mark.parametrize("env", [{"PROWLARR_USER": "reader"}, {"PROWLARR_PASSWORD": "secret"}])
def test_partial_pair_rejected_even_with_saved_credentials(tmp_path, env):
    saved = tmp_path / "prowlarr-credentials"
    saved.write_text("username=ferry\npassword=old\n")
    result = run_credentials(tmp_path, **env)
    assert result.returncode == 1
    assert result.stderr.strip() == "PROWLARR_USER and PROWLARR_PASSWORD must be set together"
    assert read_effective(tmp_path) == ("ferry", "old")


def test_line_break_rejected(tmp_path):
    result = run_credentials(tmp_path, PROWLARR_USER="reader", PROWLARR_PASSWORD="secret\npassword=other")
    assert result.returncode == 1
    assert not (tmp_path / "prowlarr-credentials").exists()
