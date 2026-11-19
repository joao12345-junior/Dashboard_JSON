# Auditoria inicial do LogDash

Data: 2026-11-19 | Status: **somente análise — nenhum código do projeto foi alterado nesta etapa.**

## Escopo e método
- `tsc --noEmit` e `eslint` (config atual do projeto) sobre `src/`, `vite.config.ts` e `eslint.config.js`.
- `eslint` extra com `strictTypeChecked` (config temporária, **não** versionada) para achar problemas mais profundos.
- `ruff` (E9, F, B, S, PLE, PLW) e `bandit` em `api/*.py`, `api/routes/*.py`, `api/migrations/run_migration.py`.
- Leitura manual: `App.tsx`, `AppList.tsx`, `AppLogMapper.tsx`, `LogTable.tsx`, `HomePage.tsx`, `usehomeStats.ts`, `Loading.tsx`, `auth.py`, `logs.py`, `site_monitor.py`, `test_connection.py`, `db.py`, `app.py`, `config.py`, `vite.config.ts`.
- **Não lido de propósito:** `api/.env`. Não revisados em profundidade: `settingsPage.tsx` (1296 linhas), `CriticalEventsFeed.tsx`, `useProgressiveLogs.ts`, `stream_asgi.py`, `notify_listener.py`.
- Os arquivos temporários `_audit-src.tar` e `_audit-api.tar` ficaram em `Claude outputs/` (fora do repositório); podem ser apagados.

## Sobre "instalar lint"
**Já está instalado e limpo.** `eslint` 10 + `typescript-eslint` + `react-hooks` + `react-refresh` configurados em `eslint.config.js`, script `npm run lint`. Resultado: **0 erros e 0 avisos** em 91 arquivos; `tsc` também com 0 erros. Há ~12 `eslint-disable` pontuais, todos com justificativa.
- A config atual usa `recommended` (sem checagem de tipos). Com `strictTypeChecked` saem 254 achados, **a maioria só estilo** (88 `no-confusing-void-expression`, 67 `restrict-template-expressions`). Não vale ligar tudo.
- Sugestão: acrescentar à config oficial só as regras que acharam problema real: `no-floating-promises`, `no-misused-promises` e `no-unsafe-*` (exige type-aware, mais lento).
- Python: não há linter configurado na API. Sugestão: `ruff` (e opcionalmente `bandit`) em `api/`.

## Achados (ordenados por importância)

### Média / a verificar primeiro
1. **Fuso horário possivelmente errado (a verificar com dado real).** `ocorrido_em` e `time_created` são `TIMESTAMPTZ`; a API devolve `.isoformat()` (ex.: `...T14:23:05.123456+00:00`) e `AppLogMapper`/`WindowsEventLogMapper` separam data/hora pelos dígitos, **ignorando o offset**. Se o banco devolve UTC, a tela mostra hora UTC (3 h à frente de Brasília) e eventos entre 21h e 24h locais caem no dia seguinte. Se o timestamp vier sem microssegundos, `time` ainda incluiria `+00:00`. Impacta diretamente a futura Home "hoje/ontem". Teste: comparar a hora de um log conhecido com a hora exibida.
2. **Servidor de desenvolvimento do Vite em produção** (`npm run dev` + `server.host: true`). Não é feito para produção; já houve vulnerabilidades de leitura de arquivos em dev servers do Vite expostos em rede. Também: `vite.config.ts` lê `certs/*.pem` ao carregar a config (qualquer `vite build` sem os certificados quebra). Caminho já planejado: Plano B (um único processo servindo o build).
3. **Promises sem tratamento (10 `no-floating-promises`):** `App.tsx:199-200`, `useSiteData.ts:78,123`, `useAuth.tsx:139`, `useNewDataDetector.tsx:48`, entre outros. Rejeição não tratada = erro silencioso ou "unhandled rejection". Mais 11 `no-misused-promises` (handlers `async` passados a `onClick`) em `settingsPage.tsx`, `sourceFormModal.tsx`, `NotificationToggleButton.tsx`.
4. **Respostas da API sem tipo/validação:** `res.json()` devolve `any` em `LogRepository.ts` (linhas ~123, 138-141, 192-193, 332-334) e `useSiteData.ts` (~67, 107-108). Dado malformado passa direto para os mappers.
5. **Mensagens internas de erro vazam para o cliente:** `str(e)` / `f"Erro ao consultar banco: {e}"` em `auth.py` (login, refresh), `logs.py` (counts), `site_monitor.py` (create/update), `test_connection.py`. Rotas de login são públicas. Trocar por mensagem genérica + `logger.exception`.
6. **Rate limit de login só em memória e por usuário (`auth.py`):** (a) qualquer pessoa pode bloquear o login do admin enviando 5 tentativas com o username dele; (b) `_failed_attempts` cresce sem limite com usernames diferentes; (c) zera ao reiniciar; (d) não limita por IP.
7. **`app.py:37` — `debug=True` com `host='0.0.0.0'`** quando `FLASK_ENV=development` (debugger Werkzeug = execução remota de código). Hoje o serviço roda em modo produção (hypercorn), então é risco de configuração errada, não ativo. Sugestão: `127.0.0.1` em dev.
8. **`test_connection.py`:** valida o DNS e depois `requests` resolve de novo (DNS rebinding / TOCTOU); `request.get_json()` sem `silent=True` quebra com corpo inválido. Exige login, risco baixo.

### Baixa / higiene
9. **Código morto:** `api/routes/ingest.py` (blueprint não registrado em `app.py`; usa `subprocess`; **sem `@require_auth`** se um dia for registrado); pasta `ingestor/` inteira (migration 010 removeu o pipeline); `generate_index.py` + plugin do Vite (sistema legado, confirmado por João).
10. **Arquivos que o `.gitignore` deveria cobrir mas estão rastreados:** `ingestor/config.json` (só `folder_path`, `source_host`, `source_type`; sem credenciais — valores não impressos) e os `.pyc` de `ingestor/`. Remover do índice com `git rm --cached`.
11. **`requirements.txt` e migrations `.sql` estão em UTF-16 (com BOM).** `pip` aceita, mas `grep`, `diff` e várias ferramentas quebram. Converter para UTF-8.
12. **`useNewDataDetector`:** reconecta a cada 3 s fixos, engole qualquer erro (só trata `AbortError`) e não faz backoff nem log.
13. **`settingsPage.tsx` tem 1296 linhas** com 4 cards e a lógica no mesmo arquivo. Fontes, tipos de log e plugins ficam em `localStorage` (por navegador; não compartilhado entre máquinas).
14. **Comentário desatualizado em `db.py`:** menciona KingHost; o restante do projeto fala em Neon. Confirmar qual banco é o real e corrigir o comentário.
15. `auth.py:223` variável `cleanup_error` não usada; `logs.py:172` e `site_monitor.py:405,435` `zip()` sem `strict=`; `stream_asgi.py:135` f-string sem placeholder.

### Descartado depois de testar (não é problema)
- **Timing do login com hash "dummy":** testei com `bcrypt 5.0.0` (mesma versão do `requirements.txt`): hash dummy ~315 ms vs hash real ~307 ms. A defesa contra enumeração por tempo funciona.
- **`bandit` B608 (SQL injection) em `site_monitor.py:199,242`:** os nomes de coluna vêm de whitelist fixa (`allowed_fields`) e os valores são parametrizados. Falso positivo.
- **`bandit` B113 (requests sem timeout) em `site_monitor.py:48`:** o `timeout` existe (`timeout_seconds`). Falso positivo.
- **`bandit` B311 (`random`) em `auth.py:218`:** só sorteia a limpeza de tokens; não é uso de segurança.

## Pontos fortes observados
Rotas protegidas por `require_auth` / `require_sync_key` (com `hmac.compare_digest`); refresh token com rotação e só o hash no banco; queries parametrizadas; paginação por keyset; pool com checagem de conexão viva; CORS por lista de origens; cookie `Secure` derivado de `IS_DEV`.

## Backlog pedido por João (2026-11-19) — ainda sem decisão de escopo
1. Corrigir falhas da auditoria (itens acima).
2. **Redesenho da lista de `app_logs`:** hoje são 6 colunas planas (Programa, Classe, Tipo, Mensagem, Data, Hora) numa tabela virtualizada de linha única; com muitos registros fica difícil ver "de quem veio, quando". Ideias: agrupar por dia, destacar programa/host, cabeçalho de dia, datas relativas ("hoje 14:23"), painel de detalhes.
3. **Logs de rede da Optare (UniFi, unifi.ui.com).** Decisão pendente (ver opções abaixo).
4. **Terminar a página de Configurações** (a definir o que falta).
5. **Preloader** (hoje só existe `LoadingState`, um spinner simples).
6. **Home:** dashboard com principais erros de hoje e de ontem, incluindo todos os tipos de log.
7. Ideias de melhoria a propor depois.

### Opções para o UniFi (pesquisadas em 2026-11-19; a validar na hora de implementar)
- **Site Manager API (`api.ui.com`, header `X-API-Key`, chave criada em unifi.ui.com):** expõe hosts, sites, dispositivos, métricas de ISP e SD-WAN — inventário e saúde, **não** log de eventos. Documentação: https://developer.ui.com/site-manager-api
- **Syslog / "SIEM Server" (Settings > Control Plane > Integrations > Activity Logging):** o UniFi exporta logs de sistema/segurança/clientes em CEF para um servidor syslog (IP e porta). É o caminho que entrega eventos. Ref.: https://help.ui.com/hc/en-us/articles/33349041044119. Limitação: logs de fluxo de tráfego não são exportados por syslog.
- **API local do Network Application** (chave própria gerada no Network Application): cobertura maior de endpoints, mas só dentro da rede. Ref.: https://artofwifi.net/unifi-api
- Implicação: receber syslog exige um coletor escutando (UDP/TCP) numa máquina da Optare — decidir qual (servidor 201? o serviço OptPulse?) e como gravar em `optsislog`.
