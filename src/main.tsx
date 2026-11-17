import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ReadIssuesProvider } from './lib/readIssues.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReadIssuesProvider>
      <App />
    </ReadIssuesProvider>
  </StrictMode>,
)
