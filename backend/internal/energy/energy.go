// Package energy tem as regras do rateio e do banco de kWh.
// Não acessa o banco de dados: recebe os dados e devolve os resultados.
package energy

import (
	"maps"
	"math"
	"slices"

	"gestao-solar/backend/internal/month"
	"gestao-solar/backend/internal/units"
)

// MaxShare é o limite da soma do rateio de uma geradora, em porcentagem.
const MaxShare = 100

type Allocation struct {
	GeneratorID int64
	ConsumerID  int64
	Percentage  int
	StartMonth  month.Month
}

// Entry é o que o usuário informa para uma unidade num mês.
type Entry struct {
	UnitID   int64
	Month    month.Month
	Injected float64
	Used     float64
}

// Result é o mês de uma unidade já calculado.
type Result struct {
	UnitID         int64
	Month          month.Month
	Allocated      float64
	UpdatedBalance float64
}

type share struct {
	consumerID int64
	percentage int
}

// activeAllocation devolve o rateio que vale para a consumidora no mês:
// a linha com o início mais recente até esse mês.
func activeAllocation(allocs []Allocation, consumerID int64, m month.Month) (Allocation, bool) {
	var best Allocation
	found := false
	for _, a := range allocs {
		if a.ConsumerID != consumerID || a.StartMonth.After(m) {
			continue
		}
		if !found || a.StartMonth.After(best.StartMonth) {
			best, found = a, true
		}
	}
	return best, found
}

// activeShares devolve as consumidoras ligadas à geradora no mês, ordenadas por id.
func activeShares(allocs []Allocation, generatorID int64, m month.Month) []share {
	consumers := map[int64]bool{}
	for _, a := range allocs {
		consumers[a.ConsumerID] = true
	}
	var shares []share
	for _, consumerID := range slices.Sorted(maps.Keys(consumers)) {
		a, ok := activeAllocation(allocs, consumerID, m)
		if ok && a.GeneratorID == generatorID && a.Percentage > 0 {
			shares = append(shares, share{consumerID: consumerID, percentage: a.Percentage})
		}
	}
	return shares
}

// GeneratorShare soma as porcentagens que valem para a geradora no mês.
func GeneratorShare(allocs []Allocation, generatorID int64, m month.Month) int {
	total := 0
	for _, s := range activeShares(allocs, generatorID, m) {
		total += s.percentage
	}
	return total
}

// ExceedsLimit confere a soma do rateio da geradora a partir do mês from.
// A soma só muda quando uma linha começa; por isso basta olhar esses meses.
// Devolve o primeiro mês acima de MaxShare e a soma nesse mês.
func ExceedsLimit(allocs []Allocation, generatorID int64, from month.Month) (month.Month, int, bool) {
	points := []month.Month{from}
	for _, a := range allocs {
		if a.StartMonth.After(from) {
			points = append(points, a.StartMonth)
		}
	}
	slices.SortFunc(points, month.Month.Compare)
	for _, p := range points {
		if total := GeneratorShare(allocs, generatorID, p); total > MaxShare {
			return p, total, true
		}
	}
	return month.Month{}, 0, false
}

// Calculate calcula todos os meses, do mais antigo para o mais novo.
//
// Geradora: sobra = injetada − utilizado. Se a sobra for positiva, cada consumidora
// recebe sobra × porcentagem. O que não foi rateado vai para o banco da geradora.
// Consumidora: sobra = recebida − utilizado.
// Banco = banco anterior + sobra que fica na unidade, nunca abaixo de zero.
// A sobra não é salva: só a energia rateada e o banco.
//
// Se a consumidora está no rateio, mas não tem registro no mês, ela ganha um
// Result novo (injetada e utilizado 0), para a energia recebida não se perder.
func Calculate(types map[int64]units.Type, entries []Entry, allocs []Allocation) []Result {
	byMonth := map[month.Month]map[int64]Entry{}
	for _, e := range entries {
		if byMonth[e.Month] == nil {
			byMonth[e.Month] = map[int64]Entry{}
		}
		byMonth[e.Month][e.UnitID] = e
	}

	balances := map[int64]float64{}
	var results []Result
	for _, m := range slices.SortedFunc(maps.Keys(byMonth), month.Month.Compare) {
		monthEntries := byMonth[m]
		received := map[int64]float64{}

		// Geradoras primeiro: o que a consumidora recebe depende da sobra da geradora.
		for _, id := range slices.Sorted(maps.Keys(monthEntries)) {
			if types[id] != units.Generator {
				continue
			}
			e := monthEntries[id]
			surplus := e.Injected - e.Used
			sent := 0.0
			for _, s := range activeShares(allocs, id, m) {
				amount := 0.0
				if surplus > 0 {
					amount = round(surplus * float64(s.percentage) / 100)
				}
				received[s.consumerID] += amount
				sent += amount
				if _, ok := monthEntries[s.consumerID]; !ok {
					monthEntries[s.consumerID] = Entry{UnitID: s.consumerID, Month: m}
				}
			}
			results = append(results, settle(balances, id, m, sent, surplus-sent))
		}

		for _, id := range slices.Sorted(maps.Keys(monthEntries)) {
			if types[id] != units.Consumer {
				continue
			}
			surplus := received[id] - monthEntries[id].Used
			results = append(results, settle(balances, id, m, received[id], surplus))
		}
	}
	return results
}

// settle fecha o mês da unidade. kept é o que entra no banco (ou sai, se negativo).
func settle(balances map[int64]float64, unitID int64, m month.Month, allocated, kept float64) Result {
	balance := round(max(balances[unitID]+kept, 0))
	balances[unitID] = balance
	return Result{
		UnitID:         unitID,
		Month:          m,
		Allocated:      round(allocated),
		UpdatedBalance: balance,
	}
}

// round arredonda para 3 casas (Wh) e troca -0 por 0.
func round(v float64) float64 {
	r := math.Round(v*1000) / 1000
	if r == 0 {
		return 0
	}
	return r
}
