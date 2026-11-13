import { buildVaultFile, isVaultFile, type VaultFile } from './sync'
import { replaceLocalVault } from './vault'

/** Save an encrypted backup file to the computer (or Files on iPhone). */
export async function exportBackupFile() {
  const data = await buildVaultFile()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `homevault-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Read a backup file chosen by the user. Throws if it isn't one. */
export async function readBackupFile(file: File): Promise<VaultFile> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('That file is not a HomeVault backup')
  }
  if (!isVaultFile(data)) throw new Error('That file is not a HomeVault backup')
  return data
}

/** Replace this device's vault with the backup. It then asks for that backup's password. */
export async function restoreBackupFile(data: VaultFile) {
  await replaceLocalVault(data.header, data.records)
}
