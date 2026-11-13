// Face ID / Touch ID / Windows Hello unlock, using a passkey with the WebAuthn
// PRF extension. The passkey produces a secret only after the user is verified
// on the device; that secret wraps a copy of the data key. The copy stays on
// this device and is never synced.

import { fromB64, randomBytes, toB64 } from './crypto'
import { db, type BioMeta } from './db'

export const PASSWORD_EVERY_DAYS = 7

type PrfOutputs = { enabled?: boolean; results?: { first?: ArrayBuffer } }

export async function biometricSupported(): Promise<boolean> {
  try {
    return (
      !!window.PublicKeyCredential &&
      window.isSecureContext &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    )
  } catch {
    return false
  }
}

/** What to call it on this device. */
export function biometricName(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad/.test(ua)) return 'Face ID'
  if (/Macintosh/.test(ua)) return 'Touch ID'
  if (/Windows/.test(ua)) return 'Windows Hello'
  return 'fingerprint or face'
}

export async function getBioMeta(): Promise<BioMeta | undefined> {
  return (await db.meta.get('bio')) as BioMeta | undefined
}

/** Biometric unlock is allowed only within 7 days of the last master-password unlock. */
export function bioUsable(meta: BioMeta | undefined): boolean {
  return !!meta && Date.now() - meta.lastPasswordAt < PASSWORD_EVERY_DAYS * 86_400_000
}

async function prfKey(prf: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('homevault-bio-v1') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function evaluate(credentialId: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ id: credentialId, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null
  const prf = cred ? (cred.getClientExtensionResults() as { prf?: PrfOutputs }).prf : undefined
  if (!prf?.results?.first) throw new Error('This device cannot use a passkey to unlock')
  return prfKey(prf.results.first)
}

/** Create the passkey and return the key that will wrap the data key. */
export async function registerPasskey(): Promise<{ credentialId: string; salt: string; kek: CryptoKey }> {
  const salt = randomBytes(32)
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'HomeVault', id: location.hostname },
      user: { id: randomBytes(16), name: 'HomeVault', displayName: 'HomeVault unlock' },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60_000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('Cancelled')
  const prf = (cred.getClientExtensionResults() as { prf?: PrfOutputs }).prf
  if (prf && prf.enabled === false) throw new Error('This device cannot use a passkey to unlock')
  const id = new Uint8Array(cred.rawId)
  // Some platforms return the secret right away; others need one more check.
  const kek = prf?.results?.first ? await prfKey(prf.results.first) : await evaluate(id, salt)
  return { credentialId: toB64(id), salt: toB64(salt), kek }
}

export async function passkeyKek(meta: BioMeta): Promise<CryptoKey> {
  return evaluate(fromB64(meta.credentialId), fromB64(meta.salt))
}
