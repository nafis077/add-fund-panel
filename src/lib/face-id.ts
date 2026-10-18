import { startAuthentication, startRegistration, platformAuthenticatorIsAvailable } from "@simplewebauthn/browser";
import { api } from "@/lib/client";
import { biometricLabel as labelFromUa } from "@/lib/pwa";

export const UNLOCK_KEY = "pt-unlocked";

export function markUnlocked() {
  sessionStorage.setItem(UNLOCK_KEY, "1");
}

export function clearUnlocked() {
  sessionStorage.removeItem(UNLOCK_KEY);
}

export function isUnlocked(): boolean {
  return sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export function biometricLabel(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  return labelFromUa(userAgent);
}

export async function faceIdAvailable(): Promise<boolean> {
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

export async function faceIdStatus(): Promise<{ enabled: boolean }> {
  return api<{ enabled: boolean }>("/api/auth/webauthn/status");
}

export async function enableFaceId() {
  const { options } = await api<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>(
    "/api/auth/webauthn/register/options",
    { method: "POST", body: "{}" },
  );
  const response = await startRegistration({ optionsJSON: options });
  await api("/api/auth/webauthn/register", { method: "POST", body: JSON.stringify({ response }) });
  markUnlocked();
}

export async function unlockWithFaceId() {
  const { options } = await api<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }>(
    "/api/auth/webauthn/assert/options",
    { method: "POST", body: "{}" },
  );
  const response = await startAuthentication({ optionsJSON: options });
  const result = await api("/api/auth/webauthn/assert", { method: "POST", body: JSON.stringify({ response }) });
  markUnlocked();
  return result;
}

export async function disableFaceId() {
  await api("/api/auth/webauthn/disable", { method: "POST", body: "{}" });
  clearUnlocked();
}
