/**
 * Types API lisibles + types purement UI.
 *
 * Les schemas API viennent de `api-types.generated.ts` (openapi-typescript).
 * Regenerer : `cd web && npm run gen:types`.
 */
import type { components } from "./api-types.generated";

type Schemas = components["schemas"];

export type DeviceBrand = Schemas["DeviceBrand"];
export type DeliveryTier = Schemas["DeliveryTier"];
export type DeliveryStatus = Schemas["DeliveryStatus"];
export type DeliveryMethod = Schemas["DeliveryMethod"];
export type PairingStatus = Schemas["PairingStatus"];
export type GatewayJobType = Schemas["GatewayJobType"];
export type GatewayJobStatus = Schemas["GatewayJobStatus"];
/** Derive du champ API (Literal inline OpenAPI, pas de schema nomme). */
export type ConversionPreset = NonNullable<Schemas["DeviceOut"]["conversion_profile"]>;

/** Alias ergonomiques (schemas OpenAPI verbeux). */
export type SearchResult = Schemas["ResultOut"];
export type LibraryItem = Schemas["LibraryItemOut"];
export type PaginatedLibraryItems = Schemas["PaginatedLibraryItems"];
/**
 * OpenAPI marque `conversion_profile` optionnel (defaut pydantic) ;
 * le runtime l'envoie toujours (nullable).
 */
export type Device = Omit<Schemas["DeviceOut"], "conversion_profile"> & {
  conversion_profile: ConversionPreset | null;
};
export type DeviceCreate = Schemas["DeviceCreate"];
export type DevicePatch = Schemas["DevicePatch"];
export type Gateway = Schemas["GatewayOut"];
export type GatewayCredentials = Schemas["GatewayCredentials"];
export type GatewayJobStatusOut = Schemas["GatewayJobStatusOut"];
export type DeliveryJob = Schemas["DeliveryOut"];
export type MethodAvailability = Schemas["MethodAvailability"];
export type Source = Schemas["SourceOut"];
export type OpdsToken = Schemas["OpdsTokenOut"];
export type OpdsTokenCreated = Schemas["OpdsTokenCreated"];

/**
 * UI-only : `SourceOut.type` est un `string` libre cote OpenAPI ;
 * l'union borne les providers connus du frontend.
 */
export type SourceType =
  | "upload"
  | "gutenberg"
  | "standard_ebooks"
  | "opds"
  | "torrent_gateway";

/**
 * UI-only : codes `reason_code` stables (voir GET /devices/{id}/methods
 * et services/delivery_methods.py), traduits cote frontend.
 */
export type DeliveryMethodReasonCode = "smtp_not_configured" | "cloud_not_linked";
