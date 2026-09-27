package server

import (
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"gestao-solar/backend/internal/allocations"
	"gestao-solar/backend/internal/records"
	"gestao-solar/backend/internal/units"
)

func createUnit(t *testing.T, base, name string, typ units.Type) units.Unit {
	t.Helper()
	res := do(t, "POST", base+"/api/units", units.CreateInput{Name: name, Type: typ})
	expectStatus(t, res, http.StatusCreated)
	return decode[units.Unit](t, res)
}

func postAllocation(t *testing.T, base string, generator, consumer units.Unit, percentage int, start string) *http.Response {
	t.Helper()
	return do(t, "POST", base+"/api/allocations", map[string]any{
		"generatorUnitId": generator.ID,
		"consumerUnitId":  consumer.ID,
		"percentage":      percentage,
		"startMonth":      start,
	})
}

func putRecord(t *testing.T, base string, unit units.Unit, month string, injected, used float64) *http.Response {
	t.Helper()
	return do(t, "PUT", base+"/api/monthly-records", map[string]any{
		"unitId":            unit.ID,
		"referenceMonth":    month,
		"injectedEnergyKwh": injected,
		"usedBalanceKwh":    used,
	})
}

func unitRecords(t *testing.T, base string, unit units.Unit) []records.Record {
	t.Helper()
	res := do(t, "GET", base+"/api/monthly-records?unitId="+strconv.FormatInt(unit.ID, 10), nil)
	expectStatus(t, res, http.StatusOK)
	return decode[[]records.Record](t, res)
}

func expectError(t *testing.T, res *http.Response, status int, parts ...string) {
	t.Helper()
	expectStatus(t, res, status)
	msg := decode[map[string]string](t, res)["error"]
	for _, p := range parts {
		if !strings.Contains(msg, p) {
			t.Fatalf("mensagem %q não contém %q", msg, p)
		}
	}
}

func expectRecord(t *testing.T, rec records.Record, allocated, balance float64) {
	t.Helper()
	if rec.AllocatedEnergyKwh != allocated || rec.UpdatedBalanceKwh != balance {
		t.Fatalf("registro %+v: esperado rateada %v, banco %v", rec, allocated, balance)
	}
}

func TestUnitsAPI(t *testing.T) {
	srv := newTestServer(t)
	base := srv.URL + "/api/units"

	usina := createUnit(t, srv.URL, "  Usina  ", units.Generator)
	if usina.Name != "Usina" || usina.CreatedAt.IsZero() {
		t.Fatalf("unidade criada inesperada: %+v", usina)
	}
	createUnit(t, srv.URL, "Casa", units.Consumer)
	apto := createUnit(t, srv.URL, "Apto", units.Consumer)

	res := do(t, "GET", base, nil)
	expectStatus(t, res, http.StatusOK)
	var names []string
	for _, u := range decode[[]units.Unit](t, res) {
		names = append(names, u.Name)
	}
	if got := strings.Join(names, ","); got != "Usina,Apto,Casa" {
		t.Fatalf("ordem da lista: %s", got)
	}

	item := base + "/" + strconv.FormatInt(usina.ID, 10)
	res = do(t, "PUT", item, units.UpdateInput{Name: "Usina Norte"})
	expectStatus(t, res, http.StatusOK)
	if updated := decode[units.Unit](t, res); updated.Name != "Usina Norte" || updated.Type != units.Generator {
		t.Fatalf("unidade atualizada inesperada: %+v", updated)
	}

	expectStatus(t, do(t, "PUT", item, map[string]string{"name": "x", "type": "consumer"}), http.StatusBadRequest)
	expectStatus(t, do(t, "POST", base, units.CreateInput{Name: "X", Type: "outro"}), http.StatusBadRequest)
	expectStatus(t, do(t, "POST", base, units.CreateInput{Name: "  ", Type: units.Consumer}), http.StatusBadRequest)
	expectStatus(t, do(t, "GET", base+"/abc", nil), http.StatusBadRequest)

	aptoItem := base + "/" + strconv.FormatInt(apto.ID, 10)
	expectStatus(t, do(t, "DELETE", aptoItem, nil), http.StatusNoContent)
	expectStatus(t, do(t, "GET", aptoItem, nil), http.StatusNotFound)
	expectStatus(t, do(t, "DELETE", aptoItem, nil), http.StatusNotFound)
}

func TestDeleteUnitWithHistory(t *testing.T) {
	srv := newTestServer(t)
	usina := createUnit(t, srv.URL, "Usina", units.Generator)
	casa := createUnit(t, srv.URL, "Casa", units.Consumer)
	expectStatus(t, postAllocation(t, srv.URL, usina, casa, 10, "2026-01"), http.StatusCreated)

	for _, u := range []units.Unit{usina, casa} {
		item := srv.URL + "/api/units/" + strconv.FormatInt(u.ID, 10)
		expectError(t, do(t, "DELETE", item, nil), http.StatusConflict, "histórico")
		expectStatus(t, do(t, "GET", item, nil), http.StatusOK)
	}
}

func TestAllocationsAPI(t *testing.T) {
	srv := newTestServer(t)
	usina := createUnit(t, srv.URL, "Usina", units.Generator)
	outra := createUnit(t, srv.URL, "Outra usina", units.Generator)
	casa := createUnit(t, srv.URL, "Casa", units.Consumer)
	loja := createUnit(t, srv.URL, "Loja", units.Consumer)

	expectStatus(t, postAllocation(t, srv.URL, usina, casa, 60, "2026-01"), http.StatusCreated)
	expectError(t, postAllocation(t, srv.URL, usina, loja, 50, "2026-01"), http.StatusBadRequest,
		"passa de 100%", "110%", "01/2026")
	expectStatus(t, postAllocation(t, srv.URL, usina, loja, 40, "2026-01"), http.StatusCreated)

	expectError(t, postAllocation(t, srv.URL, usina, casa, 10, "2026-01"), http.StatusConflict, "já tem um rateio")
	expectError(t, postAllocation(t, srv.URL, casa, loja, 10, "2026-01"), http.StatusBadRequest, "não é geradora")
	expectError(t, postAllocation(t, srv.URL, usina, outra, 10, "2026-01"), http.StatusBadRequest, "não é consumidora")
	expectStatus(t, postAllocation(t, srv.URL, usina, casa, 101, "2026-02"), http.StatusBadRequest)
	expectStatus(t, postAllocation(t, srv.URL, usina, casa, 10, ""), http.StatusBadRequest)
	expectStatus(t, postAllocation(t, srv.URL, usina, casa, 10, "2026-13"), http.StatusBadRequest)

	// Nova porcentagem cria uma linha nova; a antiga continua no histórico.
	expectStatus(t, postAllocation(t, srv.URL, usina, casa, 30, "2026-02"), http.StatusCreated)

	res := do(t, "GET", srv.URL+"/api/allocations?generatorUnitId="+strconv.FormatInt(usina.ID, 10), nil)
	expectStatus(t, res, http.StatusOK)
	history := decode[[]allocations.Allocation](t, res)
	if len(history) != 3 {
		t.Fatalf("esperado 3 linhas no histórico, veio %+v", history)
	}
	if first := history[0]; first.Percentage != 30 || first.StartMonth.String() != "2026-02" {
		t.Fatalf("linha mais nova inesperada: %+v", first)
	}

	expectStatus(t, do(t, "GET", srv.URL+"/api/allocations?generatorUnitId=abc", nil), http.StatusBadRequest)
}

func TestMonthlyTotals(t *testing.T) {
	srv := newTestServer(t)
	getTotals := func() []records.MonthlyTotal {
		t.Helper()
		res := do(t, "GET", srv.URL+"/api/monthly-totals", nil)
		expectStatus(t, res, http.StatusOK)
		return decode[[]records.MonthlyTotal](t, res)
	}
	if totals := getTotals(); totals == nil || len(totals) != 0 {
		t.Fatalf("sem meses, esperado lista vazia, veio %+v", totals)
	}

	usina := createUnit(t, srv.URL, "Usina", units.Generator)
	outra := createUnit(t, srv.URL, "Outra usina", units.Generator)
	casa := createUnit(t, srv.URL, "Casa", units.Consumer)
	loja := createUnit(t, srv.URL, "Loja", units.Consumer)
	expectStatus(t, postAllocation(t, srv.URL, usina, casa, 30, "2026-01"), http.StatusCreated)
	expectStatus(t, postAllocation(t, srv.URL, usina, loja, 50, "2026-01"), http.StatusCreated)
	expectStatus(t, putRecord(t, srv.URL, usina, "2026-01", 1000, 400), http.StatusOK)
	expectStatus(t, putRecord(t, srv.URL, usina, "2026-02", 500, 100), http.StatusOK)
	expectStatus(t, putRecord(t, srv.URL, casa, "2026-01", 0, 100), http.StatusOK)
	// A outra usina só tem janeiro: o banco dela (50) continua na soma de fevereiro.
	expectStatus(t, putRecord(t, srv.URL, outra, "2026-01", 50, 0), http.StatusOK)

	totals := getTotals()
	if len(totals) != 2 {
		t.Fatalf("esperado 2 meses, veio %+v", totals)
	}
	// Janeiro: bancos 120 (usina) + 80 (casa) + 300 (loja) + 50 (outra).
	jan := totals[0]
	if jan.ReferenceMonth.String() != "2026-01" || jan.InjectedEnergyKwh != 1050 ||
		jan.UsedBalanceKwh != 500 || jan.UpdatedBalanceKwh != 550 {
		t.Fatalf("janeiro inesperado: %+v", jan)
	}
	// Fevereiro: bancos 200 (usina) + 200 (casa) + 500 (loja) + 50 (outra, sem registro).
	feb := totals[1]
	if feb.ReferenceMonth.String() != "2026-02" || feb.InjectedEnergyKwh != 500 ||
		feb.UsedBalanceKwh != 100 || feb.UpdatedBalanceKwh != 950 {
		t.Fatalf("fevereiro inesperado: %+v", feb)
	}

	// O banco do último mês é o mesmo total do card do painel.
	res := do(t, "GET", srv.URL+"/api/summary", nil)
	expectStatus(t, res, http.StatusOK)
	if s := decode[records.Summary](t, res); s.TotalBalanceKwh != feb.UpdatedBalanceKwh {
		t.Fatalf("total do resumo %v diferente do último mês %v", s.TotalBalanceKwh, feb.UpdatedBalanceKwh)
	}
}

func TestMonthlyRecordsRecalculate(t *testing.T) {
	srv := newTestServer(t)
	usina := createUnit(t, srv.URL, "Usina", units.Generator)
	casa := createUnit(t, srv.URL, "Casa", units.Consumer)
	loja := createUnit(t, srv.URL, "Loja", units.Consumer)
	expectStatus(t, postAllocation(t, srv.URL, usina, casa, 30, "2026-01"), http.StatusCreated)
	expectStatus(t, postAllocation(t, srv.URL, usina, loja, 50, "2026-01"), http.StatusCreated)

	res := putRecord(t, srv.URL, usina, "2026-01", 1000, 400)
	expectStatus(t, res, http.StatusOK)
	saved := decode[records.Record](t, res)
	if saved.ReferenceMonth.String() != "2026-01" {
		t.Fatalf("mês salvo inesperado: %s", saved.ReferenceMonth)
	}
	expectRecord(t, saved, 480, 120)

	// A energia restante não é mais salva nem enviada pela API.
	res = do(t, "GET", srv.URL+"/api/monthly-records?unitId="+strconv.FormatInt(usina.ID, 10), nil)
	expectStatus(t, res, http.StatusOK)
	if body, _ := io.ReadAll(res.Body); strings.Contains(string(body), "remaining") {
		t.Fatalf("a resposta ainda traz a energia restante: %s", body)
	}

	// A consumidora sem registro ganha o mês com uso 0.
	casaRecords := unitRecords(t, srv.URL, casa)
	if len(casaRecords) != 1 {
		t.Fatalf("esperado 1 mês para a Casa, veio %+v", casaRecords)
	}
	expectRecord(t, casaRecords[0], 180, 180)

	res = putRecord(t, srv.URL, casa, "2026-01", 0, 100)
	expectStatus(t, res, http.StatusOK)
	expectRecord(t, decode[records.Record](t, res), 180, 80)

	res = do(t, "GET", srv.URL+"/api/summary", nil)
	expectStatus(t, res, http.StatusOK)
	if s := decode[records.Summary](t, res); s.TotalBalanceKwh != 500 || len(s.Units) != 3 {
		t.Fatalf("resumo inesperado: %+v", s)
	}

	expectError(t, putRecord(t, srv.URL, casa, "2026-01", 10, 0), http.StatusBadRequest, "consumidora")
	expectStatus(t, putRecord(t, srv.URL, units.Unit{ID: 999}, "2026-01", 0, 0), http.StatusBadRequest)
	expectStatus(t, putRecord(t, srv.URL, usina, "2026-01", -1, 0), http.StatusBadRequest)
	expectStatus(t, do(t, "GET", srv.URL+"/api/monthly-records", nil), http.StatusBadRequest)

	// O mês da Casa recebe energia do rateio: apagar recriaria o mês, então é recusado.
	casaItem := srv.URL + "/api/monthly-records/" + strconv.FormatInt(casaRecords[0].ID, 10)
	expectError(t, do(t, "DELETE", casaItem, nil), http.StatusConflict, "recebe energia do rateio")
	expectRecord(t, unitRecords(t, srv.URL, casa)[0], 180, 80)

	// Apagar o mês da geradora tira a energia que a Casa tinha recebido.
	item := srv.URL + "/api/monthly-records/" + strconv.FormatInt(saved.ID, 10)
	expectStatus(t, do(t, "DELETE", item, nil), http.StatusNoContent)
	expectRecord(t, unitRecords(t, srv.URL, casa)[0], 0, 0)
	expectStatus(t, do(t, "DELETE", item, nil), http.StatusNotFound)

	// Sem energia do rateio, o mês da consumidora pode ser apagado.
	expectStatus(t, do(t, "DELETE", casaItem, nil), http.StatusNoContent)
	if list := unitRecords(t, srv.URL, casa); len(list) != 0 {
		t.Fatalf("o mês da Casa devia ter sido apagado: %+v", list)
	}
}
