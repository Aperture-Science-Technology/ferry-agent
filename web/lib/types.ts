export type DeviceBrand = "kindle" | "kobo" | "tolino" | "pocketbook" | "other";
export type DeliveryTier = "A" | "B" | "C" | "D";
export type DeliveryStatus = "queued" | "sent" | "delivered" | "failed";
export type DeliveryMethod = "email" | "dropbox" | "drive" | "browser_code" | "usb";
export type PairingStatus = "pending" | "paired" | "revoked";
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
}

export interface Device {
  id: string;
  brand: DeviceBrand;
  model: string | null;
  delivery_tier: DeliveryTier;
  link_ref: string | null;
  last_synced_at: string | null;
}

export interface Gateway {
  gateway_id: string;
  name: string;
  status: PairingStatus;
  last_seen_at: string | null;
}

export interface GatewayCredentials {
  gateway_id: string;
  pairing_token: string;
  gateway_key: string;
}

export interface DeliveryJob {
  id: string;
  library_item_id: string;
  device_id: string;
  status: DeliveryStatus;
  method: DeliveryMethod;
  created_at: string;
  delivered_at: string | null;
  error: string | null;
  download_url?: string | null;
}

export interface Source {
  id: string;
  type: SourceType;
  config: Record<string, unknown>;
  created_at: string;
}
