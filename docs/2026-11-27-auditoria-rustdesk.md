# Auditoria do RustDesk no LogDash (27/11/2026)

## O que é
Página **Acesso remoto > RustDesk**: quem acessou qual máquina, de onde, quando, por quanto tempo e como entrou; alarmes de senha (força bruta); estado das máquinas. Fonte: o VPS do RustDesk da Optare (Hostinger, `189.24.24.127`) grava `/var/log/rustdesk-audit/avisos.jsonl`; o LogDash lê por SFTP.

## Desenho (decidido com o lado do VPS)
- **Pull, nunca push**: o 201 busca; o PostgreSQL não fica exposto.
- Usuário `logreader` no VPS: só SFTP somente leitura em chroot (`/rustdesk-audit`), só chave. O firewall limita a porta 22: **uma conexão por ciclo**, erro = espera o próximo ciclo.
- O ingestor antigo não é usado (está desativado). Segue o padrão de `api/collector/` e roda como **thread no serviço `LogDashSyslog`**, a cada 5 min (como o sync de sites).
- Schema `optsislog`, prefixo `rustdesk_` (o Portão Optare lê por view no futuro).

## Formato (conferido em dados reais e no cliente 1.5.3)
- `corpo.id` = máquina acessada; auth (`/api/audit/conn` sem `action`): `peer` = [ID, nome] de quem acessou; `new`: `ip` de quem acessou; `conn_id` liga new → auth → close e **reinicia com o serviço** (chave = máquina + conn_id + início).
- `session_id` = sessão de quem acessa (tela e janela de arquivos compartilham); passa do `bigint` → `numeric(20)` no banco e **texto** na API (o JavaScript perderia dígitos).
- Alarme (`/api/audit/alarm`): campo `typ` (1 = >30 erros do mesmo IP; 2 = >6 em 1 min) e `info` é **JSON dentro de texto** (id, ip e nome de quem errou). Sequência real: new → alarm → close sem auth = sessão **bloqueada**.
- `/api/sysinfo` (a cada ~2 min): **não** vai para a tabela bruta, só atualiza `rustdesk_machines`. `username` falta quando ninguém está logado: guardamos "logado agora" e "último usuário" separados.
- `/api/audit/file`: ainda sem exemplo real (gravado como `kind = file`, sem tratamento especial).

## Arquivos
- `api/migrations/022_rustdesk_audit.sql`: `rustdesk_audit_raw` (chave = SHA-256 da linha), `rustdesk_sessions`, `rustdesk_machines` (com `is_test`), `rustdesk_file_state`.
- `api/collector/rustdesk_audit.py` (puro): `parse_line`, `latest_sysinfo`, `build_sessions` (status concluida/aberta/bloqueada/tentativa).
- `api/collector/rustdesk_source.py`: leitura incremental (offset + "impressão digital" do início do arquivo; rotação semanal com `create` + `delaycompress` → termina o `.1` e recomeça o atual; linha incompleta espera o próximo ciclo) e adaptador SFTP (`paramiko`, `RejectPolicy` + known_hosts próprio).
- `api/collector/rustdesk_sink.py`: transação 1 = avisos + máquinas + offset (o offset só avança se gravou); transação 2 = refaz as sessões dos últimos 7 dias a partir da tabela bruta (idempotente).
- `api/collector/rustdesk_sync.py`: job e thread; ligado em `unifi_syslog.py`.
- `api/rustdesk_queries.py` (Repository) + `api/routes/rustdesk.py`: `GET /api/rustdesk/sessions?days&status&machine&include_test`, `GET /api/rustdesk/alarms`, `GET /api/rustdesk/machines`, `PUT /api/rustdesk/machines/<id>/test` (todas com login; a marcação registra quem fez).
- Retenção: **365 dias** (`RUSTDESK_RETENTION_DAYS` em `rustdesk_queries.py`), aplicada no `POST /api/logs/cleanup`; sem a migração 022 a limpeza geral não quebra. Máquinas não expiram.
- Front: `src/features/remote-access/` (`rustdesk.ts` puro + testes, `RemoteAccessPage.tsx`), item "Acesso remoto > RustDesk" na sidebar.
- `api/requirements.txt`: `paramiko==3.5.1` (o arquivo é UTF-16; editar com cuidado).

## Testes
Python: 20 (parse e sessões, com as 43 linhas reais em `api/collector/testdata/rustdesk_avisos_exemplo.jsonl`, incluindo o alarme), 8 (leitura incremental/rotação; achou e corrigiu um falso positivo de rotação em arquivo pequeno), 6 (job: uma conexão por ciclo, releitura sem duplicar, falha de SFTP não grava, falha de sessão mantém os avisos), 7 (consultas). Front: `rustdesk.test.ts`.

## Deploy (201)
1. `update.ps1` (instala o `paramiko` e reinicia LogDash, LogDashSyslog e LogDashUnifiPoller).
2. `python api\migrations\run_migration.py` (022).
3. Criar `C:\Optare\secrets\rustdesk_known_hosts` com a linha do host (a do texto do VPS). Impressão digital do HOST: `SHA256:jQXuHFMLLxwc2cHb+o9zdRNmA86FU/uYiTuIuzAqoMY` (a `xOEd6/...` informada é da chave do `logreader`).
4. No `api\.env`: `RUSTDESK_SSH_HOST`, `RUSTDESK_SSH_USER=logreader`, `RUSTDESK_SSH_KEY_PATH=C:\Optare\secrets\rustdesk_logreader`, `RUSTDESK_SSH_KNOWN_HOSTS=C:\Optare\secrets\rustdesk_known_hosts`.
5. `Restart-Service LogDashSyslog` e ver no log: `RustDesk ok: N linha(s)...`.
6. Em Acesso remoto > Máquinas, marcar `desktop-nnr6m6d` e `joao-dell` como teste.

## Pendências
- Exemplo real de `/api/audit/file`.
- Fase 2: `tentativas.log` e log do relay.
- Visual da página não conferido no navegador (extensão desconectada em 27/11).
