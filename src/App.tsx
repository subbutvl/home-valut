import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { AppShell } from '@/components/AppShell'
import { Toaster } from '@/components/ui/sonner'
import { useAutoLock } from '@/lib/secure-ui'
import { getSyncMeta } from '@/lib/db'
import { getToken, startSignIn, type RedirectResult } from '@/lib/drive'
import { loadSyncState, markConnected, openFromDrive, setConflictHandler, startAutoSync, syncNow } from '@/lib/sync'
import { getState, init, useVault } from '@/lib/vault'
import Backup from '@/pages/Backup'
import ComingUp from '@/pages/ComingUp'
import Notifications, { NotificationDetail } from '@/pages/Notifications'
import { addNotification, refreshNotifications } from '@/lib/notifications'
import AddChoose from '@/pages/AddChoose'
import Bin from '@/pages/Bin'
import CategoryPage from '@/pages/CategoryPage'
import Home from '@/pages/Home'
import ItemForm from '@/pages/ItemForm'
import Members from '@/pages/Members'
import ResetPassword from '@/pages/ResetPassword'
import Search from '@/pages/Search'
import Settings from '@/pages/Settings'
import Setup from '@/pages/Setup'
import Unlock from '@/pages/Unlock'

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  useEffect(() => {
    if (needRefresh)
      toast('Update available', {
        duration: Infinity,
        action: { label: 'Update', onClick: () => updateServiceWorker(true) },
      })
  }, [needRefresh, updateServiceWorker])
  return null
}

function Vault({ notice }: { notice?: string }) {
  const { status, recovered, settings } = useVault()
  useAutoLock(status === 'unlocked', settings.autoLockMinutes)
  useEffect(() => {
    if (status !== 'unlocked') return
    void syncNow().finally(() => refreshNotifications())
    const t = window.setInterval(() => void refreshNotifications(), 60 * 60_000)
    return () => window.clearInterval(t)
  }, [status])

  if (status === 'loading') return null
  if (status === 'new') return <Setup notice={notice} />
  if (status === 'locked') return <Unlock />
  if (recovered) return <ResetPassword />
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="coming-up" element={<ComingUp />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="notifications/:id" element={<NotificationDetail />} />
          <Route path="add" element={<AddChoose />} />
          <Route path="add/:cat" element={<ItemForm />} />
          <Route path="edit/:id" element={<ItemForm />} />
          <Route path="c/:cat" element={<CategoryPage />} />
          <Route path="c/:cat/:id" element={<CategoryPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/members" element={<Members />} />
          <Route path="settings/bin" element={<Bin />} />
          <Route path="settings/backup" element={<Backup />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

const NO_AUTO = 'hv-no-auto-signin'
let started = false

/** Startup: open the local vault, then act on a Google sign-in we just came back from. */
async function start(redirect: RedirectResult | null, setNotice: (s: string) => void) {
  if (started) return
  started = true
  await init()
  await loadSyncState()
  startAutoSync()
  setConflictHandler((names) => {
    const msg = `${names.join(', ')} ${names.length === 1 ? 'was' : 'were'} also changed on another device. Kept the newer version.`
    toast(msg)
    void addNotification({ key: `sync:${Date.now()}`, type: 'sync', title: msg })
  })
  if (redirect && !redirect.ok) {
    if (redirect.purpose === 'refresh') sessionStorage.setItem(NO_AUTO, '1')
    else setNotice('Google sign-in did not finish. Try again.')
    return
  }
  if (redirect?.purpose === 'open') {
    try {
      if (!(await openFromDrive()))
        setNotice(
          "No HomeVault was found in this Google account's Drive. Create the vault on your main device and connect Drive there first, or sign in with the other Google account.",
        )
    } catch (e) {
      setNotice((e as Error).message)
    }
    return
  }
  if (redirect?.purpose === 'connect') {
    await markConnected()
    toast.success('Google Drive connected. Unlock to sync.')
    return
  }
  if (redirect) return
  // Connected but the 1-hour Google token has expired: renew it quietly before unlocking.
  const meta = await getSyncMeta()
  if (meta.connected && !getToken() && navigator.onLine && !sessionStorage.getItem(NO_AUTO) && getState().status === 'locked')
    startSignIn('refresh', true)
}

export default function App({ redirect }: { redirect: RedirectResult | null }) {
  const [notice, setNotice] = useState<string>()
  useEffect(() => {
    void start(redirect, setNotice)
  }, [redirect])
  return (
    <>
      <Vault notice={notice} />
      <Toaster />
      <UpdatePrompt />
    </>
  )
}
