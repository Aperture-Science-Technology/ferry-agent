#!/usr/bin/env python3
"""Ensure the Prowlarr Forms UI user exists (idempotent).

Prefer path (a): PUT /api/v1/config/host/{id} with X-Api-Key.
Fall back to path (b): insert/update Users in prowlarr.db via sqlite3.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import sys
import time
import uuid
import urllib.error
import urllib.request
from base64 import b64encode
from pathlib import Path

PROWLARR_URL = os.environ.get("PROWLARR_URL", "http://127.0.0.1:9696").rstrip("/")
API_KEY_FILE = Path("/config/prowlarr-api-key")
CREDS_FILE = Path("/config/prowlarr-credentials")
DB_PATH = Path("/config/prowlarr/prowlarr.db")
MAX_TRIES = int(os.environ.get("PROWLARR_USER_READY_TRIES", "90"))
SLEEP_SECS = float(os.environ.get("PROWLARR_USER_POLL_SECONDS", "2"))

PBKDF2_ITERATIONS = 10000
SALT_SIZE = 16
HASH_BYTES = 32


def read_api_key() -> str:
    key = (os.environ.get("PROWLARR_API_KEY") or "").strip()
    if key:
        return key
    if API_KEY_FILE.is_file():
        return API_KEY_FILE.read_text(encoding="utf-8").strip()
    raise SystemExit("missing PROWLARR_API_KEY /config/prowlarr-api-key")


def read_credentials() -> tuple[str, str]:
    if not CREDS_FILE.is_file():
        raise SystemExit(f"missing credentials file {CREDS_FILE}")
    username = "ferry"
    password = ""
    for raw in CREDS_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, value = line.split("=", 1)
            key = key.strip().lower()
            value = value.strip()
            if key == "username":
                username = value
            elif key == "password":
                password = value
        elif not password:
            password = line
    if not username or not password:
        raise SystemExit(f"invalid credentials file {CREDS_FILE}")
    return username, password


def wait_for_ping() -> None:
    url = f"{PROWLARR_URL}/ping"
    for attempt in range(1, MAX_TRIES + 1):
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if 200 <= response.status < 300:
                    return
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        if attempt % 5 == 0:
            print(
                f"  waiting for Prowlarr before ensuring Forms user "
                f"({attempt}/{MAX_TRIES})",
                flush=True,
            )
        time.sleep(SLEEP_SECS)
    raise SystemExit(f"Prowlarr did not answer {url} in time")


def api_request(
    method: str,
    path: str,
    api_key: str,
    body: dict | None = None,
) -> tuple[int, dict | None]:
    data = None
    headers = {"X-Api-Key": api_key, "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        f"{PROWLARR_URL}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            payload = json.loads(raw.decode("utf-8")) if raw else None
            return response.status, payload if isinstance(payload, dict) else None
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else None
        except json.JSONDecodeError:
            payload = None
        return exc.code, payload if isinstance(payload, dict) else None


def ensure_via_api(api_key: str, username: str, password: str) -> bool:
    status, host = api_request("GET", "/api/v1/config/host", api_key)
    if status != 200 or not host:
        print(f"Prowlarr host config GET failed (HTTP {status})", flush=True)
        return False

    host_id = host.get("id", 1)
    payload = dict(host)
    payload["username"] = username
    payload["password"] = password
    payload["passwordConfirmation"] = password
    payload["authenticationMethod"] = "forms"
    payload["authenticationRequired"] = "enabled"

    put_status, _ = api_request(
        "PUT",
        f"/api/v1/config/host/{host_id}",
        api_key,
        body=payload,
    )
    if put_status in (200, 202):
        print(
            f"Prowlarr Forms user ensured via API (user={username}).",
            flush=True,
        )
        return True
    print(f"Prowlarr host config PUT failed (HTTP {put_status})", flush=True)
    return False


def hash_password(password: str) -> tuple[str, str, int]:
    salt = os.urandom(SALT_SIZE)
    digest = hashlib.pbkdf2_hmac(
        "sha512",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
        dklen=HASH_BYTES,
    )
    return b64encode(digest).decode("ascii"), b64encode(salt).decode("ascii"), PBKDF2_ITERATIONS


def ensure_via_sqlite(username: str, password: str) -> bool:
    for attempt in range(1, MAX_TRIES + 1):
        if DB_PATH.is_file():
            break
        if attempt % 5 == 0:
            print(
                f"  waiting for {DB_PATH} ({attempt}/{MAX_TRIES})",
                flush=True,
            )
        time.sleep(SLEEP_SECS)
    else:
        print(f"sqlite fallback: {DB_PATH} missing", flush=True)
        return False

    hashed, salt, iterations = hash_password(password)
    username_l = username.lower()
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='Users'"
            ).fetchone()
            if row is None:
                print("sqlite fallback: Users table missing", flush=True)
                return False

            existing = conn.execute(
                "SELECT Id FROM Users WHERE lower(Username) = ? LIMIT 1",
                (username_l,),
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE Users SET Password = ?, Salt = ?, Iterations = ? WHERE Id = ?",
                    (hashed, salt, iterations, existing["Id"]),
                )
            else:
                any_user = conn.execute("SELECT Id FROM Users LIMIT 1").fetchone()
                if any_user:
                    conn.execute(
                        "UPDATE Users SET Username = ?, Password = ?, Salt = ?, Iterations = ? "
                        "WHERE Id = ?",
                        (username_l, hashed, salt, iterations, any_user["Id"]),
                    )
                else:
                    conn.execute(
                        "INSERT INTO Users (Identifier, Username, Password, Salt, Iterations) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (str(uuid.uuid4()), username_l, hashed, salt, iterations),
                    )
            conn.commit()
    except sqlite3.Error as exc:
        print(f"sqlite fallback failed: {exc}", flush=True)
        return False

    print(
        f"Prowlarr Forms user ensured via sqlite (user={username}).",
        flush=True,
    )
    return True


def main() -> int:
    username, password = read_credentials()
    api_key = read_api_key()
    print("Ensuring Prowlarr Forms authentication user...", flush=True)
    wait_for_ping()
    if ensure_via_api(api_key, username, password):
        return 0
    print("API path unavailable; falling back to sqlite Users table.", flush=True)
    if ensure_via_sqlite(username, password):
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
