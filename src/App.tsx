import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { AppShell } from '@/components/AppShell'
import { Toaster } from '@/components/ui/sonner'
import { useAutoLock } from '@/lib/secure-ui'
import { init, useVault } from '@/lib/vault'
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

function Vault() {
  const { status, recovered, settings } = useVault()
  useAutoLock(status === 'unlocked', settings.autoLockMinutes)

  if (status === 'loading') return null
  if (status === 'new') return <Setup />
  if (status === 'locked') return <Unlock />
  if (recovered) return <ResetPassword />
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="add" element={<AddChoose />} />
          <Route path="add/:cat" element={<ItemForm />} />
          <Route path="edit/:id" element={<ItemForm />} />
          <Route path="c/:cat" element={<CategoryPage />} />
          <Route path="c/:cat/:id" element={<CategoryPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/members" element={<Members />} />
          <Route path="settings/bin" element={<Bin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default function App() {
  useEffect(() => {
    void init()
  }, [])
  return (
    <>
      <Vault />
      <Toaster />
      <UpdatePrompt />
    </>
  )
}
