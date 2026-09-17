"""GitFlow CI PR-gate policy (FA-CI-PR-GATES-01).

Asserts event→outcome contracts for validation triggers and publish guards.
This is not a mirror of the workflow YAML: it encodes GitHub branch-filter
semantics and evaluates the publish `if` expressions used in this repo.

The pre-change policy (PR/push bases = main only) fails these contracts;
the post-change policy (develop + main) must pass. Publish must stay off
for develop and feature refs.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from yaml.loader import SafeLoader

REPO_ROOT = Path(__file__).resolve().parents[2]
CI_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "ci.yml"
SECRETS_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "secrets.yml"

# GitFlow bases that must receive blocking validation CI.
REQUIRED_VALIDATION_BASES = ("develop", "main")

# Refs that must never publish production images from this workflow.
FORBIDDEN_PUBLISH_REFS = (
    "refs/heads/develop",
    "refs/heads/feature/FA-CI-PR-GATES-01",
    "refs/heads/feature/anything",
)

PUBLISH_JOBS = (
    "build-push-core",
    "build-push-web",
    "build-push-mcp-server",
    "build-push-gateway",
)


class _GHActionsLoader(SafeLoader):
    """PyYAML 1.1 treats `on`/`off` as bools; keep workflow keys as strings."""


for _ch in list(_GHActionsLoader.yaml_implicit_resolvers):
    _GHActionsLoader.yaml_implicit_resolvers[_ch] = [
        (tag, regexp)
        for tag, regexp in _GHActionsLoader.yaml_implicit_resolvers[_ch]
        if tag != "tag:yaml.org,2002:bool"
    ]


def _load_workflow(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        data = yaml.load(fh, Loader=_GHActionsLoader)
    if not isinstance(data, dict) or "on" not in data:
        raise AssertionError(f"{path}: missing workflow `on` trigger map")
    return data


def _fnmatch_branch(name: str, pattern: str) -> bool:
    """Minimal GitHub branch-filter matcher (*, **, ?)."""
    if pattern == "**" or pattern == "*":
        return True
    if "*" not in pattern and "?" not in pattern:
        return name == pattern
    # Convert a single glob segment; `**` already handled.
    import fnmatch

    return fnmatch.fnmatchcase(name, pattern)


def triggers_on_push(on: dict, branch: str) -> bool:
    if "push" not in on:
        return False
    push = on["push"]
    if push is None:
        return True
    branches = push.get("branches")
    if branches is None:
        # push present without branches ⇒ all branches (tags may still be separate).
        return True
    return any(_fnmatch_branch(branch, p) for p in branches)


def triggers_on_pull_request(on: dict, base_branch: str) -> bool:
    if "pull_request" not in on:
        return False
    pr = on["pull_request"]
    if pr is None:
        return True
    branches = pr.get("branches")
    if branches is None:
        return True
    return any(_fnmatch_branch(base_branch, p) for p in branches)


def publish_if_allows(expr: str | None, ref: str) -> bool:
    """Evaluate the narrow subset of `if:` expressions used by publish jobs."""
    if expr is None or str(expr).strip() == "":
        return True
    text = " ".join(str(expr).split())
    # Split on top-level || (jobs here only use ||, not &&).
    parts = [p.strip() for p in text.split("||")]
    for part in parts:
        if part == f"github.ref == 'refs/heads/main'" and ref == "refs/heads/main":
            return True
        if part == f'github.ref == "refs/heads/main"' and ref == "refs/heads/main":
            return True
        if part == f"github.ref == 'refs/heads/develop'" and ref == "refs/heads/develop":
            return True
        if part.startswith("startsWith(github.ref, 'refs/tags/v')") and ref.startswith(
            "refs/tags/v"
        ):
            return True
        if part.startswith('startsWith(github.ref, "refs/tags/v")') and ref.startswith(
            "refs/tags/v"
        ):
            return True
    return False


@pytest.fixture(scope="module")
def ci() -> dict:
    return _load_workflow(CI_WORKFLOW)


@pytest.fixture(scope="module")
def secrets_wf() -> dict:
    return _load_workflow(SECRETS_WORKFLOW)


@pytest.mark.parametrize("base", REQUIRED_VALIDATION_BASES)
def test_pr_to_gitflow_base_triggers_validation(ci: dict, base: str) -> None:
    assert triggers_on_pull_request(ci["on"], base), (
        f"PR targeting `{base}` must trigger CI validation (GitFlow PR gates)"
    )


@pytest.mark.parametrize("base", REQUIRED_VALIDATION_BASES)
def test_push_to_gitflow_base_triggers_validation(ci: dict, base: str) -> None:
    assert triggers_on_push(ci["on"], base), (
        f"push to `{base}` must trigger CI validation"
    )


def test_feature_branch_push_does_not_trigger_workflow(ci: dict) -> None:
    assert not triggers_on_push(ci["on"], "feature/FA-CI-PR-GATES-01")
    assert not triggers_on_push(ci["on"], "feature/anything")


@pytest.mark.parametrize("job", PUBLISH_JOBS)
@pytest.mark.parametrize("ref", FORBIDDEN_PUBLISH_REFS)
def test_publish_jobs_skip_develop_and_feature(ci: dict, job: str, ref: str) -> None:
    spec = ci["jobs"][job]
    assert not publish_if_allows(spec.get("if"), ref), (
        f"{job} must not publish for ref={ref!r} (got if={spec.get('if')!r})"
    )


@pytest.mark.parametrize("job", PUBLISH_JOBS)
def test_publish_jobs_still_allow_main(ci: dict, job: str) -> None:
    spec = ci["jobs"][job]
    assert publish_if_allows(spec.get("if"), "refs/heads/main"), (
        f"{job} must remain publishable from main"
    )


def test_ci_push_filter_is_not_unrestricted_glob(ci: dict) -> None:
    """Guard against re-enabling `branches: ['**']` which runs on every feature push."""
    push = ci["on"]["push"]
    assert push is not None and "branches" in push
    branches = push["branches"]
    assert "**" not in branches and "*" not in branches


@pytest.mark.parametrize("base", REQUIRED_VALIDATION_BASES)
def test_secrets_workflow_tracks_same_pr_bases(secrets_wf: dict, base: str) -> None:
    assert triggers_on_pull_request(secrets_wf["on"], base)


@pytest.mark.parametrize("base", REQUIRED_VALIDATION_BASES)
def test_secrets_workflow_tracks_same_push_bases(secrets_wf: dict, base: str) -> None:
    assert triggers_on_push(secrets_wf["on"], base)


def test_old_main_only_policy_fails_develop_pr_contract() -> None:
    """Regression discriminator: main-only `on` must fail the develop PR gate."""
    old_on = {
        "push": {"branches": ["main"]},
        "pull_request": {"branches": ["main"]},
    }
    assert triggers_on_pull_request(old_on, "main")
    assert not triggers_on_pull_request(old_on, "develop"), (
        "discriminator broken: old policy unexpectedly allows develop PRs"
    )
