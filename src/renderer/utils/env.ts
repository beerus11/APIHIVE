/**
 * Environment and collection folder factories
 */

import type { CollectionFolder, EnvVariable, Environment } from "../types";
import { emptyEnvVariable } from "./envVariable";

export function defaultFolders(): CollectionFolder[] {
  return [
    { id: crypto.randomUUID(), name: "User Service API", open: true, requests: [] },
    { id: crypto.randomUUID(), name: "Auth V2", open: false, requests: [] }
  ];
}

export function defaultEnvironments(): Environment[] {
  return [
    {
      id: "dev",
      name: "Development",
      variables: [
        {
          ...emptyEnvVariable(),
          key: "base_url",
          initialValue: "https://dev-api.example.com",
          currentValue: "https://dev-api.example.com",
          sensitive: false
        },
        {
          ...emptyEnvVariable(),
          key: "api_key",
          initialValue: "",
          currentValue: "",
          sensitive: true
        },
        {
          ...emptyEnvVariable(),
          key: "timeout_ms",
          initialValue: "5000",
          currentValue: "5000",
          sensitive: false
        }
      ]
    },
    { id: "prod", name: "Production", variables: [emptyEnvVariable()] }
  ];
}
