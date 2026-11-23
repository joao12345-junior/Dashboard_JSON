# Site: modal com o corpo da resposta do check (2026-11-23)

## Pedido
Monitorar o `/health` do cofre e ver, no Site, o que ele devolve (texto simples ou JSON), no padrão do modal de detalhes dos logs.
`/health` do cofre (dev) devolve texto `chave=valor`: `status`, `checked_at`, `latency_ms`, `checks=3/3`.

## Feito (frontend)
- `features/site/components/AvailabilityDetailsModal.tsx` (novo): data/hora, status, código HTTP, tempo, URL e a "Resposta" num textarea somente leitura. JSON vem indentado (`formatDetails`) com "Ver original"; botão "Copiar". Sem corpo, explica o motivo (`undefined` = API ainda não envia; `null` = nada guardado neste check).
- `features/site/SiteList.tsx`: na tabela de disponibilidade, o horário virou botão (`.ld-link-btn`, único foco por teclado) e a linha inteira abre o modal ao clicar.
- O tipo `AvailabilityDetail = AvailabilityRecord & { response_body?: string | null }` mora no modal, para não mexer no `useSiteData.ts` (camada do João). Quando o campo entrar no `AvailabilityRecord`, remover o tipo.
- `tsc` e `eslint` sem erros. **Ainda não testado com dado real**: sem `response_body` o modal mostra o aviso "A API ainda não envia o corpo".

## API e banco (feito em 2026-11-23, a pedido do João)
- Migration `012` aplicada pelo João (colunas + cadastro do cofre).
- `api/routes/site_monitor.py`: `_get_active_monitored_urls` lê `save_response_body`; `_check_url` guarda `response.text[:4096]` só nas URLs com a flag (`None` sem resposta); `_save_check_result` grava `response_body`; `GET /api/site/availability` devolve o campo; `POST /api/site/check` não devolve o corpo ao `sync_site.ps1`.
- `AvailabilityRecord.response_body?` entrou em `useSiteData.ts` e o tipo temporário do modal saiu.
- **Não testado com o Flask rodando**: só `py_compile`, `tsc` e `eslint`. O corpo aparece depois do próximo ciclo do `sync_site.ps1` (ou um `POST /api/site/check`).
- Pendente: `save_response_body` no `PATCH`/`POST` de monitored-urls e checkbox no `monitoredUrlFormModal` (hoje só por SQL).

## Proposta original (histórico)
1. Migration `012_availability_response_body.sql`:
   - `ALTER TABLE optsislog.site_availability ADD COLUMN response_body TEXT;`
   - `ALTER TABLE optsislog.monitored_urls ADD COLUMN save_response_body BOOLEAN NOT NULL DEFAULT false;`
2. `_get_active_monitored_urls` seleciona `save_response_body`; `_check_url` guarda `response.text[:4096]` só quando a flag está ligada (e `None` em exceção); `_save_check_result` grava a coluna.
3. `GET /api/site/availability` devolve `response_body`; `monitored_url` ganha a flag (e o `monitoredUrlFormModal` um checkbox).

## Pontos de atenção
- **Flag por URL, não global**: o Site Optare devolve a home em HTML; guardar isso a cada 30 min por 14 dias é lixo. Só ligar para endpoints de saúde.
- **Vazamento**: `/health` às vezes expõe versão, host, erro de banco. O corpo fica visível a qualquer usuário autenticado do LogDash. Limite de 4 KB.
- **Alcance**: o check roda no servidor 201; a URL cadastrada precisa ser a pública do cofre (subdomínio de optare.com.br), não `localhost:3000`.
- `is_up` continua `status_code < 500`: `status=DEGRADED` com HTTP 200 conta como online. Se importar, o parser do `status=` entra na mesma mudança.

## Migration (criada, não executada): `api/migrations/012_availability_response_body.sql`
Abaixo, o conteúdo original proposto (a migration real é idempotente: `IF NOT EXISTS` e o INSERT do cofre com `WHERE NOT EXISTS`). Rodar com `python api/migrations/run_migration.py`.
URL pública do cofre: `https://cofre.optare.com.br/health` (responde 200 em texto `chave=valor`; conferido no Chrome em 2026-11-23).

```sql
-- Migration 012 (proposta): corpo da resposta nos checks de disponibilidade
ALTER TABLE optsislog.site_availability
  ADD COLUMN response_body TEXT;

ALTER TABLE optsislog.monitored_urls
  ADD COLUMN save_response_body BOOLEAN NOT NULL DEFAULT false;

-- Cadastro do cofre (mesmo molde do Atendimento Bot; sem Sentry)
INSERT INTO optsislog.monitored_urls (label, url, timeout_seconds, has_sentry, save_response_body)
VALUES ('Cofre', 'https://cofre.optare.com.br/health', 10, false, true);

-- Opcional: o Atendimento Bot tambem tem /health
-- UPDATE optsislog.monitored_urls SET save_response_body = true
-- WHERE url = 'https://optare-atendimento.onrender.com/health';
```
Rodar a migration antes do deploy do `site_monitor.py` novo: o INSERT já grava a flag, mas o corpo só passa a ser guardado quando o `_check_url` for alterado.
