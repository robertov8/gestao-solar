import '@radix-ui/themes/styles.css'
import { Theme } from '@radix-ui/themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import './theme.css'
import { ThemeModeProvider } from './theme.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeModeProvider>
          {(appearance) => (
            <Theme appearance={appearance} accentColor="amber" grayColor="sand" radius="medium">
              <App />
            </Theme>
          )}
        </ThemeModeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
