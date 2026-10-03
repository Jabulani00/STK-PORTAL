import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Providers } from './app/providers.tsx'
import { router } from './app/router.tsx'
import { connectPortal } from './services/store.ts'
import './index.css'

const root = document.getElementById('root')!

connectPortal()
  .then(() => {
    createRoot(root).render(
      <StrictMode>
        <Providers>
          <RouterProvider router={router} />
        </Providers>
      </StrictMode>,
    )
  })
  .catch((error: unknown) => {
    root.textContent = error instanceof Error ? error.message : 'Could not open the portal.'
  })
