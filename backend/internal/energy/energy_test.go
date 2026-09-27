package energy

import (
	"testing"
	"time"

	"gestao-solar/backend/internal/month"
	"gestao-solar/backend/internal/units"
)

var (
	jan = month.New(2026, time.January)
	feb = month.New(2026, time.February)
	mar = month.New(2026, time.March)
	may = month.New(2026, time.May)
)

// Unidades usadas nos testes: 1 e 2 são geradoras; 10, 11 e 12 são consumidoras.
var types = map[int64]units.Type{
	1:  units.Generator,
	2:  units.Generator,
	10: units.Consumer,
	11: units.Consumer,
	12: units.Consumer,
}

func find(t *testing.T, results []Result, unitID int64, m month.Month) Result {
	t.Helper()
	for _, r := range results {
		if r.UnitID == unitID && r.Month == m {
			return r
		}
	}
	t.Fatalf("sem resultado para a unidade %d em %s", unitID, m)
	return Result{}
}

func expect(t *testing.T, got Result, allocated, balance float64) {
	t.Helper()
	if got.Allocated != allocated || got.UpdatedBalance != balance {
		t.Fatalf("unidade %d em %s: rateada %v, banco %v; esperado %v, %v",
			got.UnitID, got.Month, got.Allocated, got.UpdatedBalance, allocated, balance)
	}
}

func TestCalculateSplitsGeneratorSurplus(t *testing.T) {
	allocs := []Allocation{
		{GeneratorID: 1, ConsumerID: 10, Percentage: 30, StartMonth: jan},
		{GeneratorID: 1, ConsumerID: 11, Percentage: 50, StartMonth: jan},
	}
	entries := []Entry{
		{UnitID: 1, Month: jan, Injected: 1000, Used: 400},
		{UnitID: 10, Month: jan, Used: 100},
	}

	results := Calculate(types, entries, allocs)

	expect(t, find(t, results, 1, jan), 480, 120)
	expect(t, find(t, results, 10, jan), 180, 80)
	// A consumidora 11 não tinha registro: o mês é criado para a energia não se perder.
	expect(t, find(t, results, 11, jan), 300, 300)
}

func TestCalculateBankCoversDeficitAndNeverGoesNegative(t *testing.T) {
	allocs := []Allocation{{GeneratorID: 1, ConsumerID: 10, Percentage: 50, StartMonth: jan}}
	entries := []Entry{
		{UnitID: 1, Month: jan, Injected: 100, Used: 50},
		{UnitID: 1, Month: feb, Injected: 0, Used: 200},
		{UnitID: 10, Month: feb, Used: 10},
	}

	results := Calculate(types, entries, allocs)

	expect(t, find(t, results, 1, jan), 25, 25)
	expect(t, find(t, results, 1, feb), 0, 0)
	expect(t, find(t, results, 10, jan), 25, 25)
	expect(t, find(t, results, 10, feb), 0, 15)
}

func TestCalculateKeepsPercentageHistory(t *testing.T) {
	allocs := []Allocation{
		{GeneratorID: 1, ConsumerID: 10, Percentage: 30, StartMonth: jan},
		{GeneratorID: 1, ConsumerID: 10, Percentage: 50, StartMonth: feb},
	}
	entries := []Entry{
		{UnitID: 1, Month: jan, Injected: 1000},
		{UnitID: 1, Month: feb, Injected: 1000},
	}

	results := Calculate(types, entries, allocs)

	expect(t, find(t, results, 10, jan), 300, 300)
	expect(t, find(t, results, 10, feb), 500, 800)
	expect(t, find(t, results, 1, jan), 300, 700)
	expect(t, find(t, results, 1, feb), 500, 1200)
}

func TestCalculateConsumerSwitchesGenerator(t *testing.T) {
	allocs := []Allocation{
		{GeneratorID: 1, ConsumerID: 10, Percentage: 50, StartMonth: jan},
		{GeneratorID: 2, ConsumerID: 10, Percentage: 20, StartMonth: feb},
	}
	entries := []Entry{
		{UnitID: 1, Month: jan, Injected: 1000},
		{UnitID: 1, Month: feb, Injected: 1000},
		{UnitID: 2, Month: jan, Injected: 1000},
		{UnitID: 2, Month: feb, Injected: 1000},
	}

	results := Calculate(types, entries, allocs)

	expect(t, find(t, results, 10, jan), 500, 500)
	expect(t, find(t, results, 10, feb), 200, 700)
	expect(t, find(t, results, 1, feb), 0, 1500)
	expect(t, find(t, results, 2, jan), 0, 1000)
}

func TestCalculateSkipsConsumerWithZeroPercentage(t *testing.T) {
	allocs := []Allocation{
		{GeneratorID: 1, ConsumerID: 10, Percentage: 40, StartMonth: jan},
		{GeneratorID: 1, ConsumerID: 10, Percentage: 0, StartMonth: feb},
	}
	entries := []Entry{
		{UnitID: 1, Month: feb, Injected: 1000},
	}

	results := Calculate(types, entries, allocs)

	if len(results) != 1 {
		t.Fatalf("esperado só o resultado da geradora, veio %+v", results)
	}
	expect(t, results[0], 0, 1000)
}

func TestExceedsLimit(t *testing.T) {
	tests := []struct {
		name      string
		allocs    []Allocation
		from      month.Month
		wantOver  bool
		wantMonth month.Month
		wantTotal int
	}{
		{
			name: "até 100% é permitido",
			allocs: []Allocation{
				{GeneratorID: 1, ConsumerID: 10, Percentage: 60, StartMonth: jan},
				{GeneratorID: 1, ConsumerID: 11, Percentage: 40, StartMonth: jan},
			},
			from: jan,
		},
		{
			name: "passa de 100% no mês de início",
			allocs: []Allocation{
				{GeneratorID: 1, ConsumerID: 10, Percentage: 60, StartMonth: jan},
				{GeneratorID: 1, ConsumerID: 11, Percentage: 50, StartMonth: mar},
			},
			from:      mar,
			wantOver:  true,
			wantMonth: mar,
			wantTotal: 110,
		},
		{
			name: "passa de 100% num mês seguinte",
			allocs: []Allocation{
				{GeneratorID: 1, ConsumerID: 10, Percentage: 60, StartMonth: jan},
				{GeneratorID: 1, ConsumerID: 11, Percentage: 30, StartMonth: may},
				{GeneratorID: 1, ConsumerID: 12, Percentage: 20, StartMonth: feb},
			},
			from:      feb,
			wantOver:  true,
			wantMonth: may,
			wantTotal: 110,
		},
		{
			name: "consumidora que trocou de geradora não conta mais",
			allocs: []Allocation{
				{GeneratorID: 1, ConsumerID: 10, Percentage: 60, StartMonth: jan},
				{GeneratorID: 2, ConsumerID: 10, Percentage: 60, StartMonth: mar},
				{GeneratorID: 1, ConsumerID: 11, Percentage: 50, StartMonth: mar},
			},
			from: mar,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, total, over := ExceedsLimit(tt.allocs, 1, tt.from)
			if over != tt.wantOver || m != tt.wantMonth || total != tt.wantTotal {
				t.Fatalf("ExceedsLimit = (%s, %d, %v), esperado (%s, %d, %v)",
					m, total, over, tt.wantMonth, tt.wantTotal, tt.wantOver)
			}
		})
	}
}
