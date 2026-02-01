/**
 * Request draft factories and helpers
 */

import type { KeyValue, RequestDraft } from "../types";

export function emptyKeyValue(): KeyValue {
  return {
    id: crypto.randomUUID(),
    key: "",
    value: "",
    enabled: true
  };
}

export function defaultRequest(): RequestDraft {
  return {
    id: crypto.randomUUID(),
    name: "Untitled Request",
    method: "GET",
    url: "https://api.example.com/v1/users",
    params: [emptyKeyValue()],
    headers: [emptyKeyValue()],
    bodyType: "json",
    body: "{\n  \"username\": \"\",\n  \"email\": \"\"\n}",
    formDataFields: [emptyKeyValue()],
    auth: { type: "none" },
    documentation: ""
  };
}

export function deepCloneRequest(item: RequestDraft): RequestDraft {
  return {
    ...item,
    id: crypto.randomUUID(),
    name: `${item.name} Copy`,
    params: item.params.map((p) => ({ ...p, id: crypto.randomUUID() })),
    headers: item.headers.map((h) => ({ ...h, id: crypto.randomUUID() }))
  };
}
