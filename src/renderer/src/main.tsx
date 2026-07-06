import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import OverlayApp from './OverlayApp'
import './assets/main.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing in index.html')

// Browser preview (design tool): without the Electron preload there is no
// window.api — install the fixture-backed mock so the UI renders standalone.
if (window.api === undefined && import.meta.env.DEV) {
  const { installMockApi } = await import('./mockapi')
  installMockApi()
}

// The overlay window loads the same renderer with ?overlay=1.
const isOverlay = new URLSearchParams(window.location.search).has('overlay')
if (isOverlay) {
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
  // The main window applies the theme in App; the overlay does it here.
  void window.api.invoke('settings:get').then((settings) => {
    document.documentElement.dataset['theme'] = settings.theme
  })
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>{isOverlay ? <OverlayApp /> : <App />}</React.StrictMode>
)
