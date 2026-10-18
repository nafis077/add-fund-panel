import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { NextResponse } from "next/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { allowedOriginsForRequest } from "@/lib/http";
import { sessionCookieOptions } from "@/lib/session-cookie";
import { WEBAUTHN_CHAL_COOKIE, WEBAUTHN_CRED_COOKIE, WEBAUTHN_CRED_DAYS } from "@/lib/auth-constants";
import type { SessionUser } from "@/lib/auth";

export type StoredWebAuthnCredential = {
  userId: string;
  id: string;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
};

function cookieFromRequest(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  const parts = header.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return undefined;
}

export function rpIdFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || request.headers.get("host") || "localhost";
  return host.split(":")[0].toLowerCase();
}

export function readStoredCredential(request: Request): StoredWebAuthnCredential | null {
  const raw = cookieFromRequest(request, WEBAUTHN_CRED_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decryptSecret(raw)) as StoredWebAuthnCredential;
    if (!parsed.userId || !parsed.id || !parsed.publicKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readChallenge(request: Request): string | null {
  const raw = cookieFromRequest(request, WEBAUTHN_CHAL_COOKIE);
  if (!raw) return null;
  try {
    return decryptSecret(raw);
  } catch {
    return null;
  }
}

export function attachWebAuthnCookies(
  response: NextResponse,
  request: Request,
  input: { credential?: StoredWebAuthnCredential | null; challenge?: string | null },
): NextResponse {
  const base = sessionCookieOptions(request);
  if (input.credential) {
    response.cookies.set(WEBAUTHN_CRED_COOKIE, encryptSecret(JSON.stringify(input.credential)), {
      ...base,
      maxAge: WEBAUTHN_CRED_DAYS * 24 * 60 * 60,
    });
  } else if (input.credential === null) {
    response.cookies.set(WEBAUTHN_CRED_COOKIE, "", { ...base, maxAge: 0 });
  }
  if (input.challenge) {
    response.cookies.set(WEBAUTHN_CHAL_COOKIE, encryptSecret(input.challenge), {
      ...base,
      maxAge: 5 * 60,
    });
  } else if (input.challenge === null) {
    response.cookies.set(WEBAUTHN_CHAL_COOKIE, "", { ...base, maxAge: 0 });
  }
  return response;
}

export async function registrationOptionsForUser(
  user: SessionUser,
  request: Request,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = readStoredCredential(request);
  return generateRegistrationOptions({
    rpName: "Panel Treasury",
    rpID: rpIdFromRequest(request),
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing ? [{ id: existing.id, transports: existing.transports }] : [],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
  });
}

export async function verifyAndStoreRegistration(
  user: SessionUser,
  request: Request,
  response: RegistrationResponseJSON,
): Promise<StoredWebAuthnCredential> {
  const challenge = readChallenge(request);
  if (!challenge) throw new Error("Face ID challenge expired. Try again.");
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: allowedOriginsForRequest(request),
    expectedRPID: rpIdFromRequest(request),
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Face ID could not be verified");
  }
  const { credential } = verification.registrationInfo;
  return {
    userId: user.id,
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports,
  };
}

export async function assertionOptions(request: Request): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const stored = readStoredCredential(request);
  if (!stored) throw new Error("Face ID is not enabled on this device");
  return generateAuthenticationOptions({
    rpID: rpIdFromRequest(request),
    userVerification: "required",
    allowCredentials: [{ id: stored.id, transports: stored.transports }],
  });
}

export async function verifyAssertion(
  request: Request,
  response: AuthenticationResponseJSON,
): Promise<{ userId: string; credential: StoredWebAuthnCredential }> {
  const stored = readStoredCredential(request);
  const challenge = readChallenge(request);
  if (!stored || !challenge) throw new Error("Face ID is not enabled on this device");
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: allowedOriginsForRequest(request),
    expectedRPID: rpIdFromRequest(request),
    requireUserVerification: true,
    credential: {
      id: stored.id,
      publicKey: Buffer.from(stored.publicKey, "base64url"),
      counter: stored.counter,
      transports: stored.transports,
    },
  });
  if (!verification.verified) throw new Error("Face ID unlock failed");
  return {
    userId: stored.userId,
    credential: {
      ...stored,
      counter: verification.authenticationInfo.newCounter,
    },
  };
}
