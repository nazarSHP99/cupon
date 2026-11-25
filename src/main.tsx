import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { initializeAnalytics } from './analytics/analytics'
import './app/styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('requestIdleCallback' in window) window.requestIdleCallback(initializeAnalytics, { timeout: 2500 })
else setTimeout(initializeAnalytics, 1000)
