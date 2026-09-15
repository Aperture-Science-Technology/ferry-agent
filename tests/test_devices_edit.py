"""Tests de PATCH /api/v1/devices/{device_id} (rename/edition d'appareil).

Meme approche que test_devices_link.py : FakeSession sans DB reelle, un
seul resultat `execute()` en file (le SELECT de `_get_owned_device`)."""

import uuid

import pytest
from fastapi import HTTPException

from ferry_agent.api import devices
from ferry_agent.api.deps import CurrentUser
from ferry_agent.models import Device, DeviceBrand, DeliveryTier
from ferry_agent.schemas import DevicePatch

from tests.fakes import FakeSession


def make_device(**overrides) -> Device:
    values = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "name": None,
        "brand": DeviceBrand.kobo,
        "model": "Clara",
        "delivery_tier": DeliveryTier.C,
        "link_ref": None,
    }
    values.update(overrides)
    return Device(**values)


async def test_update_device_renames_without_touching_tier() -> None:
    device = make_device(delivery_tier=DeliveryTier.C)
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    out = await devices.update_device(device.id, DevicePatch(name="Ma liseuse"), user, db)

    assert out.name == "Ma liseuse"
    assert out.delivery_tier == DeliveryTier.C
    assert db.commits == 1


async def test_update_device_recomputes_tier_when_model_changes() -> None:
    device = make_device(brand=DeviceBrand.kobo, model="Clara", delivery_tier=DeliveryTier.C)
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    out = await devices.update_device(device.id, DevicePatch(model="Forma"), user, db)

    assert out.model == "Forma"
    assert out.delivery_tier == DeliveryTier.B  # Forma est dans _KOBO_HIGH_END


async def test_update_device_recomputes_tier_when_brand_changes() -> None:
    device = make_device(brand=DeviceBrand.kobo, model=None, delivery_tier=DeliveryTier.C)
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    out = await devices.update_device(device.id, DevicePatch(brand=DeviceBrand.kindle), user, db)

    assert out.brand == DeviceBrand.kindle
    assert out.delivery_tier == DeliveryTier.A


async def test_update_device_can_clear_name_to_null() -> None:
    """Regression : exclude_defaults=True empechait d'effacer name/model car
    `None` est aussi leur valeur par defaut sur DevicePatch."""
    device = make_device(name="Ancien nom")
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    out = await devices.update_device(device.id, DevicePatch(name=None), user, db)

    assert out.name is None


async def test_update_device_can_clear_model_and_conversion_profile_to_null() -> None:
    device = make_device(model="Clara", name="Salon")
    # Simuler un profil deja stocke (forme API apres resolve)
    device.conversion_profile = {"preset": "reader_6in"}
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    out = await devices.update_device(
        device.id,
        DevicePatch(model=None, conversion_profile=None),
        user,
        db,
    )

    assert out.model is None
    assert out.conversion_profile is None
    assert device.conversion_profile is None

async def test_update_device_leaves_tier_unchanged_when_brand_and_model_unset() -> None:
    device = make_device(brand=DeviceBrand.kobo, model="Clara", delivery_tier=DeliveryTier.C)
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    await devices.update_device(device.id, DevicePatch(name="Juste un nom"), user, db)

    assert device.delivery_tier == DeliveryTier.C


async def test_update_device_404_for_other_users_device() -> None:
    device = make_device()
    other_user = CurrentUser(id=uuid.uuid4(), email="other@example.test")
    db = FakeSession([None])  # requete filtree par user_id -> rien trouve

    with pytest.raises(HTTPException) as exc_info:
        await devices.update_device(device.id, DevicePatch(name="Nope"), other_user, db)
    assert exc_info.value.status_code == 404
