// Google Drive access with no third-party scripts.
//
// Sign-in uses Google's OAuth 2.0 flow for browser apps: the page goes to
// accounts.google.com and comes back with a short-lived access token in the
// address. The token only allows the app's own hidden folder (drive.appdata),
// never the user's other files. Everything uploaded is already encrypted.

export const CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const TOKEN_KEY = 'hv-drive-token'
const PENDING_KEY = 'hv-oauth'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export const VAULT_FILE = 'homevault-vault.json'
export const SNAPSHOT_PREFIX = 'homevault-snapshot-'

export type SignInPurpose = 'open' | 'connect' | 'refresh' | 'restore'

export function driveConfigured() {
  return CLIENT_ID.endsWith('.apps.googleusercontent.com')
}

function redirectUri() {
  return location.origin + import.meta.env.BASE_URL
}

/** Leave the app for Google's sign-in page. `silent` returns at once if already allowed. */
export function startSignIn(purpose: SignInPurpose, silent = false) {
  const state = crypto.randomUUID()
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, purpose }))
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
  })
  if (silent) p.set('prompt', 'none')
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${p}`)
}

export interface RedirectResult {
  purpose: SignInPurpose
  ok: boolean
  error?: string
}

/**
 * Run once at startup, before the router reads the address. If we just came
 * back from Google, keep the token and clean the address bar.
 */
export function handleRedirect(): RedirectResult | null {
  const hash = location.hash.slice(1)
  if (!/(^|&)(access_token|error)=/.test(hash)) return null
  const p = new URLSearchParams(hash)
  history.replaceState(null, '', location.pathname + '#/')
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as {
    state: string
    purpose: SignInPurpose
  } | null
  sessionStorage.removeItem(PENDING_KEY)
  if (!pending || pending.state !== p.get('state')) return null
  const token = p.get('access_token')
  if (!token) return { purpose: pending.purpose, ok: false, error: p.get('error') ?? 'unknown' }
  const expiresIn = Number(p.get('expires_in') ?? 3600)
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt: Date.now() + (expiresIn - 120) * 1000 }))
  return { purpose: pending.purpose, ok: true }
}

export function getToken(): string | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as { token: string; expiresAt: number } | null
    return t && t.expiresAt > Date.now() ? t.token : null
  } catch {
    return null
  }
}

export function forgetToken() {
  const token = getToken()
  localStorage.removeItem(TOKEN_KEY)
  // Tell Google to revoke it too (best effort).
  if (token)
    fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {})
}

export class DriveAuthError extends Error {}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  if (!token) throw new DriveAuthError('Not signed in to Google')
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    throw new DriveAuthError('Google sign-in expired')
  }
  if (!res.ok) throw new Error(`Google Drive error ${res.status}`)
  return res
}

export interface DriveFile {
  id: string
  name: string
  modifiedTime: string
  size?: string
}

export async function listFiles(namePrefix?: string): Promise<DriveFile[]> {
  const q = namePrefix ? `name contains '${namePrefix}' and trashed = false` : 'trashed = false'
  const p = new URLSearchParams({
    spaces: 'appDataFolder',
    q,
    fields: 'files(id,name,modifiedTime,size)',
    pageSize: '1000',
    orderBy: 'name desc',
  })
  const res = await call(`${API}/files?${p}`)
  return ((await res.json()) as { files: DriveFile[] }).files
}

export async function findFile(name: string): Promise<DriveFile | null> {
  return (await listFiles(name)).find((f) => f.name === name) ?? null
}

export async function download<T>(id: string): Promise<T> {
  const res = await call(`${API}/files/${id}?alt=media`)
  return (await res.json()) as T
}

/** Create (no id) or overwrite (id) a JSON file in the app folder. Returns the file id. */
export async function upload(name: string, body: unknown, id?: string): Promise<string> {
  const json = JSON.stringify(body)
  if (id) {
    const res = await call(`${UPLOAD}/files/${id}?uploadType=media&fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    })
    return ((await res.json()) as { id: string }).id
  }
  const boundary = `hv${crypto.randomUUID()}`
  const meta = JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' })
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`
  const res = await call(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  })
  return ((await res.json()) as { id: string }).id
}

export async function copyFile(id: string, name: string): Promise<void> {
  await call(`${API}/files/${id}/copy?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: ['appDataFolder'] }),
  })
}

export async function deleteFile(id: string): Promise<void> {
  await call(`${API}/files/${id}`, { method: 'DELETE' })
}
