# Inventaire mécanique des contrats

36 outils ; appels directs et helpers HTTP inclus. Les clés lues ci-dessous proviennent des `.get()` ; les accès indexés et les formateurs partagés sont analysés dans le rapport. Tous les appels ajoutent `Authorization: Bearer <assertion>` et `User-Agent: ferry-agent-mcp`. JSON : Content-Type application/json ajouté par httpx ; GET/DELETE sans corps.

## search_library
`server.py:385` — `query: str, scope: list[str] | None=None`

- L401 : `client.post('/api/v1/books/search', json=body)` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"$ref": "#/components/schemas/SearchRequest"}}}, "required": true}`
  Paramètres métier : `[]`

Clés de réponse lues : `author`, `format`, `owned`, `result_id`, `size_bytes`, `source`, `title`

## add_to_library
`server.py:424` — `source: str, result_id: str`

- L435 : `client.post('/api/v1/books', json={'source': source, 'result_id': result_id})` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`

Clés de réponse lues : `author`, `status`, `title`

## list_library
`server.py:461` — `page: int=1, limit: int=50`

- L472 : `client.get('/api/v1/books', params={'page': page, 'limit': limit})` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "query", "name": "page", "required": false, "schema": {"default": 1, "minimum": 1, "title": "Page", "type": "integer"}}, {"in": "query", "name": "limit", "required": false, "schema": {"default": 50, "maximum": 200, "minimum": 1, "title": "Limit", "type": "integer"}}, {"in": "query", "name": "q", "required": false, "schema": {"anyOf": [{"type": "string"}, {"type": "null"}], "title": "Q"}}]`

Clés de réponse lues : `author`, `id`, `items`, `original_format`, `page`, `title`, `total`

## list_devices
`server.py:497` — ``

- L504 : `client.get('/api/v1/devices')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`

Clés de réponse lues : `delivery_tier`, `id`

## list_device_methods
`server.py:523` — `device_id: str`

- L534 : `client.get(f'/api/v1/devices/{device_id}/methods')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}]`

Clés de réponse lues : `available`, `method`, `reason_code`

## deliver
`server.py:555` — `item_id: str, device_id: str, confirm: bool=False, method: str | None=None, format: str | None=None`

- L652 : `client.post('/api/v1/deliveries', json=payload)` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"$ref": "#/components/schemas/DeliveryCreate"}}}, "required": true}`
  Paramètres métier : `[]`
- L588 : `client.get('/api/v1/devices')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`
- L364 : `client.get(f'/api/v1/devices/{device_id}/methods')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}]`

Clés de réponse lues : `device_label`, `download_url`, `id`, `item_title`, `method`, `status`, `target_format`

## get_delivery_status
`server.py:677` — `job_id: str`

- L687 : `client.get(f'/api/v1/deliveries/{job_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "job_id", "required": true, "schema": {"format": "uuid", "title": "Job Id", "type": "string"}}]`

Clés de réponse lues : `delivered_at`, `device_label`, `download_url`, `error`, `item_title`, `method`, `status`, `target_format`

## list_gateways
`server.py:723` — ``

- L730 : `client.get('/api/v1/gateways')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`

Clés de réponse lues : `gateway_id`, `id`, `last_seen_at`, `name`, `status`

## get_gateway_job
`server.py:751` — `job_id: str`

- L761 : `client.get(f'/api/v1/gateways/jobs/{job_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "job_id", "required": true, "schema": {"format": "uuid", "title": "Job Id", "type": "string"}}]`

Clés de réponse lues : `attempts`, `error`, `job_id`, `library_item_id`, `status`, `type`

## list_sources
`server.py:783` — ``

- L790 : `client.get('/api/v1/sources')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`

Clés de réponse lues : `enabled`, `id`, `type`

## get_profile
`server.py:807` — ``

- L814 : `client.get('/api/v1/users/me')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`

Clés de réponse lues : `default_format`, `email`, `id`, `kindle_email`

## get_mail_settings
`server.py:832` — ``

- L844 : `client.get('/api/v1/mail/settings')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`

Clés de réponse lues : `allowed_domains`, `configured`, `daily_quota`, `hourly_quota`, `reply_to`, `sender_address`

## list_opds_tokens
`server.py:878` — ``

- L885 : `client.get('/api/v1/opds/tokens')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`

Clés de réponse lues : `created_at`, `id`, `label`, `last_used_at`

## update_profile
`server.py:905` — `kindle_email: str | None=None, default_format: str | None=None, clear_kindle_email: bool=False`

- L942 : `client.patch('/api/v1/users/me', json=body)` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"title": "Body", "type": "object"}}}, "required": true}`
  Paramètres métier : `[]`

Clés de réponse lues : `default_format`, `email`, `id`, `kindle_email`

## get_device
`server.py:960` — `device_id: str`

- L970 : `client.get(f'/api/v1/devices/{device_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}]`

Clés de réponse lues : 

## add_device
`server.py:980` — `brand: str, name: str | None=None, model: str | None=None, email_address: str | None=None, conversion_profile: str | None=None`

- L1018 : `client.post('/api/v1/devices', json=body)` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"$ref": "#/components/schemas/DeviceCreate"}}}, "required": true}`
  Paramètres métier : `[]`

Clés de réponse lues : 

## update_device
`server.py:1028` — `device_id: str, name: str | None=None, brand: str | None=None, model: str | None=None, email_address: str | None=None, conversion_profile: str | None=None`

- L1069 : `client.patch(f'/api/v1/devices/{device_id}', json=body)` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"$ref": "#/components/schemas/DevicePatch"}}}, "required": true}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}]`

Clés de réponse lues : 

## remove_device
`server.py:1079` — `device_id: str, confirm: bool=False`

- L1091 : `client.get(f'/api/v1/devices/{device_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}]`
- L1104 : `client.delete(f'/api/v1/devices/{device_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}]`

Clés de réponse lues : 

## link_device_cloud
`server.py:1114` — `device_id: str, provider: str`

- L1133 : `client.get(f'/api/v1/devices/{device_id}/link', params={'provider': provider})` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}, {"in": "query", "name": "provider", "required": true, "schema": {"title": "Provider", "type": "string"}}, {"in": "query", "name": "locale", "required": false, "schema": {"anyOf": [{"type": "string"}, {"type": "null"}], "title": "Locale"}}]`

Clés de réponse lues : `url`

## set_source_enabled
`server.py:1158` — `source_id: str, enabled: bool`

- L1169 : `client.patch(f'/api/v1/sources/{source_id}', json={'enabled': enabled})` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"$ref": "#/components/schemas/SourceUpdate"}}}, "required": true}`
  Paramètres métier : `[{"in": "path", "name": "source_id", "required": true, "schema": {"format": "uuid", "title": "Source Id", "type": "string"}}]`

Clés de réponse lues : `enabled`, `id`, `type`

## list_deliveries
`server.py:1184` — `limit: int=20`

- L1197 : `client.get('/api/v1/deliveries')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`

Clés de réponse lues : `created_at`, `device_label`, `error`, `id`, `item_title`, `method`, `status`

## plan_delivery
`server.py:1240` — `item_id: str, device_id: str | None=None, format: str | None=None`

- L1258 : `client.get(f'/api/v1/books/{item_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "item_id", "required": true, "schema": {"format": "uuid", "title": "Item Id", "type": "string"}}]`
- L1262 : `client.get('/api/v1/users/me')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`
- L1266 : `client.get('/api/v1/devices')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`
- L373 : `client.get(f'/api/v1/devices/{device_id}/methods')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}]`
- L1276 : `client.get(f'/api/v1/devices/{device_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}]`

Clés de réponse lues : `available`, `brand`, `default_format`, `delivery_tier`, `email_address`, `id`, `kindle_email`, `method`, `original_format`, `reason_code`, `title`

## diagnose
`server.py:1394` — ``

- L1405 : `client.get('/api/v1/users/me')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`
- L1409 : `client.get('/api/v1/mail/settings')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`
- L1413 : `client.get('/api/v1/devices')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`
- L1419 : `client.get('/api/v1/deliveries')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`
- L373 : `client.get(f'/api/v1/devices/{device_id}/methods')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}]`

Clés de réponse lues : `allowed_domains`, `available`, `configured`, `created_at`, `daily_quota`, `device_label`, `error`, `hourly_quota`, `id`, `item_title`, `kindle_email`, `method`, `reason_code`, `sender_address`, `status`

## deliver_to_kindle
`server.py:1515` — `item_id: str, device_id: str | None=None, kindle_email: str | None=None, format: str | None=None, confirm: bool=False`

- L1550 : `client.get('/api/v1/users/me')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`
- L373 : `client.get(f'/api/v1/devices/{device_id}/methods')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}]`
- L1634 : `client.get(f'/api/v1/books/{item_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "item_id", "required": true, "schema": {"format": "uuid", "title": "Item Id", "type": "string"}}]`
- L1675 : `client.post('/api/v1/deliveries', json=payload)` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"$ref": "#/components/schemas/DeliveryCreate"}}}, "required": true}`
  Paramètres métier : `[]`
- L1543 : `client.patch('/api/v1/users/me', json={'kindle_email': kindle_email})` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"title": "Body", "type": "object"}}}, "required": true}`
  Paramètres métier : `[]`
- L1557 : `client.get(f'/api/v1/devices/{device_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "device_id", "required": true, "schema": {"format": "uuid", "title": "Device Id", "type": "string"}}]`
- L1569 : `client.get('/api/v1/devices')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`

Clés de réponse lues : `available`, `brand`, `default_format`, `device_label`, `email_address`, `id`, `item_title`, `kindle_email`, `method`, `original_format`, `reason_code`, `status`, `target_format`, `title`

## search_library_items
`server.py:1701` — `query: str, page: int=1, limit: int=20`

- L1721 : `client.get('/api/v1/books', params={'q': query, 'page': page, 'limit': limit})` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "query", "name": "page", "required": false, "schema": {"default": 1, "minimum": 1, "title": "Page", "type": "integer"}}, {"in": "query", "name": "limit", "required": false, "schema": {"default": 50, "maximum": 200, "minimum": 1, "title": "Limit", "type": "integer"}}, {"in": "query", "name": "q", "required": false, "schema": {"anyOf": [{"type": "string"}, {"type": "null"}], "title": "Q"}}]`

Clés de réponse lues : `author`, `id`, `items`, `original_format`, `page`, `title`, `total`

## update_library_item
`server.py:1750` — `item_id: str, title: str | None=None, author: str | None=None, description: str | None=None, language: str | None=None, page_count: int | None=None, publisher: str | None=None, published_year: int | None=None, isbn: str | None=None`

- L1798 : `client.patch(f'/api/v1/books/{item_id}', json=body)` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"$ref": "#/components/schemas/LibraryItemUpdate"}}}, "required": true}`
  Paramètres métier : `[{"in": "path", "name": "item_id", "required": true, "schema": {"format": "uuid", "title": "Item Id", "type": "string"}}]`

Clés de réponse lues : `author`, `id`, `isbn`, `language`, `title`

## delete_library_item
`server.py:1820` — `item_id: str, confirm: bool=False`

- L1832 : `client.get(f'/api/v1/books/{item_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "item_id", "required": true, "schema": {"format": "uuid", "title": "Item Id", "type": "string"}}]`
- L1847 : `client.delete(f'/api/v1/books/{item_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "item_id", "required": true, "schema": {"format": "uuid", "title": "Item Id", "type": "string"}}]`

Clés de réponse lues : `author`, `title`

## list_library_item_deliveries
`server.py:1857` — `item_id: str`

- L1867 : `client.get(f'/api/v1/books/{item_id}/deliveries')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "item_id", "required": true, "schema": {"format": "uuid", "title": "Item Id", "type": "string"}}]`

Clés de réponse lues : `created_at`, `device_label`, `error`, `id`, `item_title`, `method`, `status`

## download_library_item
`server.py:1912` — `item_id: str, format: str | None=None`

- L1931 : `client.post(f'/api/v1/books/{item_id}/download-link', json=body)` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"anyOf": [{"$ref": "#/components/schemas/DownloadLinkRequest"}, {"type": "null"}], "title": "Payload"}}}}`
  Paramètres métier : `[{"in": "path", "name": "item_id", "required": true, "schema": {"format": "uuid", "title": "Item Id", "type": "string"}}, {"in": "query", "name": "format", "required": false, "schema": {"anyOf": [{"type": "string"}, {"type": "null"}], "title": "Format"}}]`

Clés de réponse lues : `expires_at`, `format`, `url`

## create_gateway
`server.py:1977` — `name: str='Gateway'`

- L1987 : `client.post('/api/v1/gateways', json={'name': name})` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"anyOf": [{"$ref": "#/components/schemas/GatewayCreate"}, {"type": "null"}], "title": "Payload"}}}}`
  Paramètres métier : `[]`

Clés de réponse lues : 

## recreate_gateway
`server.py:1997` — `gateway_id: str`

- L2009 : `client.post(f'/api/v1/gateways/{gateway_id}/recreate')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "gateway_id", "required": true, "schema": {"format": "uuid", "title": "Gateway Id", "type": "string"}}]`

Clés de réponse lues : 

## revoke_gateway
`server.py:2019` — `gateway_id: str, confirm: bool=False`

- L2031 : `client.get('/api/v1/gateways')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`
- L2054 : `client.post('/api/v1/gateways/revoke', json={'gateway_id': gateway_id})` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"$ref": "#/components/schemas/GatewayRevoke"}}}, "required": true}`
  Paramètres métier : `[]`

Clés de réponse lues : `gateway_id`, `id`, `name`

## delete_gateway
`server.py:2067` — `gateway_id: str, confirm: bool=False`

- L2079 : `client.get('/api/v1/gateways')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`
- L2102 : `client.delete(f'/api/v1/gateways/{gateway_id}')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "gateway_id", "required": true, "schema": {"format": "uuid", "title": "Gateway Id", "type": "string"}}]`

Clés de réponse lues : `gateway_id`, `id`, `name`

## list_gateway_jobs
`server.py:2112` — `gateway_id: str, limit: int=20`

- L2125 : `client.get(f'/api/v1/gateways/{gateway_id}/jobs', params={'limit': limit})` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[{"in": "path", "name": "gateway_id", "required": true, "schema": {"format": "uuid", "title": "Gateway Id", "type": "string"}}, {"in": "query", "name": "limit", "required": false, "schema": {"default": 20, "maximum": 100, "minimum": 1, "title": "Limit", "type": "integer"}}]`

Clés de réponse lues : `attempts`, `error`, `id`, `job_id`, `library_item_id`, `status`, `type`

## create_opds_token
`server.py:2158` — `label: str='Liseuse'`

- L2171 : `client.post('/api/v1/opds/tokens', json={'label': label})` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"anyOf": [{"$ref": "#/components/schemas/OpdsTokenCreate"}, {"type": "null"}], "title": "Payload"}}}}`
  Paramètres métier : `[]`

Clés de réponse lues : `created_at`, `id`, `label`, `token`, `url`

## revoke_opds_token
`server.py:2196` — `token_id: str, confirm: bool=False`

- L2208 : `client.get('/api/v1/opds/tokens')` ; route présente.
  Contrat corps : `{}`
  Paramètres métier : `[]`
- L2227 : `client.post('/api/v1/opds/tokens/revoke', json={'token_id': token_id})` ; route présente.
  Contrat corps : `{"content": {"application/json": {"schema": {"$ref": "#/components/schemas/OpdsTokenRevoke"}}}, "required": true}`
  Paramètres métier : `[]`

Clés de réponse lues : `id`, `label`

# Schémas : noms, types, obligatoires

## Body_submit_fetch_result_api_v1_gateways_jobs__job_id__fetch_result_post
```json
{
  "properties": {
    "file": {
      "contentMediaType": "application/octet-stream",
      "title": "File",
      "type": "string"
    }
  },
  "required": [
    "file"
  ],
  "title": "Body_submit_fetch_result_api_v1_gateways_jobs__job_id__fetch_result_post",
  "type": "object"
}
```

## Body_upload_book_api_v1_books_upload_post
```json
{
  "properties": {
    "file": {
      "contentMediaType": "application/octet-stream",
      "title": "File",
      "type": "string"
    }
  },
  "required": [
    "file"
  ],
  "title": "Body_upload_book_api_v1_books_upload_post",
  "type": "object"
}
```

## DeliveryCreate
```json
{
  "properties": {
    "device_id": {
      "format": "uuid",
      "title": "Device Id",
      "type": "string"
    },
    "format": {
      "anyOf": [
        {
          "enum": [
            "epub",
            "mobi",
            "azw3",
            "pdf"
          ],
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Format"
    },
    "library_item_id": {
      "format": "uuid",
      "title": "Library Item Id",
      "type": "string"
    },
    "method": {
      "$ref": "#/components/schemas/DeliveryMethod",
      "default": "email"
    }
  },
  "required": [
    "library_item_id",
    "device_id"
  ],
  "title": "DeliveryCreate",
  "type": "object"
}
```

## DeliveryMethod
```json
{
  "enum": [
    "email",
    "dropbox",
    "drive",
    "browser_code",
    "usb"
  ],
  "title": "DeliveryMethod",
  "type": "string"
}
```

## DeliveryOut
```json
{
  "properties": {
    "created_at": {
      "format": "date-time",
      "title": "Created At",
      "type": "string"
    },
    "delivered_at": {
      "anyOf": [
        {
          "format": "date-time",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Delivered At"
    },
    "device_id": {
      "format": "uuid",
      "title": "Device Id",
      "type": "string"
    },
    "device_label": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Device Label"
    },
    "download_url": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Download Url"
    },
    "error": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Error"
    },
    "id": {
      "format": "uuid",
      "title": "Id",
      "type": "string"
    },
    "item_author": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Item Author"
    },
    "item_title": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Item Title"
    },
    "library_item_id": {
      "anyOf": [
        {
          "format": "uuid",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Library Item Id"
    },
    "method": {
      "$ref": "#/components/schemas/DeliveryMethod"
    },
    "status": {
      "$ref": "#/components/schemas/DeliveryStatus"
    },
    "target_format": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Target Format"
    }
  },
  "required": [
    "id",
    "device_id",
    "status",
    "method",
    "created_at",
    "delivered_at",
    "error"
  ],
  "title": "DeliveryOut",
  "type": "object"
}
```

## DeliveryStatus
```json
{
  "enum": [
    "queued",
    "sent",
    "delivered",
    "failed"
  ],
  "title": "DeliveryStatus",
  "type": "string"
}
```

## DeliveryTier
```json
{
  "enum": [
    "A",
    "B",
    "C",
    "D"
  ],
  "title": "DeliveryTier",
  "type": "string"
}
```

## DeviceBrand
```json
{
  "enum": [
    "kindle",
    "kobo",
    "tolino",
    "pocketbook",
    "other"
  ],
  "title": "DeviceBrand",
  "type": "string"
}
```

## DeviceCreate
```json
{
  "description": "Pas de `delivery_tier` ici : le tier est toujours calcule cote serveur\ndepuis `brand`/`model` (voir `api.devices._compute_tier`), jamais choisi\na la main par le client (extra fields ignores par defaut par pydantic).",
  "properties": {
    "brand": {
      "$ref": "#/components/schemas/DeviceBrand"
    },
    "conversion_profile": {
      "anyOf": [
        {
          "enum": [
            "reader_6in",
            "reader_7in_plus",
            "tablet"
          ],
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Conversion Profile"
    },
    "email_address": {
      "anyOf": [
        {
          "format": "email",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Email Address"
    },
    "model": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Model"
    },
    "name": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Name"
    }
  },
  "required": [
    "brand"
  ],
  "title": "DeviceCreate",
  "type": "object"
}
```

## DeviceLinkCallback
```json
{
  "properties": {
    "code": {
      "minLength": 1,
      "title": "Code",
      "type": "string"
    },
    "provider": {
      "title": "Provider",
      "type": "string"
    }
  },
  "required": [
    "provider",
    "code"
  ],
  "title": "DeviceLinkCallback",
  "type": "object"
}
```

## DeviceLinkUrlOut
```json
{
  "properties": {
    "url": {
      "title": "Url",
      "type": "string"
    }
  },
  "required": [
    "url"
  ],
  "title": "DeviceLinkUrlOut",
  "type": "object"
}
```

## DeviceOut
```json
{
  "properties": {
    "brand": {
      "$ref": "#/components/schemas/DeviceBrand"
    },
    "cloud_linked": {
      "default": false,
      "title": "Cloud Linked",
      "type": "boolean"
    },
    "cloud_provider": {
      "anyOf": [
        {
          "enum": [
            "dropbox",
            "drive"
          ],
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Cloud Provider"
    },
    "conversion_profile": {
      "anyOf": [
        {
          "enum": [
            "reader_6in",
            "reader_7in_plus",
            "tablet"
          ],
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Conversion Profile"
    },
    "delivery_tier": {
      "$ref": "#/components/schemas/DeliveryTier"
    },
    "email_address": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Email Address"
    },
    "id": {
      "format": "uuid",
      "title": "Id",
      "type": "string"
    },
    "last_synced_at": {
      "anyOf": [
        {
          "format": "date-time",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Last Synced At"
    },
    "model": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Model"
    },
    "name": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Name"
    }
  },
  "required": [
    "id",
    "name",
    "brand",
    "model",
    "delivery_tier",
    "last_synced_at"
  ],
  "title": "DeviceOut",
  "type": "object"
}
```

## DevicePatch
```json
{
  "properties": {
    "brand": {
      "anyOf": [
        {
          "$ref": "#/components/schemas/DeviceBrand"
        },
        {
          "type": "null"
        }
      ]
    },
    "conversion_profile": {
      "anyOf": [
        {
          "enum": [
            "reader_6in",
            "reader_7in_plus",
            "tablet"
          ],
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Conversion Profile"
    },
    "email_address": {
      "anyOf": [
        {
          "format": "email",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Email Address"
    },
    "model": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Model"
    },
    "name": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Name"
    }
  },
  "title": "DevicePatch",
  "type": "object"
}
```

## DownloadLinkOut
```json
{
  "properties": {
    "expires_at": {
      "format": "date-time",
      "title": "Expires At",
      "type": "string"
    },
    "format": {
      "title": "Format",
      "type": "string"
    },
    "url": {
      "title": "Url",
      "type": "string"
    }
  },
  "required": [
    "url",
    "expires_at",
    "format"
  ],
  "title": "DownloadLinkOut",
  "type": "object"
}
```

## DownloadLinkRequest
```json
{
  "properties": {
    "format": {
      "anyOf": [
        {
          "enum": [
            "epub",
            "mobi",
            "azw3",
            "pdf"
          ],
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Format"
    }
  },
  "title": "DownloadLinkRequest",
  "type": "object"
}
```

## GatewayCreate
```json
{
  "properties": {
    "name": {
      "default": "Gateway",
      "maxLength": 120,
      "minLength": 1,
      "title": "Name",
      "type": "string"
    }
  },
  "title": "GatewayCreate",
  "type": "object"
}
```

## GatewayCredentials
```json
{
  "properties": {
    "gateway_id": {
      "format": "uuid",
      "title": "Gateway Id",
      "type": "string"
    },
    "gateway_key": {
      "title": "Gateway Key",
      "type": "string"
    },
    "gateway_online_seconds": {
      "default": 60,
      "title": "Gateway Online Seconds",
      "type": "integer"
    },
    "pairing_expires_at": {
      "anyOf": [
        {
          "format": "date-time",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Pairing Expires At"
    },
    "pairing_token": {
      "title": "Pairing Token",
      "type": "string"
    },
    "pairing_token_ttl_minutes": {
      "default": 15,
      "title": "Pairing Token Ttl Minutes",
      "type": "integer"
    }
  },
  "required": [
    "gateway_id",
    "pairing_token",
    "gateway_key"
  ],
  "title": "GatewayCredentials",
  "type": "object"
}
```

## GatewayFetchQueued
```json
{
  "properties": {
    "gateway_job_id": {
      "format": "uuid",
      "title": "Gateway Job Id",
      "type": "string"
    },
    "status": {
      "$ref": "#/components/schemas/GatewayJobStatus"
    }
  },
  "required": [
    "gateway_job_id",
    "status"
  ],
  "title": "GatewayFetchQueued",
  "type": "object"
}
```

## GatewayFetchResult
```json
{
  "properties": {
    "library_item_id": {
      "format": "uuid",
      "title": "Library Item Id",
      "type": "string"
    }
  },
  "required": [
    "library_item_id"
  ],
  "title": "GatewayFetchResult",
  "type": "object"
}
```

## GatewayId
```json
{
  "properties": {
    "gateway_id": {
      "format": "uuid",
      "title": "Gateway Id",
      "type": "string"
    }
  },
  "required": [
    "gateway_id"
  ],
  "title": "GatewayId",
  "type": "object"
}
```

## GatewayJobAck
```json
{
  "properties": {
    "job_id": {
      "format": "uuid",
      "title": "Job Id",
      "type": "string"
    },
    "status": {
      "$ref": "#/components/schemas/GatewayJobStatus"
    }
  },
  "required": [
    "job_id",
    "status"
  ],
  "title": "GatewayJobAck",
  "type": "object"
}
```

## GatewayJobOut
```json
{
  "properties": {
    "job_id": {
      "format": "uuid",
      "title": "Job Id",
      "type": "string"
    },
    "payload": {
      "title": "Payload",
      "type": "object"
    },
    "status": {
      "$ref": "#/components/schemas/GatewayJobStatus"
    },
    "type": {
      "$ref": "#/components/schemas/GatewayJobType"
    }
  },
  "required": [
    "job_id",
    "type",
    "payload",
    "status"
  ],
  "title": "GatewayJobOut",
  "type": "object"
}
```

## GatewayJobStatus
```json
{
  "enum": [
    "pending",
    "queued",
    "running",
    "done",
    "failed"
  ],
  "title": "GatewayJobStatus",
  "type": "string"
}
```

## GatewayJobStatusOut
```json
{
  "properties": {
    "attempts": {
      "default": 0,
      "title": "Attempts",
      "type": "integer"
    },
    "error": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Error"
    },
    "job_id": {
      "format": "uuid",
      "title": "Job Id",
      "type": "string"
    },
    "library_item_id": {
      "anyOf": [
        {
          "format": "uuid",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Library Item Id"
    },
    "payload": {
      "title": "Payload",
      "type": "object"
    },
    "status": {
      "$ref": "#/components/schemas/GatewayJobStatus"
    },
    "type": {
      "$ref": "#/components/schemas/GatewayJobType"
    }
  },
  "required": [
    "job_id",
    "type",
    "payload",
    "status"
  ],
  "title": "GatewayJobStatusOut",
  "type": "object"
}
```

## GatewayJobType
```json
{
  "enum": [
    "search",
    "fetch"
  ],
  "title": "GatewayJobType",
  "type": "string"
}
```

## GatewayOut
```json
{
  "properties": {
    "gateway_id": {
      "format": "uuid",
      "title": "Gateway Id",
      "type": "string"
    },
    "gateway_online_seconds": {
      "default": 60,
      "title": "Gateway Online Seconds",
      "type": "integer"
    },
    "last_seen_at": {
      "anyOf": [
        {
          "format": "date-time",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Last Seen At"
    },
    "name": {
      "title": "Name",
      "type": "string"
    },
    "pairing_expires_at": {
      "anyOf": [
        {
          "format": "date-time",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Pairing Expires At"
    },
    "pairing_token_ttl_minutes": {
      "default": 15,
      "title": "Pairing Token Ttl Minutes",
      "type": "integer"
    },
    "status": {
      "$ref": "#/components/schemas/PairingStatus"
    }
  },
  "required": [
    "gateway_id",
    "name",
    "status",
    "last_seen_at"
  ],
  "title": "GatewayOut",
  "type": "object"
}
```

## GatewayPair
```json
{
  "properties": {
    "pairing_token": {
      "minLength": 16,
      "title": "Pairing Token",
      "type": "string"
    }
  },
  "required": [
    "pairing_token"
  ],
  "title": "GatewayPair",
  "type": "object"
}
```

## GatewayRevoke
```json
{
  "properties": {
    "gateway_id": {
      "format": "uuid",
      "title": "Gateway Id",
      "type": "string"
    }
  },
  "required": [
    "gateway_id"
  ],
  "title": "GatewayRevoke",
  "type": "object"
}
```

## HTTPValidationError
```json
{
  "properties": {
    "detail": {
      "items": {
        "$ref": "#/components/schemas/ValidationError"
      },
      "title": "Detail",
      "type": "array"
    }
  },
  "title": "HTTPValidationError",
  "type": "object"
}
```

## LibraryItemOut
```json
{
  "properties": {
    "added_at": {
      "format": "date-time",
      "title": "Added At",
      "type": "string"
    },
    "author": {
      "title": "Author",
      "type": "string"
    },
    "cover_url": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Cover Url"
    },
    "description": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Description"
    },
    "id": {
      "format": "uuid",
      "title": "Id",
      "type": "string"
    },
    "isbn": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Isbn"
    },
    "language": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Language"
    },
    "original_format": {
      "title": "Original Format",
      "type": "string"
    },
    "page_count": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "title": "Page Count"
    },
    "published_year": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "title": "Published Year"
    },
    "publisher": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Publisher"
    },
    "size_bytes": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "title": "Size Bytes"
    },
    "source_id": {
      "anyOf": [
        {
          "format": "uuid",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Source Id"
    },
    "source_ref": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Source Ref"
    },
    "title": {
      "title": "Title",
      "type": "string"
    }
  },
  "required": [
    "id",
    "title",
    "author",
    "cover_url",
    "source_id",
    "original_format",
    "added_at"
  ],
  "title": "LibraryItemOut",
  "type": "object"
}
```

## LibraryItemUpdate
```json
{
  "properties": {
    "author": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Author"
    },
    "description": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Description"
    },
    "isbn": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Isbn"
    },
    "language": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Language"
    },
    "page_count": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "title": "Page Count"
    },
    "published_year": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "title": "Published Year"
    },
    "publisher": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Publisher"
    },
    "title": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Title"
    }
  },
  "title": "LibraryItemUpdate",
  "type": "object"
}
```

## MailSettingsOut
```json
{
  "description": "Reglages d'envoi visibles par l'utilisateur (pas d'hote/port/identifiants SMTP).",
  "properties": {
    "allowed_domains": {
      "items": {
        "type": "string"
      },
      "title": "Allowed Domains",
      "type": "array"
    },
    "configured": {
      "title": "Configured",
      "type": "boolean"
    },
    "daily_quota": {
      "title": "Daily Quota",
      "type": "integer"
    },
    "hourly_quota": {
      "title": "Hourly Quota",
      "type": "integer"
    },
    "reply_to": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Reply To"
    },
    "sender_address": {
      "title": "Sender Address",
      "type": "string"
    }
  },
  "required": [
    "configured",
    "sender_address",
    "reply_to",
    "allowed_domains",
    "hourly_quota",
    "daily_quota"
  ],
  "title": "MailSettingsOut",
  "type": "object"
}
```

## MethodAvailability
```json
{
  "properties": {
    "available": {
      "title": "Available",
      "type": "boolean"
    },
    "method": {
      "$ref": "#/components/schemas/DeliveryMethod"
    },
    "reason_code": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Reason Code"
    }
  },
  "required": [
    "method",
    "available"
  ],
  "title": "MethodAvailability",
  "type": "object"
}
```

## OpdsTokenCreate
```json
{
  "properties": {
    "label": {
      "default": "Liseuse",
      "maxLength": 120,
      "minLength": 1,
      "title": "Label",
      "type": "string"
    }
  },
  "title": "OpdsTokenCreate",
  "type": "object"
}
```

## OpdsTokenCreated
```json
{
  "properties": {
    "created_at": {
      "format": "date-time",
      "title": "Created At",
      "type": "string"
    },
    "id": {
      "format": "uuid",
      "title": "Id",
      "type": "string"
    },
    "label": {
      "title": "Label",
      "type": "string"
    },
    "token": {
      "title": "Token",
      "type": "string"
    },
    "url": {
      "title": "Url",
      "type": "string"
    }
  },
  "required": [
    "id",
    "label",
    "token",
    "url",
    "created_at"
  ],
  "title": "OpdsTokenCreated",
  "type": "object"
}
```

## OpdsTokenOut
```json
{
  "properties": {
    "created_at": {
      "format": "date-time",
      "title": "Created At",
      "type": "string"
    },
    "id": {
      "format": "uuid",
      "title": "Id",
      "type": "string"
    },
    "label": {
      "title": "Label",
      "type": "string"
    },
    "last_used_at": {
      "anyOf": [
        {
          "format": "date-time",
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Last Used At"
    }
  },
  "required": [
    "id",
    "label",
    "created_at",
    "last_used_at"
  ],
  "title": "OpdsTokenOut",
  "type": "object"
}
```

## OpdsTokenRevoke
```json
{
  "properties": {
    "token_id": {
      "format": "uuid",
      "title": "Token Id",
      "type": "string"
    }
  },
  "required": [
    "token_id"
  ],
  "title": "OpdsTokenRevoke",
  "type": "object"
}
```

## PaginatedLibraryItems
```json
{
  "properties": {
    "items": {
      "items": {
        "$ref": "#/components/schemas/LibraryItemOut"
      },
      "title": "Items",
      "type": "array"
    },
    "limit": {
      "title": "Limit",
      "type": "integer"
    },
    "page": {
      "title": "Page",
      "type": "integer"
    },
    "total": {
      "title": "Total",
      "type": "integer"
    }
  },
  "required": [
    "items",
    "total",
    "page",
    "limit"
  ],
  "title": "PaginatedLibraryItems",
  "type": "object"
}
```

## PairingStatus
```json
{
  "enum": [
    "pending",
    "paired",
    "revoked"
  ],
  "title": "PairingStatus",
  "type": "string"
}
```

## Result
```json
{
  "properties": {
    "author": {
      "default": "",
      "title": "Author",
      "type": "string"
    },
    "cover_url": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Cover Url"
    },
    "description": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Description"
    },
    "format": {
      "default": "epub",
      "title": "Format",
      "type": "string"
    },
    "guid": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Guid"
    },
    "indexer_id": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Indexer Id"
    },
    "isbn": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Isbn"
    },
    "language": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Language"
    },
    "magnet_url": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Magnet Url"
    },
    "page_count": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "title": "Page Count"
    },
    "result_id": {
      "title": "Result Id",
      "type": "string"
    },
    "seeders": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "title": "Seeders"
    },
    "size_bytes": {
      "default": 0,
      "title": "Size Bytes",
      "type": "integer"
    },
    "source": {
      "title": "Source",
      "type": "string"
    },
    "title": {
      "title": "Title",
      "type": "string"
    }
  },
  "required": [
    "source",
    "title",
    "result_id"
  ],
  "title": "Result",
  "type": "object"
}
```

## ResultOut
```json
{
  "properties": {
    "author": {
      "default": "",
      "title": "Author",
      "type": "string"
    },
    "cover_url": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Cover Url"
    },
    "description": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Description"
    },
    "format": {
      "default": "epub",
      "title": "Format",
      "type": "string"
    },
    "guid": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Guid"
    },
    "indexer_id": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Indexer Id"
    },
    "isbn": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Isbn"
    },
    "language": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Language"
    },
    "magnet_url": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Magnet Url"
    },
    "owned": {
      "default": false,
      "title": "Owned",
      "type": "boolean"
    },
    "page_count": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "title": "Page Count"
    },
    "result_id": {
      "title": "Result Id",
      "type": "string"
    },
    "seeders": {
      "anyOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ],
      "title": "Seeders"
    },
    "size_bytes": {
      "default": 0,
      "title": "Size Bytes",
      "type": "integer"
    },
    "source": {
      "title": "Source",
      "type": "string"
    },
    "title": {
      "title": "Title",
      "type": "string"
    }
  },
  "required": [
    "source",
    "title",
    "result_id"
  ],
  "title": "ResultOut",
  "type": "object"
}
```

## SearchRequest
```json
{
  "properties": {
    "query": {
      "title": "Query",
      "type": "string"
    },
    "scope": {
      "anyOf": [
        {
          "items": {
            "type": "string"
          },
          "type": "array"
        },
        {
          "type": "null"
        }
      ],
      "title": "Scope"
    }
  },
  "required": [
    "query"
  ],
  "title": "SearchRequest",
  "type": "object"
}
```

## SearchResults
```json
{
  "description": "Liste JSON nue acceptee depuis le gateway-agent.",
  "items": {
    "$ref": "#/components/schemas/Result"
  },
  "title": "SearchResults",
  "type": "array"
}
```

## SourceOut
```json
{
  "properties": {
    "created_at": {
      "format": "date-time",
      "title": "Created At",
      "type": "string"
    },
    "enabled": {
      "title": "Enabled",
      "type": "boolean"
    },
    "id": {
      "format": "uuid",
      "title": "Id",
      "type": "string"
    },
    "type": {
      "title": "Type",
      "type": "string"
    }
  },
  "required": [
    "id",
    "type",
    "created_at",
    "enabled"
  ],
  "title": "SourceOut",
  "type": "object"
}
```

## SourceUpdate
```json
{
  "properties": {
    "enabled": {
      "title": "Enabled",
      "type": "boolean"
    }
  },
  "required": [
    "enabled"
  ],
  "title": "SourceUpdate",
  "type": "object"
}
```

## UserOut
```json
{
  "properties": {
    "default_format": {
      "title": "Default Format",
      "type": "string"
    },
    "email": {
      "title": "Email",
      "type": "string"
    },
    "id": {
      "format": "uuid",
      "title": "Id",
      "type": "string"
    },
    "kindle_email": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ],
      "title": "Kindle Email"
    }
  },
  "required": [
    "id",
    "email",
    "kindle_email",
    "default_format"
  ],
  "title": "UserOut",
  "type": "object"
}
```

## ValidationError
```json
{
  "properties": {
    "ctx": {
      "title": "Context",
      "type": "object"
    },
    "input": {
      "title": "Input"
    },
    "loc": {
      "items": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "integer"
          }
        ]
      },
      "title": "Location",
      "type": "array"
    },
    "msg": {
      "title": "Message",
      "type": "string"
    },
    "type": {
      "title": "Error Type",
      "type": "string"
    }
  },
  "required": [
    "loc",
    "msg",
    "type"
  ],
  "title": "ValidationError",
  "type": "object"
}
```
