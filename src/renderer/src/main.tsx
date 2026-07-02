import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import OverlayApp from './OverlayApp'
import './assets/main.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing in index.html')

// The overlay window loads the same renderer with ?overlay=1.
const isOverlay = new URLSearchParams(window.location.search).has('overlay')
if (isOverlay) {
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>{isOverlay ? <OverlayApp /> : <App />}</React.StrictMode>
)
