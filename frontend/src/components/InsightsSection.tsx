import { Callout, Card, Flex, Grid, Heading, Spinner, Strong, Text } from '@radix-ui/themes'
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons'
import { useId, type ReactNode } from 'react'
import { useAllocations } from '../api/allocations.ts'
import { useMonthlyRecordsOf, useMonthlyTotals, type MonthlyRecord } from '../api/records.ts'
import type { Unit } from '../api/units.ts'
import {
  formatKwh,
  formatMonth,
  formatMonthCount,
  formatPercent,
  formatSignedKwh,
  formatSignedPercent,
} from '../format.ts'
import { alerts, overview, type Alert, type Overview } from '../insights.ts'
import { ErrorCallout } from './form.tsx'

// Visão geral de todas as unidades: não segue a unidade escolhida no gráfico.
export default function InsightsSection({ units }: { units: Unit[] }) {
  const titleId = useId()

  return (
    <Flex asChild direction="column" gap="3">
      <section aria-labelledby={titleId}>
        <Heading as="h2" size="4" id={titleId}>
          Insights
        </Heading>
        <InsightsContent units={units} />
      </section>
    </Flex>
  )
}

function InsightsContent({ units }: { units: Unit[] }) {
  const totals = useMonthlyTotals()
  const records = useMonthlyRecordsOf(units.map((u) => u.id))
  const allocations = useAllocations()

  if (totals.isPending || allocations.isPending || records.some((r) => r.isPending)) {
    return (
      <Flex justify="center" py="6">
        <Spinner size="3" />
      </Flex>
    )
  }
  const error = totals.error ?? allocations.error ?? records.find((r) => r.error)?.error
  if (error) {
    return <ErrorCallout message={`Erro ao carregar os insights: ${error.message}`} />
  }

  const summary = overview(totals.data!)
  if (!summary) {
    return <Text color="gray">Cadastre os meses das unidades para ver os insights.</Text>
  }
  const unitAlerts = alerts({
    units,
    records: new Map<number, MonthlyRecord[]>(units.map((u, i) => [u.id, records[i].data ?? []])),
    allocations: allocations.data!,
    latestMonth: summary.month,
  })

  return (
    <Flex direction="column" gap="4">
      <Stats summary={summary} />
      <AlertList alerts={unitAlerts} />
    </Flex>
  )
}

function Stats({ summary }: { summary: Overview }) {
  const month = formatMonth(summary.month)
  const previous = summary.previousMonth && formatMonth(summary.previousMonth)
  const { generation } = summary
  const averageText =
    summary.monthsUsed > 1 ? `dos últimos ${summary.monthsUsed} meses` : `de ${month}`

  return (
    <Grid columns={{ initial: '1', sm: '2', md: '4' }} gap="3">
      <Stat
        title="Reserva do banco"
        value={
          summary.reserveMonths === undefined ? 'Sem consumo' : formatMonthCount(summary.reserveMonths)
        }
      >
        Banco de {formatKwh(summary.bankKwh)} para o consumo médio {averageText} (
        {formatKwh(summary.averageUsedKwh)} por mês).
      </Stat>
      <Stat
        title="Cobertura da geração"
        value={summary.coverage === undefined ? 'Sem consumo' : formatPercent(summary.coverage)}
        color={summary.coverage !== undefined && summary.coverage < 1 ? 'orange' : undefined}
      >
        {formatKwh(summary.injectedKwh)} injetados para {formatKwh(summary.usedKwh)} de consumo em{' '}
        {month}.
        {summary.coverage !== undefined && summary.coverage < 1 && ' O banco cobriu a diferença.'}
      </Stat>
      <Stat
        title="Ritmo do banco"
        value={summary.bankChangeKwh === undefined ? '—' : formatSignedKwh(summary.bankChangeKwh)}
        color={summary.bankChangeKwh !== undefined && summary.bankChangeKwh < 0 ? 'orange' : undefined}
      >
        {previous ? (
          <>
            Mudança de {previous} para {month}.
            {summary.bankChangeCount > 1 && (
              <>
                {' '}
                Média das últimas {summary.bankChangeCount} mudanças:{' '}
                <Strong>{formatSignedKwh(summary.averageBankChangeKwh!)}</Strong> por mês.
              </>
            )}
          </>
        ) : (
          'Primeiro mês: sem mês anterior para comparar.'
        )}
      </Stat>
      <Stat title={`Geração de ${month}`} value={formatKwh(summary.injectedKwh)}>
        {generation.averageKwh === undefined ? (
          'Nenhum mês com energia injetada.'
        ) : (
          <>
            {generation.previousRatio !== undefined && (
              <>
                <Strong>{formatSignedPercent(generation.previousRatio)}</Strong> sobre {previous}.{' '}
              </>
            )}
            {generation.averageRatio !== undefined && (
              <>
                <Strong>{formatSignedPercent(generation.averageRatio)}</Strong> sobre a média (
                {formatKwh(generation.averageKwh)}).
              </>
            )}
            {generation.best && generation.worst && (
              <>
                {' '}
                Melhor mês: {formatMonth(generation.best.month)} ({formatKwh(generation.best.kwh)}).
                Pior: {formatMonth(generation.worst.month)} ({formatKwh(generation.worst.kwh)}).
              </>
            )}
          </>
        )}
      </Stat>
    </Grid>
  )
}

type StatProps = {
  title: string
  value: string
  color?: 'orange'
  children: ReactNode
}

function Stat({ title, value, color, children }: StatProps) {
  const titleId = useId()
  return (
    <Card asChild size="2">
      <section aria-labelledby={titleId}>
        <Flex direction="column" gap="1">
          <Heading as="h3" size="2" weight="regular" color="gray" id={titleId}>
            {title}
          </Heading>
          <Text size="6" weight="bold" color={color}>
            {value}
          </Text>
          <Text size="1" color="gray">
            {children}
          </Text>
        </Flex>
      </section>
    </Card>
  )
}

function AlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return <Text color="gray">Nenhum alerta: os bancos estão estáveis e os meses em dia.</Text>
  }
  return (
    <Flex asChild direction="column" gap="2" m="0" p="0" style={{ listStyle: 'none' }}>
      {/* role="list": o Safari tira o papel de lista quando list-style é none. */}
      <ul role="list" aria-label="Alertas">
        {alerts.map((alert) => (
          <li key={alertKey(alert)}>
            <AlertItem alert={alert} />
          </li>
        ))}
      </ul>
    </Flex>
  )
}

function alertKey(alert: Alert) {
  return alert.kind === 'allocation'
    ? `${alert.kind}-${alert.consumer.id}`
    : `${alert.kind}-${alert.unit.id}`
}

function AlertItem({ alert }: { alert: Alert }) {
  const warning = alert.kind === 'empty-bank' || alert.kind === 'draining'
  return (
    <Callout.Root color={warning ? 'orange' : 'blue'} size="1">
      <Callout.Icon>{warning ? <ExclamationTriangleIcon /> : <InfoCircledIcon />}</Callout.Icon>
      <Callout.Text>
        <AlertText alert={alert} />
      </Callout.Text>
    </Callout.Root>
  )
}

function AlertText({ alert }: { alert: Alert }) {
  switch (alert.kind) {
    case 'empty-bank':
      return (
        <>
          <Strong>{alert.unit.name}</Strong>: o banco zerou em {formatMonth(alert.month)}.{' '}
          {formatKwh(alert.missingKwh)} de consumo ficaram sem crédito para compensar.
        </>
      )
    case 'draining':
      return (
        <>
          <Strong>{alert.unit.name}</Strong>: o banco está caindo{' '}
          {formatKwh(-alert.changeKwh)} por mês. Com {formatKwh(alert.bankKwh)} em{' '}
          {formatMonth(alert.month)}, zera em cerca de {formatMonthCount(alert.monthsLeft)}.
        </>
      )
    case 'allocation':
      return (
        <>
          <Strong>{alert.consumer.name}</Strong> recebeu menos do que consumiu em{' '}
          {formatMonth(alert.month)} ({formatKwh(alert.usedKwh)}), enquanto {alert.generator.name}{' '}
          guardou energia no próprio banco. Subir o rateio de {alert.percentage}% para{' '}
          <Strong>{alert.suggested}%</Strong>{' '}
          {alert.covers
            ? 'cobriria esse consumo.'
            : 'é o máximo livre da geradora e cobriria só parte desse consumo.'}
        </>
      )
    case 'missing-month':
      return (
        <>
          <Strong>{alert.unit.name}</Strong>: falta lançar {formatMonth(alert.month)}.
        </>
      )
    case 'no-records':
      return (
        <>
          <Strong>{alert.unit.name}</Strong> ainda não tem meses cadastrados.
        </>
      )
  }
}
