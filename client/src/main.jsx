import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AcademicProvider } from './context/AcademicContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ConfirmProvider } from './context/ConfirmContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import './i18n/index.js'
import './styles/theme.css'
import './styles/app.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <AcademicProvider>
              <App />
            </AcademicProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
