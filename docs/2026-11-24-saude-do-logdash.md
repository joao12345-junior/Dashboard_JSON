# Painel de saúde do LogDash (24/11/2026)

## O que é
O LogDash passa a avisar quando **ele mesmo** para de funcionar (poller do UniFi, checagem de sites, ou uma fonte de logs calada), em três lugares: `GET /api/system/health`, seção **Saúde do LogDash** em Ajustes e um aviso na Home.

## Regras
- **Serviços** (poller UniFi, checagem de sites): se atrasam, entram no aviso da Home. **Fontes** (eventos de rede, Logs Gerais, Windows, Backup): só aparecem em Ajustes, **nunca** na Home, porque uma fonte calada pode ser normal (nada aconteceu).
- A idade é medida contra o `now()` do banco (`server_time`) mais o tempo decorrido desde a resposta. O relógio do navegador não entra.
- Limites ficam como constantes em `src/features/system/healthStatus.ts`. Os das fontes são **heurísticas** (chutes razoáveis), não medidos: ajuste conforme o uso real.

## Arquitetura
- `api/system_health.py` (Repository): uma consulta devolve o último registro de cada fonte (`ORDER BY id DESC LIMIT 1`, barato mesmo com tabelas grandes) mais `now() AS server_time`. Recebe cursor; testado em `api/test_system_health.py`.
- `api/routes/system_health.py`: HTTP fino, exige login.
- Front: `healthStatus.ts` (`evaluateHealth`, `serviceAlerts`, `formatAge`; 12 testes), `useSystemHealth.ts`, `SystemHealthList.tsx` (Ajustes), `HomeNotice.tsx` + `SystemHealthNotice.tsx` (Home; `HiddenProgramsNotice` usa o mesmo `HomeNotice`).

## Deploy
Reiniciar o serviço `LogDash` no 201 (rota nova) e rodar o `update.ps1` para o front.
