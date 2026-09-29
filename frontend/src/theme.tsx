import { DropdownMenu, IconButton, Tooltip } from '@radix-ui/themes'
import { CheckIcon, DesktopIcon, MoonIcon, SunIcon } from '@radix-ui/react-icons'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Appearance = 'light' | 'dark'

// Mesma chave usada pelo script do index.html, que aplica o tema antes do React
// carregar (evita a tela piscar clara ao abrir no modo escuro).
const STORAGE_KEY = 'theme-mode'

const modes: { value: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Claro', Icon: SunIcon },
  { value: 'dark', label: 'Escuro', Icon: MoonIcon },
  { value: 'system', label: 'Sistema', Icon: DesktopIcon },
]

function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    // Armazenamento bloqueado: segue o sistema.
  }
  return 'system'
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

type ThemeContextValue = { mode: ThemeMode; appearance: Appearance; setMode: (mode: ThemeMode) => void }

const ThemeContext = createContext<ThemeContextValue | null>(null)

// Guarda o modo escolhido e resolve "Sistema" para claro ou escuro,
// acompanhando a mudança do sistema operacional enquanto a tela está aberta.
export function ThemeModeProvider({ children }: { children: (appearance: Appearance) => ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readMode)
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches)

  useEffect(() => {
    const query = darkQuery()
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const appearance: Appearance = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Armazenamento bloqueado ou cheio: o tema vale só até recarregar.
    }
  }, [mode])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(appearance)
    root.style.colorScheme = appearance
  }, [appearance])

  return (
    <ThemeContext.Provider value={{ mode, appearance, setMode }}>{children(appearance)}</ThemeContext.Provider>
  )
}

function useThemeMode() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useThemeMode precisa estar dentro de ThemeModeProvider')
  return value
}

// Botão da barra superior: o ícone mostra o tema atual e o menu troca o tema.
export function ThemeToggle() {
  const { mode, appearance, setMode } = useThemeMode()
  const current = modes.find((m) => m.value === mode)!
  const label =
    mode === 'system'
      ? `Tema: Sistema (${appearance === 'dark' ? 'escuro' : 'claro'})`
      : `Tema: ${current.label}`

  return (
    <DropdownMenu.Root>
      <Tooltip content={label}>
        <DropdownMenu.Trigger>
          <IconButton variant="ghost" color="gray" size="3" aria-label={`${label}. Trocar tema`}>
            <current.Icon width="20" height="20" />
          </IconButton>
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownMenu.Content align="end">
        {modes.map(({ value, label, Icon }) => (
          <DropdownMenu.Item key={value} onSelect={() => setMode(value)}>
            <Icon /> {label}
            {value === mode && <CheckIcon style={{ marginLeft: 'auto' }} />}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
