import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.module.scss'
import { Web3Provider } from './app/web3'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Web3Provider>
      <App />
    </Web3Provider>
  </StrictMode>,
)
