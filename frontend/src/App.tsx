import { Box, Container, Flex, Heading, Link, Text } from '@radix-ui/themes'
import { SunIcon } from '@radix-ui/react-icons'
import { Link as RouterLink, Route, Routes } from 'react-router'
import { ThemeToggle } from './theme.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import UnitDetailPage from './pages/UnitDetailPage.tsx'

export default function App() {
  return (
    <Box minHeight="100vh">
      <Box asChild px="5" py="3" style={{ borderBottom: '1px solid var(--gray-a5)' }}>
        <header>
          <Flex align="center" justify="between" gap="3">
            <Flex align="center" gap="2">
              <SunIcon width="22" height="22" color="var(--accent-9)" />
              <Text size="4" weight="bold">
                <Link asChild color="gray" highContrast underline="none">
                  <RouterLink to="/">Gestão Solar</RouterLink>
                </Link>
              </Text>
            </Flex>
            <ThemeToggle />
          </Flex>
        </header>
      </Box>
      <Container size="4" px="5" py="6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/units/:id" element={<UnitDetailPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Container>
    </Box>
  )
}

function NotFound() {
  return (
    <Flex direction="column" gap="3">
      <Heading size="6">Página não encontrada</Heading>
      <Text>
        <Link asChild>
          <RouterLink to="/">Voltar ao painel</RouterLink>
        </Link>
      </Text>
    </Flex>
  )
}
