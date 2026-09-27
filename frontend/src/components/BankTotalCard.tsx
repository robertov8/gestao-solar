import { Box, Card, Flex, Spinner, Text } from '@radix-ui/themes'
import { LightningBoltIcon } from '@radix-ui/react-icons'
import { useId } from 'react'
import { useSummary } from '../api/summary.ts'
import { formatKwh } from '../format.ts'

export default function BankTotalCard() {
  const { data, isPending, error } = useSummary()
  const titleId = useId()

  return (
    <Card asChild size="3">
      <section aria-labelledby={titleId}>
        <Flex align="center" gap="4">
          <LightningBoltIcon width="32" height="32" color="var(--accent-9)" />
          <Box>
            <Text as="p" id={titleId} size="2" color="gray">
              Total do banco de kWh
            </Text>
            {isPending ? (
              <Spinner size="3" />
            ) : error ? (
              <Text color="red">Erro ao carregar: {error.message}</Text>
            ) : (
              <Text as="p" size="8" weight="bold">
                {formatKwh(data.totalBalanceKwh)}
              </Text>
            )}
          </Box>
        </Flex>
      </section>
    </Card>
  )
}
