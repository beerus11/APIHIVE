/**
 * Environment variable factory
 */

import type { EnvVariable } from "../types";

export function emptyEnvVariable(): EnvVariable {
  return {
    id: crypto.randomUUID(),
    key: "",
    initialValue: "",
    currentValue: "",
    sensitive: false
  };
}
