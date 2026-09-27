// Package month representa o mês de referência (ano e mês) usado nos registros e no rateio.
package month

import (
	"cmp"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const layout = "2006-01"

var errInvalid = errors.New("mês inválido: use o formato AAAA-MM")

// Month é um mês sem dia e sem fuso horário. O valor zero indica mês vazio.
// Na API usa o formato "2026-09"; no banco é salvo como o dia 1 às 00:00 (UTC).
type Month struct {
	year  int
	month time.Month
}

func New(year int, m time.Month) Month {
	t := time.Date(year, m, 1, 0, 0, 0, 0, time.UTC)
	return Month{year: t.Year(), month: t.Month()}
}

func Parse(s string) (Month, error) {
	t, err := time.Parse(layout, strings.TrimSpace(s))
	if err != nil {
		return Month{}, errInvalid
	}
	return New(t.Year(), t.Month()), nil
}

func (m Month) IsZero() bool {
	return m.year == 0
}

// Compare devolve -1, 0 ou +1, como time.Time.Compare.
func (m Month) Compare(o Month) int {
	return cmp.Compare(m.index(), o.index())
}

func (m Month) After(o Month) bool {
	return m.Compare(o) > 0
}

func (m Month) index() int {
	return m.year*12 + int(m.month) - 1
}

func (m Month) String() string {
	return fmt.Sprintf("%04d-%02d", m.year, m.month)
}

// Label devolve o mês no formato usado na tela: MM/AAAA.
func (m Month) Label() string {
	return fmt.Sprintf("%02d/%04d", m.month, m.year)
}

func (m Month) MarshalJSON() ([]byte, error) {
	if m.IsZero() {
		return []byte("null"), nil
	}
	return json.Marshal(m.String())
}

func (m *Month) UnmarshalJSON(b []byte) error {
	var s *string
	if err := json.Unmarshal(b, &s); err != nil {
		return errInvalid
	}
	if s == nil || *s == "" {
		*m = Month{}
		return nil
	}
	parsed, err := Parse(*s)
	if err != nil {
		return err
	}
	*m = parsed
	return nil
}

func (m Month) Value() (driver.Value, error) {
	return fmt.Sprintf("%04d-%02d-01 00:00:00", m.year, m.month), nil
}

func (m *Month) Scan(src any) error {
	switch v := src.(type) {
	case time.Time:
		v = v.UTC()
		*m = New(v.Year(), v.Month())
		return nil
	case string:
		return m.scanText(v)
	case []byte:
		return m.scanText(string(v))
	}
	return fmt.Errorf("month: tipo não suportado %T", src)
}

func (m *Month) scanText(s string) error {
	if len(s) < len(layout) {
		return errInvalid
	}
	parsed, err := Parse(s[:len(layout)])
	if err != nil {
		return err
	}
	*m = parsed
	return nil
}
