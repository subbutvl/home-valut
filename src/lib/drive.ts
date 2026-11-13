// Google Drive access with no third-party scripts.
//
// Sign-in uses Google's OAuth 2.0 flow for browser apps: the page goes to
// accounts.google.com and comes back with a short-lived access token in the
// address. The token only reaches files this app created (drive.file): a
// "HomeVault" folder in My Drive. Never the user's other files. Everything
// uploaded is already encrypted.

export const CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
// drive.file: only files and folders this app created (the HomeVault folder).
// Only drive.file is asked for: one permission, one tick box on Google's screen.
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const APPDATA_SCOPE = 'auth/drive.appdata'
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
  // Interactive sign-in always shows the permission screen, so a permission
  // that was unticked earlier can be ticked again.
  p.set('prompt', silent ? 'none' : 'consent')
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
  localStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({ token, expiresAt: Date.now() + (expiresIn - 120) * 1000, scope: p.get('scope') ?? '' }),
  )
  // Google lets people untick permissions on the consent screen. Without drive.file nothing can be saved.
  const granted = p.get('scope') ?? ''
  if (granted && !granted.includes('auth/drive.file')) {
    localStorage.removeItem(TOKEN_KEY)
    return { purpose: pending.purpose, ok: false, error: 'missing_drive_permission' }
  }
  return { purpose: pending.purpose, ok: true }
}

/** Ask Google which permissions this token really has. */
export async function verifyTokenScopes(): Promise<'ok' | 'missing' | 'unknown'> {
  const token = getToken()
  if (!token) return 'unknown'
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`)
    if (!res.ok) return 'unknown'
    const info = (await res.json()) as { scope?: string }
    const scope = info.scope ?? ''
    const raw = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? '{}')
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...raw, scope }))
    if (scope.includes('auth/drive.file')) return 'ok'
    localStorage.removeItem(TOKEN_KEY)
    return 'missing'
  } catch {
    return 'unknown'
  }
}

function grantedScope(): string {
  try {
    return (JSON.parse(localStorage.getItem(TOKEN_KEY) ?? '{}') as { scope?: string }).scope ?? ''
  } catch {
    return ''
  }
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

export class DriveAuthError extends Error {
  /** True when Google needs the user to tick the Drive permission again. */
  needsConsent: boolean
  constructor(message: string, needsConsent = false) {
    super(message)
    this.needsConsent = needsConsent
  }
}

/** A Drive request Google refused, with Google's reason in plain words. */
export class DriveError extends Error {}

async function explain(res: Response): Promise<Error> {
  let reason = ''
  let message = ''
  try {
    const body = (await res.json()) as { error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } }
    reason = body.error?.errors?.[0]?.reason ?? body.error?.details?.[0]?.reason ?? ''
    message = body.error?.message ?? ''
  } catch {
    /* not JSON */
  }
  console.warn('Google Drive', res.status, reason, message)
  if (reason === 'accessNotConfigured' || reason === 'SERVICE_DISABLED' || /has not been used|is disabled/i.test(message))
    return new DriveError(
      'The Google Drive API is switched off for this app. In Google Cloud, open the HomeVault project, then APIs & Services → Library → Google Drive API → Enable.',
    )
  if (
    reason === 'insufficientPermissions' ||
    reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' ||
    /insufficient.*scope|granted scopes do not/i.test(message)
  ) {
    localStorage.removeItem(TOKEN_KEY)
    return new DriveAuthError('Google Drive permission is missing. Sign in again and allow access to Drive files.', true)
  }
  if (reason === 'storageQuotaExceeded') return new DriveError('Your Google Drive is full.')
  if (res.status === 429 || reason === 'userRateLimitExceeded' || reason === 'rateLimitExceeded')
    return new DriveError('Google Drive is busy. Try again in a minute.')
  return new DriveError(`Google Drive error ${res.status}${message ? `: ${message}` : ''}`)
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  if (!token) throw new DriveAuthError('Not signed in to Google')
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    throw new DriveAuthError('Google sign-in expired')
  }
  if (!res.ok) throw await explain(res)
  return res
}

export interface DriveFile {
  id: string
  name: string
  modifiedTime: string
  size?: string
}

export const FOLDER = 'HomeVault'
const SNAP_FOLDER = 'Snapshots'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

async function query(q: string, space: 'drive' | 'appDataFolder' = 'drive'): Promise<DriveFile[]> {
  const p = new URLSearchParams({
    spaces: space,
    q: `${q} and trashed = false`,
    fields: 'files(id,name,modifiedTime,size)',
    pageSize: '1000',
    orderBy: 'name desc',
  })
  const res = await call(`${API}/files?${p}`)
  return ((await res.json()) as { files: DriveFile[] }).files
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

async function ensureFolder(name: string, parent?: string): Promise<string> {
  const inParent = parent ? ` and '${parent}' in parents` : " and 'root' in parents"
  const found = await query(`name = '${esc(name)}' and mimeType = '${FOLDER_MIME}'${inParent}`)
  if (found[0]) return found[0].id
  const res = await call(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parent ? [parent] : ['root'] }),
  })
  return ((await res.json()) as { id: string }).id
}

export interface Folders {
  root: string
  snaps: string
  files: string
}

let folderCache: Folders | null = null

/**
 * The visible "HomeVault" folder in My Drive (with a "Snapshots" folder inside).
 * With the drive.file permission the app sees only what it created itself.
 */
export async function folders(): Promise<Folders> {
  if (folderCache) return folderCache
  const root = await ensureFolder(FOLDER)
  const snaps = await ensureFolder(SNAP_FOLDER, root)
  const files = await ensureFolder('Attachments', root)
  folderCache = { root, snaps, files }
  return folderCache
}

export function forgetFolders() {
  folderCache = null
}

/** Files in a folder whose name contains the text. */
export async function listFiles(namePart: string, folderId: string): Promise<DriveFile[]> {
  return query(`name contains '${esc(namePart)}' and '${folderId}' in parents`)
}

export async function findFile(name: string, folderId: string): Promise<DriveFile | null> {
  return (await listFiles(name, folderId)).find((f) => f.name === name) ?? null
}

/** A vault file left in the hidden app folder by the first version of sync. */
export async function findLegacyFile(name: string): Promise<DriveFile | null> {
  if (!grantedScope().includes(APPDATA_SCOPE)) return null
  try {
    return (await query(`name = '${esc(name)}'`, 'appDataFolder'))[0] ?? null
  } catch {
    return null
  }
}

export async function download<T>(id: string): Promise<T> {
  const res = await call(`${API}/files/${id}?alt=media`)
  return (await res.json()) as T
}

/** Create (no id) or overwrite (id) a JSON file in a folder. Returns the file id. */
export async function upload(name: string, body: unknown, id: string | undefined, folderId: string): Promise<string> {
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
  const meta = JSON.stringify({ name, parents: [folderId], mimeType: 'application/json' })
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

export async function copyFile(id: string, name: string, folderId: string): Promise<void> {
  await call(`${API}/files/${id}/copy?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [folderId] }),
  })
}

export async function deleteFile(id: string): Promise<void> {
  await call(`${API}/files/${id}`, { method: 'DELETE' })
}

/** Upload encrypted attachment bytes as a new file. */
export async function uploadBinary(name: string, bytes: Uint8Array<ArrayBuffer>, folderId: string): Promise<string> {
  const boundary = `hv${crypto.randomUUID()}`
  const meta = JSON.stringify({ name, parents: [folderId], mimeType: 'application/octet-stream' })
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    bytes,
    `\r\n--${boundary}--`,
  ])
  const res = await call(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return ((await res.json()) as { id: string }).id
}

export async function downloadBinary(id: string): Promise<ArrayBuffer> {
  const res = await call(`${API}/files/${id}?alt=media`)
  return res.arrayBuffer()
}

/** Every file in a folder (id, name, modified time), across pages. */
export async function listFolder(folderId: string): Promise<DriveFile[]> {
  return query(`'${folderId}' in parents`)
}
