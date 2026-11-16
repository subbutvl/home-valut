// All encryption happens here, with the browser's built-in Web Crypto API.
//
// Design:
// - A random 256-bit data key (DEK) encrypts every record with AES-GCM.
// - The DEK is stored twice, each copy wrapped (encrypted) by a key derived
//   from a secret with PBKDF2-SHA256:
//     1. the master password
//     2. the recovery key
//   Changing the master password only re-wraps the DEK.
// - The master password, recovery key and DEK are never stored in clear.

export const PBKDF2_ITERATIONS = 600_000

const enc = new TextEncoder()
const dec = new TextDecoder()

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** Derive a key-wrapping key from a password or recovery key. */
export async function deriveKek(secret: string, salt: Uint8Array<ArrayBuffer>, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export interface Sealed {
  iv: string
  ct: string
}

async function aesEncrypt(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<Sealed> {
  const iv = randomBytes(12)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data))
  return { iv: toB64(iv), ct: toB64(ct) }
}

async function aesDecrypt(key: CryptoKey, sealed: Sealed): Promise<Uint8Array<ArrayBuffer>> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) }, key, fromB64(sealed.ct))
  return new Uint8Array(pt)
}

/** Wrap the DEK so it can be stored. Raw export happens only in memory here. */
export async function wrapDek(dek: CryptoKey, kek: CryptoKey): Promise<Sealed> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', dek))
  try {
    return await aesEncrypt(kek, raw)
  } finally {
    raw.fill(0)
  }
}

/** Unwrap the DEK. Throws if the password/recovery key is wrong (GCM tag fails). */
export async function unwrapDek(sealed: Sealed, kek: CryptoKey): Promise<CryptoKey> {
  const raw = await aesDecrypt(kek, sealed)
  try {
    // Extractable so the DEK can be re-wrapped when the password changes.
    return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  } finally {
    raw.fill(0)
  }
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<Sealed> {
  return aesEncrypt(key, enc.encode(JSON.stringify(value)))
}

export async function decryptJson<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  return JSON.parse(dec.decode(await aesDecrypt(key, sealed))) as T
}

// ---------------------------------------------------------------------------
// Recovery key: 32 characters from an unambiguous alphabet (no 0/O or 1/I),
// shown as 8 groups of 4. 32 chars × 5 bits = 160 bits of randomness.
const ALPHABET32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
if (ALPHABET32.length !== 32) throw new Error("alphabet")

export function generateRecoveryKey(): string {
  const bytes = randomBytes(32)
  let out = ''
  for (let i = 0; i < 32; i++) out += ALPHABET32[bytes[i] & 31]
  return formatRecoveryKey(out)
}

export function normalizeRecoveryKey(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function formatRecoveryKey(input: string): string {
  const n = normalizeRecoveryKey(input)
  return n.match(/.{1,4}/g)?.join('-') ?? ''
}

// ---------------------------------------------------------------------------
// Password strength: a simple, explainable estimate.

const COMMON = new Set([
  'password', 'password1', 'password123', '123456', '12345678', '123456789', '1234567890', 'qwerty', 'qwerty123',
  'iloveyou', 'admin', 'welcome', 'letmein', 'abc123', 'monkey', 'dragon', 'india123', 'sunshine', 'princess',
])

export type Strength = 'weak' | 'good' | 'strong'

export function passwordStrength(pw: string): Strength {
  if (pw.length < 12 || COMMON.has(pw.toLowerCase())) return 'weak'
  const words = pw.split(/[\s\-_.]+/).filter((w) => w.length >= 3)
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  // A vault file copied from Drive or a backup can be guessed offline, where the
  // unlock lockout does not apply, so "strong" needs real length.
  // Dictionary words are far easier to guess than their letter count suggests,
  // so a passphrase is judged by how many words it has, not by its length.
  if (words.length >= 3) return words.length >= 6 ? 'strong' : 'good'
  if (pw.length >= 24 || (pw.length >= 16 && classes >= 3)) return 'strong'
  return 'good'
}

// 256 words, so each random byte picks one word with no bias (8 bits per word).
const WORDS = [
  'mango', 'river', 'blue', 'tiger', 'lotus', 'monsoon', 'pepper', 'temple', 'banyan', 'coconut', 'kite', 'saffron',
  'harbour', 'jasmine', 'falcon', 'marble', 'thunder', 'silver', 'canvas', 'lantern', 'meadow', 'orbit', 'pebble',
  'quartz', 'rocket', 'spice', 'tamarind', 'velvet', 'walnut', 'yellow', 'zebra', 'anchor', 'bamboo', 'cobalt',
  'desert', 'ember', 'forest', 'garden', 'hill', 'island', 'jungle', 'koel', 'lemon', 'mint', 'neem', 'ocean',
  'parrot', 'rain', 'sand', 'tea', 'umbrella', 'violet', 'wave', 'cedar', 'copper', 'delta', 'eagle', 'ginger',
  'honey', 'ivory', 'jade', 'kettle', 'lime', 'maple',
  'acorn', 'almond', 'amber', 'apple', 'apricot', 'arrow', 'atlas', 'autumn', 'badge', 'bagel', 'banana', 'barley',
  'basket', 'beacon', 'berry', 'bicycle', 'biscuit', 'blanket', 'blossom', 'bottle', 'breeze', 'brick', 'bridge',
  'bronze', 'bucket', 'butter', 'button', 'cabin', 'cactus', 'camel', 'candle', 'carrot', 'castle', 'cherry',
  'chess', 'cinnamon', 'circle', 'citrus', 'cliff', 'cloud', 'clover', 'comet', 'compass', 'coral', 'cotton',
  'crane', 'crayon', 'cricket', 'crystal', 'cumin', 'curry', 'daisy', 'dawn', 'diamond', 'dolphin', 'donkey',
  'dragonfly', 'drum', 'dune', 'echo', 'elephant', 'emerald', 'engine', 'fern', 'festival', 'fiddle', 'finch',
  'flame', 'flute', 'fossil', 'fountain', 'galaxy', 'gecko', 'glacier', 'globe', 'granite', 'grape', 'guava',
  'guitar', 'hammer', 'harvest', 'hazel', 'helmet', 'heron', 'hippo', 'horizon', 'iceberg', 'igloo', 'indigo',
  'jacket', 'jelly', 'journey', 'kangaroo', 'kayak', 'kiwi', 'ladder', 'lagoon', 'lantana', 'leopard', 'lighthouse',
  'lizard', 'llama', 'magnet', 'marigold', 'meteor', 'mirror', 'mustard', 'needle', 'nectar', 'nutmeg', 'oasis',
  'olive', 'onion', 'orange', 'orchid', 'otter', 'paddle', 'panda', 'papaya', 'peacock', 'pearl', 'pencil', 'penguin',
  'pillow', 'pine', 'planet', 'plum', 'pocket', 'pond', 'puzzle', 'rabbit', 'radish', 'rainbow', 'raven', 'ribbon',
  'ripple', 'robin', 'rose', 'ruby', 'saddle', 'sail', 'sapphire', 'scarf', 'shadow', 'shell', 'sketch', 'sparrow',
  'spinach', 'sponge', 'spring', 'squirrel', 'star', 'stone', 'sugar', 'summit', 'sunrise', 'swan', 'teapot',
  'thistle', 'timber', 'tomato', 'topaz', 'tortoise', 'tractor', 'trumpet', 'tulip', 'turmeric', 'turtle', 'valley',
  'vanilla', 'village', 'violin', 'volcano', 'wagon', 'whistle', 'willow', 'window', 'winter', 'wolf', 'yak',
  'yogurt', 'zinnia', 'abacus', 'beetle', 'chimney', 'dynamo', 'falafel', 'giraffe', 'hornet', 'lychee', 'pistachio',
  'raisin',
]
if (WORDS.length !== 256 || new Set(WORDS).size !== 256) throw new Error('wordlist')

/** Suggest a 6-word passphrase (256 words → 48 bits; plus a 2-digit number ≈ 54 bits). */
export function suggestPassphrase(): string {
  const b = randomBytes(6)
  const words = Array.from(b, (x) => WORDS[x])
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 90
  return `${words.join('-')}-${10 + n}`
}
