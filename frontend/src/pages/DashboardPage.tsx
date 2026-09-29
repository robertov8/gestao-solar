import { Button, Flex, Heading, Spinner } from '@radix-ui/themes'
import { PlusIcon } from '@radix-ui/react-icons'
import { useId } from 'react'
import { useUnits } from '../api/units.ts'
import AllocationFormDialog from '../components/AllocationFormDialog.tsx'
import BankTotalCard from '../components/BankTotalCard.tsx'
import EnergyChart from '../components/EnergyChart.tsx'
import { ErrorCallout } from '../components/form.tsx'
import InsightsSection from '../components/InsightsSection.tsx'
import MonthlyRecordFormDialog from '../components/MonthlyRecordFormDialog.tsx'
import UnitFormDialog from '../components/UnitFormDialog.tsx'
import UnitsTable from '../components/UnitsTable.tsx'

export default function DashboardPage() {
  const { data: units, isPending, error } = useUnits()
  const unitsTitleId = useId()

  return (
    <Flex direction="column" gap="5">
      <Flex justify="between" align="center" wrap="wrap" gap="3">
        <Heading size="6">Painel de energia</Heading>
        <Flex gap="2" wrap="wrap">
          <UnitFormDialog
            trigger={
              <Button>
                <PlusIcon /> Nova unidade
              </Button>
            }
          />
          <AllocationFormDialog
            trigger={
              <Button variant="soft">
                <PlusIcon /> Novo rateio
              </Button>
            }
          />
          <MonthlyRecordFormDialog
            trigger={
              <Button variant="soft">
                <PlusIcon /> Adicionar mês
              </Button>
            }
          />
        </Flex>
      </Flex>

      <BankTotalCard />

      {isPending ? (
        <Flex justify="center" py="6">
          <Spinner size="3" />
        </Flex>
      ) : error ? (
        <ErrorCallout message={`Erro ao carregar as unidades: ${error.message}`} />
      ) : (
        <>
          <EnergyChart units={units} />
          <InsightsSection units={units} />
          <Flex asChild direction="column" gap="3">
            <section aria-labelledby={unitsTitleId}>
              <Heading as="h2" size="4" id={unitsTitleId}>
                Unidades
              </Heading>
              <UnitsTable units={units} />
            </section>
          </Flex>
        </>
      )}
    </Flex>
  )
}
