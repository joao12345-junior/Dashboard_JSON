-- Migration 019: aplicativos mais usados (cartao "Principais aplicativos" do Rede > Painel).
--   Fonte: GET v2 traffic-flow-latest-statistics (top_all_traffic_by_application) do UCG,
--   que so' traz ids; o nome vem do catalogo GET /integration/v1/dpi/applications e
--   /dpi/categories (id do catalogo = (categoria << 16) | aplicativo).
--   O poller substitui o ranking de cada periodo a cada ~5 min. Nao guarda historico:
--   o UniFi ja calcula a janela (ultima hora / ultimas 24 h).
CREATE TABLE IF NOT EXISTS optsislog.network_top_apps (
  period TEXT NOT NULL CHECK (period IN ('hour', 'day')),
  rank SMALLINT NOT NULL,                 -- 1 = mais trafego
  application_id INTEGER NOT NULL,        -- id do aplicativo DENTRO da categoria (como a estatistica traz)
  category_id INTEGER NOT NULL,
  name TEXT,                              -- NULL se o catalogo nao conhece o id
  category TEXT,
  bytes BIGINT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (period, rank)
);
