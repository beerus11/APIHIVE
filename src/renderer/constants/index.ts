/**
 * App-wide constants
 */

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS"
] as const;

export const REQUEST_TAB_ORDER = ["params", "auth", "headers", "body"] as const;

export const STORAGE_KEYS = {
  collections: "apihive.collections",
  environments: "apihive.environments",
  history: "apihive.history"
} as const;

export const APP_VERSION = "2.4.0";
