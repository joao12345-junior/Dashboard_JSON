# Testes de front (vitest) e auditoria de quem mexe nos programas (24/11/2026)

## Vitest
- Dependência de desenvolvimento `vitest`; comando `npm test` (= `vitest run`). Config em `vitest.config.ts`, **separada** do `vite.config.ts` (que sobe o Flask no start e não deve rodar nos testes).
- Testam só funções puras (sem DOM): `programRegistry`, `sortClients`, `format`, `sessionTimeline`, `eventClient`, `topologyLayout`, `healthStatus`. Dados de teste em `src/features/network/testFactories.ts` (nenhum código de produção importa).
- Deploy: `npm install` na máquina de desenvolvimento para baixar o vitest. O servidor 201 não precisa.

## Auditoria
Rotas destrutivas ou de visibilidade de programas exigem login e agora registram **quem** fez, no log do Flask: `[app_programs] 'usuario' apagou N logs de 'programa'` (e o mesmo para mudança de visibilidade). `current_username()` fica em `api/routes/auth.py` (testes em `api/test_auth_username.py`).

## Como rodar tudo
- Front: `npx tsc -b --noEmit`, `npx eslint src`, `npm test`.
- Backend (da pasta `api`, com o venv): `python -m unittest collector.test_collector collector.test_unifi_poller collector.test_network_extras collector.test_site_sync test_program_registry test_auth_username test_system_health`.
