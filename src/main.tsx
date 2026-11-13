import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { handleRedirect } from './lib/drive'
import { initTheme } from './lib/theme'

initTheme()

// Must run before the router reads the address: picks up a Google sign-in result.
const redirect = handleRedirect()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App redirect={redirect} />
  </StrictMode>,
)
