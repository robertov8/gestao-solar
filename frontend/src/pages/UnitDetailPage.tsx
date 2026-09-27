import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Link,
  Spinner,
  Strong,
  Text,
} from '@radix-ui/themes'
import { ArrowLeftIcon, Pencil1Icon, PlusIcon, TrashIcon } from '@radix-ui/react-icons'
import { useId } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client.ts'
import { useSummary } from '../api/summary.ts'
import { unitTypeLabel, useDeleteUnit, useUnit, type Unit } from '../api/units.ts'
import AllocationHistory from '../components/AllocationHistory.tsx'
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog.tsx'
import { ErrorCallout } from '../components/form.tsx'
import MonthlyRecordFormDialog from '../components/MonthlyRecordFormDialog.tsx'
import MonthsTable from '../components/MonthsTable.tsx'
import UnitFormDialog from '../components/UnitFormDialog.tsx'
import { formatKwh } from '../format.ts'

export default function UnitDetailPage() {
  const params = useParams()
  const id = Number(params.id)
  const validId = Number.isInteger(id) && id > 0
  const { data: unit, isPending, error } = useUnit(validId ? id : undefined)

  let content
  if (!validId || (error instanceof ApiError && error.status === 404)) {
    content = <Text>Unidade não encontrada. Ela pode ter sido apagada.</Text>
  } else if (error) {
    content = <ErrorCallout message={`Erro ao carregar a unidade: ${error.message}`} />
  } else if (isPending) {
    content = (
      <Flex justify="center" py="6">
        <Spinner size="3" />
      </Flex>
    )
  } else {
    content = <UnitDetail unit={unit} />
  }

  return (
    <Flex direction="column" gap="5">
      <Text size="2">
        <Link asChild>
          <RouterLink to="/">
            <ArrowLeftIcon style={{ verticalAlign: 'middle' }} /> Voltar ao painel
          </RouterLink>
        </Link>
      </Text>
      {content}
    </Flex>
  )
}

function UnitDetail({ unit }: { unit: Unit }) {
  const navigate = useNavigate()
  const remove = useDeleteUnit()
  const monthsTitleId = useId()

  return (
    <Flex direction="column" gap="5">
      <Flex justify="between" align="center" wrap="wrap" gap="3">
        <Flex align="center" gap="3">
          <Heading size="6">{unit.name}</Heading>
          <Badge size="2" color={unit.type === 'generator' ? 'amber' : 'blue'}>
            {unitTypeLabel[unit.type]}
          </Badge>
        </Flex>
        <Flex gap="2" wrap="wrap">
          <UnitFormDialog
            unit={unit}
            trigger={
              <Button variant="soft">
                <Pencil1Icon /> Editar nome
              </Button>
            }
          />
          <ConfirmDeleteDialog
            title="Apagar unidade"
            description={
              <>
                Apagar <Strong>{unit.name}</Strong>? Esta ação não pode ser desfeita.
              </>
            }
            trigger={
              <Button variant="soft" color="red">
                <TrashIcon /> Apagar unidade
              </Button>
            }
            onConfirm={async () => {
              await remove.mutateAsync(unit.id)
              navigate('/')
            }}
          />
        </Flex>
      </Flex>

      <UnitBalanceCard unitId={unit.id} />

      <Flex asChild direction="column" gap="3">
        <section aria-labelledby={monthsTitleId}>
          <Flex justify="between" align="center" wrap="wrap" gap="3">
            <Heading as="h2" size="4" id={monthsTitleId}>
              Meses
            </Heading>
            <MonthlyRecordFormDialog
              unit={unit}
              trigger={
                <Button>
                  <PlusIcon /> Adicionar mês
                </Button>
              }
            />
          </Flex>
          <MonthsTable unit={unit} />
        </section>
      </Flex>

      <Box>
        <AllocationHistory unit={unit} title="Rateio" headingAs="h2" />
        <Text as="p" size="2" color="gray" mt="2">
          Para mudar o rateio, use o botão "Novo rateio" no painel.
        </Text>
      </Box>
    </Flex>
  )
}

function UnitBalanceCard({ unitId }: { unitId: number }) {
  const { data: summary } = useSummary()
  const titleId = useId()
  const balance = summary?.units.find((b) => b.unitId === unitId)?.balanceKwh

  return (
    <Card asChild size="3">
      <section aria-labelledby={titleId}>
        <Text as="p" id={titleId} size="2" color="gray">
          Saldo atualizado (Banco de kWh)
        </Text>
        {balance === undefined ? (
          <Spinner size="3" />
        ) : (
          <Text as="p" size="7" weight="bold">
            {formatKwh(balance)}
          </Text>
        )}
      </section>
    </Card>
  )
}
