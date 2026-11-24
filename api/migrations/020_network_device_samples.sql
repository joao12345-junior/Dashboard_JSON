-- Migration 020: historico de CPU e memoria dos dispositivos UniFi (gateway, APs).
--   Motivo (24/11): a memoria e a CPU do gateway subiram ~3-4% a partir das 14:55 e
--   nao havia como cruzar isso com o que o LogDash faz. O poller ja recebe esses numeros
--   a cada ciclo (Integration statistics/latest); aqui so' passam a ser guardados.
--   Volume: ~2 dispositivos x 1.440 ciclos/dia x 31 dias ~ 90 mil linhas.
CREATE TABLE IF NOT EXISTS optsislog.network_device_samples (
  mac TEXT NOT NULL,
  sampled_at TIMESTAMPTZ NOT NULL,
  cpu_pct REAL,
  memory_pct REAL,
  PRIMARY KEY (mac, sampled_at)
);

CREATE INDEX IF NOT EXISTS idx_network_device_samples_sampled_at
  ON optsislog.network_device_samples (sampled_at);
