/**
 * Shared types for APIHive renderer
 */

export type KeyValue = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  secret?: boolean;
};

export type AuthConfig =
  | { type: "none" }
  | { type: "basic"; username: string; password: string }
  | { type: "bearer"; token: string }
  | { type: "apiKey"; key: string; value: string; addTo: "header" | "query" };

export type RequestDraft = {
  id: string;
  name: string;
  method: string;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  bodyType: "json" | "text" | "form-data";
  body: string;
  formDataFields?: KeyValue[];
  auth: AuthConfig;
  documentation?: string;
};

export type CollectionFolder = {
  id: string;
  name: string;
  open: boolean;
  requests: RequestDraft[];
};

export type EnvVariable = {
  id: string;
  key: string;
  initialValue: string;
  currentValue: string;
  sensitive: boolean;
};

export type Environment = {
  id: string;
  name: string;
  variables: EnvVariable[];
};

export type ResponseState = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  size: number;
};

export type HistoryItem = {
  id: string;
  name: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  size: number;
  at: number;
};

export type RequestTab = "params" | "auth" | "headers" | "body";
export type MainView = "requests" | "environments";
