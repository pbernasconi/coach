import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfirmProvider } from '../src'
import { Catalog } from './Catalog'
import './catalog.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ConfirmProvider>
        <Catalog />
      </ConfirmProvider>
    </StrictMode>,
  )
}
