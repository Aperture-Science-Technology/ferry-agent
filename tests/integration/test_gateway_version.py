"""Gateway poll version survives a real database round trip."""


async def test_poll_persists_version_and_missing_header_preserves_it(client, db_session):
    created = await client.post("/api/v1/gateways", json={"name": "Home"})
    credentials = created.json()
    paired = await client.post("/api/v1/gateways/pair", json={"token": credentials["pairing_token"]})
    assert paired.status_code == 200
    headers = {"X-Gateway-Key": credentials["gateway_key"]}
    response = await client.post("/api/v1/gateways/poll", headers={**headers, "X-Gateway-Version": "0.1.2"})
    assert response.status_code == 204
    db_session.expire_all()
    listed = (await client.get("/api/v1/gateways")).json()
    assert listed[0]["agent_version"] == "0.1.2"
    assert (await client.post("/api/v1/gateways/poll", headers=headers)).status_code == 204
    db_session.expire_all()
    listed = (await client.get("/api/v1/gateways")).json()
    assert listed[0]["agent_version"] == "0.1.2"
