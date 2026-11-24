-- Migration 017: historico dos links de internet (grafico "Internet" da aba Infraestrutura).
--   network_wan guarda so' o ULTIMO estado de cada WAN. Esta tabela guarda uma amostra por
--   WAN a cada ciclo do poller (~60 s): trafego, latencia e se estava no ar.
--   Volume: 2 WANs x 1.440 ciclos/dia x 31 dias ~ 90 mil linhas. O proprio poller apaga
--   o que passa de 31 dias.
CREATE TABLE IF NOT EXISTS optsislog.network_wan_samples (
  wan_group TEXT NOT NULL,            -- "WAN", "WAN2"...
  sampled_at TIMESTAMPTZ NOT NULL,    -- hora do ciclo do poller
  is_up BOOLEAN,
  latency_ms REAL,
  rx_bps BIGINT,                      -- download (recebido da internet), bits/s
  tx_bps BIGINT,                      -- upload, bits/s
  PRIMARY KEY (wan_group, sampled_at)
);

CREATE INDEX IF NOT EXISTS idx_network_wan_samples_sampled_at
  ON optsislog.network_wan_samples (sampled_at);
