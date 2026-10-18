const SENSITIVE_KEYS = new Set([
  "apikey",
  "api_key",
  "x-api-key",
  "authorization",
  "password",
  "passwordhash",
  "encryptedapikey",
  "token",
  "secret",
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEYS.has(key.toLowerCase()) || SENSITIVE_KEYS.has(normalized);
}

export function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = isSensitiveKey(key) ? "[REDACTED]" : redactValue(nested);
    }
    return output;
  }
  if (typeof value === "string" && value.startsWith("enc:")) {
    return "[REDACTED]";
  }
  return value;
}

export function safeJson(value: unknown): string {
  return JSON.stringify(redactValue(value));
}

export function maskKey(last4: string): string {
  return `••••${last4}`;
}
