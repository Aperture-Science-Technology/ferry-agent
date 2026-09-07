export type DeviceBrand = "kindle" | "kobo" | "tolino" | "pocketbook" | "other";
export type DeliveryTier = "A" | "B" | "C" | "D";
export type DeliveryStatus = "queued" | "sent" | "delivered" | "failed";
export type DeliveryMethod = "email" | "dropbox" | "drive" | "browser_code" | "usb";
export type PairingStatus = "pending" | "paired" | "revoked";
export type ConversionPreset = "reader_6in" | "reader_7in_plus" | "tablet";
export type SourceType =
  | "upload"
  | "gutenberg"
  | "standard_ebooks"
  | "opds"
  | "torrent_gateway";

export interface SearchResult {
  source: string;
  title: string;
  result_id: string;
  author: string;
  format: string;
  size_bytes: number;
  magnet_url?: string | null;
  indexer_id?: number | string | null;
  guid?: string | null;
  seeders?: number | null;
  cover_url?: string | null;
  language?: string | null;
  isbn?: string | null;
  owned?: boolean;
}

export interface LibraryItem {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  source_id: string | null;
  original_format: string;
  added_at: string;
  description: string | null;
  language: string | null;
  page_count: number | null;
  size_bytes: number | null;
  isbn: string | null;
  publisher: string | null;
  published_year: number | null;
  source_ref: string | null;
}

export interface PaginatedLibraryItems {
  items: LibraryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface OpdsToken {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
}

export interface OpdsTokenCreated {
  id: string;
  label: string;
  token: string;
  url: string;
  created_at: string;
}

export interface Device {
  id: string;
  name: string | null;
  brand: DeviceBrand;
  model: string | null;
  delivery_tier: DeliveryTier;
  conversion_profile: ConversionPreset | null;
  cloud_provider: "dropbox" | "drive" | null;
  cloud_linked: boolean;
  last_synced_at: string | null;
}

export interface DeviceCreate {
  name?: string | null;
  brand: DeviceBrand;
  model?: string | null;
  conversion_profile?: ConversionPreset | null;
}

export interface DevicePatch {
  name?: string | null;
  brand?: DeviceBrand;
  model?: string | null;
  conversion_profile?: ConversionPreset | null;
}

export interface Gateway {
  gateway_id: string;
  name: string;
  status: PairingStatus;
  last_seen_at: string | null;
  pairing_expires_at?: string | null;
  pairing_token_ttl_minutes?: number;
  gateway_online_seconds?: number;
}

export interface GatewayCredentials {
  gateway_id: string;
  pairing_token: string;
  gateway_key: string;
  pairing_expires_at?: string | null;
  pairing_token_ttl_minutes?: number;
  gateway_online_seconds?: number;
}

export type GatewayJobType = "search" | "fetch";
export type GatewayJobStatus = "pending" | "queued" | "running" | "done" | "failed";

export interface GatewayJobStatusOut {
  job_id: string;
  type: GatewayJobType;
  status: GatewayJobStatus;
  attempts: number;
  library_item_id: string | null;
  error: string | null;
}

export interface DeliveryJob {
  id: string;
  library_item_id: string | null;
  device_id: string;
  status: DeliveryStatus;
  method: DeliveryMethod;
  created_at: string;
  delivered_at: string | null;
  error: string | null;
  download_url?: string | null;
  item_title?: string | null;
  item_author?: string | null;
  device_label?: string | null;
}

/** Mode de livraison candidat pour un device donne, avec sa disponibilite
 * reelle (voir GET /api/v1/devices/{id}/methods, services/delivery_methods.py
 * cote backend). `reason_code` est stable et traduit cote frontend. */
export type DeliveryMethodReasonCode = "smtp_not_configured" | "cloud_not_linked";

export interface MethodAvailability {
  method: DeliveryMethod;
  available: boolean;
  reason_code: DeliveryMethodReasonCode | null;
}

export interface Source {
  id: string;
  type: SourceType;
  created_at: string;
  enabled: boolean;
}
