/**
 * Variable substitution and URL/header building
 */

import type { KeyValue, AuthConfig } from "../types";

export function applyVariables(
  input: string,
  vars: Record<string, string>
): string {
  return input.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => vars[key] ?? "");
}

export function buildUrl(
  url: string,
  params: KeyValue[],
  vars: Record<string, string>
): string {
  const baseUrl = applyVariables(url, vars);
  const queryPairs = params
    .filter((item) => item.enabled && item.key.trim().length > 0)
    .map((item) => [
      applyVariables(item.key.trim(), vars),
      applyVariables(item.value, vars)
    ]);

  if (queryPairs.length === 0) return baseUrl;
  const query = queryPairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  const hashIndex = baseUrl.indexOf("#");
  const withoutHash = hashIndex >= 0 ? baseUrl.slice(0, hashIndex) : baseUrl;
  const hash = hashIndex >= 0 ? baseUrl.slice(hashIndex) : "";
  const separator = withoutHash.includes("?") ? "&" : "?";
  return `${withoutHash}${separator}${query}${hash}`;
}

export function buildHeaders(
  headers: KeyValue[],
  auth: AuthConfig,
  vars: Record<string, string>
): Record<string, string> {
  const resolved: Record<string, string> = {};
  headers
    .filter((item) => item.enabled && item.key.trim().length > 0)
    .forEach((item) => {
      const key = applyVariables(item.key.trim(), vars);
      resolved[key] = applyVariables(item.value, vars);
    });

  if (auth.type === "basic") {
    const token = btoa(`${auth.username}:${auth.password}`);
    resolved["Authorization"] = `Basic ${token}`;
  }
  if (auth.type === "bearer") {
    resolved["Authorization"] = `Bearer ${auth.token}`;
  }
  if (auth.type === "apiKey" && auth.addTo === "header") {
    resolved[auth.key] = auth.value;
  }

  return resolved;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function statusTone(status: number): string {
  if (status >= 200 && status < 300) return "status-ok";
  if (status >= 400) return "status-error";
  if (status >= 300) return "status-warn";
  return "status-info";
}

export function isValidHttpUrl(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
