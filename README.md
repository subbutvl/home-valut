# HomeVault

A private, encrypted vault for your assets, IDs, bills, insurance, warranties and subscriptions. It runs as an installable web app (PWA) on iPhone and laptop, works offline, and keeps everything encrypted on the device.

It is not an expense tracker. Balances, interest and totals are reference figures you type or the app estimates, and they are labelled "approx." or "as of".

## Status

Phase 1: unlock and encryption, 17 categories with their fields, add / edit / view / duplicate / delete (with a 30-day Bin), favourites and recently viewed, search, family members, and GitHub Pages deploy.

Phase 2a: one vault on every device through Google Drive. First run offers "Create a new vault", "Open my vault from Google Drive" or "Restore from a backup file". Changes sync both ways (the newer edit of an item wins), deletions sync, password changes reach other devices, daily snapshots are kept in Drive (30 daily + 12 monthly) and can be restored, and an encrypted backup file can be exported and imported.

Phase 2b: Face ID / fingerprint unlock (passkey with WebAuthn PRF, master password every 7 days), Coming up with Mark done, in-app Notifications centre, subscription total.

Coming next: attachments, Excel/CSV import, printing and the family sheet, lockers, and the health checks. The tax view is on hold.

## Google Drive

The app talks to Google directly from the browser, with no Google script loaded. Sign-in uses OAuth 2.0 for browser apps and asks for `drive.file`, so the app sees only files and folders it created itself. Everything lives in a visible **HomeVault** folder in My Drive: `homevault-vault.json` (the unlock header plus the encrypted records, the same bytes that are on each device) and a `Snapshots` folder with the daily copies. `drive.appdata` is also requested, only to move a copy saved by the first sync version into the folder. Don't rename or move the HomeVault folder; if it can't be found, the app creates a new one.

The Google OAuth client ID is public (it is not a secret) and is set in `.env` as `VITE_GOOGLE_CLIENT_ID`. Without it, the Drive options are shown as not set up.

## How the encryption works

- A random 256-bit data key encrypts every record with AES-GCM (Web Crypto, built into the browser).
- That data key is stored twice, each copy encrypted by a key derived with PBKDF2-SHA256 (600,000 rounds) from either the master password or the recovery key.
- The master password, recovery key and data key are never stored or sent anywhere. Changing the password re-wraps the data key.
- Only an unlock header (salts and the two wrapped keys) is stored in clear. Item data, including names, is encrypted in IndexedDB.
- 5 wrong tries cause a 1 minute wait that doubles with each further wrong try. The app locks after 1 minute idle, and straight away when it goes to the background on a phone.
- The production build ships a strict Content Security Policy: no outside scripts, and network access only to Google's APIs (for the coming Drive sync).

Secret fields (passwords, PINs, CVV, full card number) are hidden until tapped, hide again after 30 seconds, are cleared from the clipboard 30 seconds after copying, and are never searched.

## Develop

```bash
npm install
npm run dev
```

```bash
npm run build
```

Stack: Vite, React, TypeScript, Tailwind CSS 4, shadcn/ui, vite-plugin-pwa, Dexie (IndexedDB).

## Deploy

Every push to `main` builds and publishes to GitHub Pages through `.github/workflows/deploy.yml`. One-time setup: in the repository's Settings → Pages, set **Source** to **GitHub Actions**.

The app is served at `https://<user>.github.io/home-valut/`. If the repository is renamed, change `base` in `vite.config.ts` to match.

## Install on iPhone

Open the address in Safari, tap Share, then **Add to Home Screen**.
