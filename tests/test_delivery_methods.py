"""Tests du helper `available_delivery_methods`/`is_method_allowed`
(services/delivery_methods.py) et de la route GET /api/v1/devices/{id}/methods
qui le reutilise, sans DB reelle."""

import json
import uuid

import pytest
from fastapi import HTTPException

from ferry_agent.api import devices
from ferry_agent.api.deps import CurrentUser
from ferry_agent.models import DeliveryMethod, DeliveryTier, Device, DeviceBrand
from ferry_agent.services.delivery_methods import available_delivery_methods, is_method_allowed

from tests.fakes import FakeSession


def make_device(**overrides) -> Device:
    values = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "brand": DeviceBrand.kindle,
        "delivery_tier": DeliveryTier.A,
        "link_ref": None,
    }
    values.update(overrides)
    return Device(**values)


# --- tier A (Kindle / email) -------------------------------------------------


def test_tier_a_available_when_smtp_configured() -> None:
    device = make_device(delivery_tier=DeliveryTier.A)
    methods = available_delivery_methods(device, smtp_configured=True)
    assert len(methods) == 1
    assert methods[0].method == DeliveryMethod.email
    assert methods[0].available is True
    assert methods[0].reason_code is None


def test_tier_a_unavailable_when_smtp_not_configured() -> None:
    device = make_device(delivery_tier=DeliveryTier.A)
    methods = available_delivery_methods(device, smtp_configured=False)
    assert len(methods) == 1
    assert methods[0].method == DeliveryMethod.email
    assert methods[0].available is False
    assert methods[0].reason_code == "smtp_not_configured"


# --- tier B (Kobo haut de gamme / cloud) -------------------------------------


def test_tier_b_unavailable_without_link_ref() -> None:
    device = make_device(delivery_tier=DeliveryTier.B, link_ref=None)
    methods = available_delivery_methods(device, smtp_configured=True)
    assert {m.method for m in methods} == {DeliveryMethod.dropbox, DeliveryMethod.drive}
    assert all(m.available is False and m.reason_code == "cloud_not_linked" for m in methods)


def test_tier_b_available_via_dropbox_when_linked() -> None:
    link_ref = json.dumps({"provider": "dropbox", "token": "tok"})
    device = make_device(delivery_tier=DeliveryTier.B, link_ref=link_ref)
    methods = available_delivery_methods(device, smtp_configured=True)
    assert len(methods) == 1
    assert methods[0].method == DeliveryMethod.dropbox
    assert methods[0].available is True
    assert methods[0].reason_code is None


def test_tier_b_available_via_drive_when_linked() -> None:
    link_ref = json.dumps({"provider": "drive", "refresh_token": "rt"})
    device = make_device(delivery_tier=DeliveryTier.B, link_ref=link_ref)
    methods = available_delivery_methods(device, smtp_configured=True)
    assert methods[0].method == DeliveryMethod.drive
    assert methods[0].available is True


def test_tier_b_treated_as_unlinked_when_link_ref_corrupted() -> None:
    device = make_device(delivery_tier=DeliveryTier.B, link_ref="not-json")
    methods = available_delivery_methods(device, smtp_configured=True)
    assert all(m.available is False for m in methods)


# --- tier C (mini-catalogue HTTP) --------------------------------------------


def test_tier_c_always_available() -> None:
    device = make_device(delivery_tier=DeliveryTier.C)
    methods = available_delivery_methods(device, smtp_configured=False)
    assert methods[0].method == DeliveryMethod.browser_code
    assert methods[0].available is True


# --- tier D (non implemente) --------------------------------------------------


def test_tier_d_has_no_candidate_methods() -> None:
    device = make_device(delivery_tier=DeliveryTier.D, brand=DeviceBrand.other)
    methods = available_delivery_methods(device, smtp_configured=True)
    assert methods == []


# --- is_method_allowed -------------------------------------------------------


def test_is_method_allowed_true_for_available_method() -> None:
    device = make_device(delivery_tier=DeliveryTier.C)
    assert is_method_allowed(device, DeliveryMethod.browser_code, smtp_configured=False) is True


def test_is_method_allowed_false_for_mismatched_method() -> None:
    device = make_device(delivery_tier=DeliveryTier.C)
    assert is_method_allowed(device, DeliveryMethod.email, smtp_configured=True) is False


def test_is_method_allowed_false_when_unavailable_even_if_candidate() -> None:
    device = make_device(delivery_tier=DeliveryTier.A)
    assert is_method_allowed(device, DeliveryMethod.email, smtp_configured=False) is False


# --- GET /api/v1/devices/{id}/methods ----------------------------------------


async def test_get_delivery_methods_route_returns_helper_output(monkeypatch: pytest.MonkeyPatch) -> None:
    device = make_device(delivery_tier=DeliveryTier.C)
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])
    monkeypatch.setattr(devices.mailer, "is_configured", lambda: False)

    result = await devices.get_delivery_methods(device.id, user, db)

    assert len(result) == 1
    assert result[0].method == DeliveryMethod.browser_code
    assert result[0].available is True


async def test_get_delivery_methods_404_for_other_users_device() -> None:
    device = make_device()
    other_user = CurrentUser(id=uuid.uuid4(), email="other@example.test")
    db = FakeSession([None])

    with pytest.raises(HTTPException) as exc_info:
        await devices.get_delivery_methods(device.id, other_user, db)
    assert exc_info.value.status_code == 404
