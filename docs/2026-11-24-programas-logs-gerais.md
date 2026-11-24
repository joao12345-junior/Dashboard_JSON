# Programas dos Logs Gerais: ocultar, inativar e apagar (24/11/2026)

## O que muda

Cada programa que envia logs gerais (`app_logs.programa`) agora tem uma **visibilidade**:

| Escolha (Ajustes) | Efeito |
|---|---|
| Automático (padrão) | Passou de 5 dias sem log: some do dashboard, dos registros e da Home. **Volta sozinho** no primeiro log novo. |
| Sempre visível | Ignora a inatividade (serve para ver os logs antigos de um programa parado). |
| Oculto | Some das telas e só volta se for mudado nos Ajustes, **mesmo que volte a logar**. |

**Apagar logs** (Ajustes > Programas) remove do banco todos os logs do programa e a linha dele no registro. Se o programa voltar a logar, reaparece como automático. Serve para limpar um programa que gerou milhares de logs de uma vez.

Programas ocultos que continuam recebendo logs geram um aviso na Home ("N programas ocultos receberam logs nas últimas 24 h"), para ninguém ficar cego sem perceber.

## Por que "automático" volta sozinho

Programa que para de logar costuma ser programa que caiu. Esconder isso e exigir ação manual para ver de novo faria o monitor esconder justamente o problema. Quem quer silenciar de verdade usa "Oculto", e o aviso da Home cobre o risco.

## Arquitetura

- `api/migrations/016_app_programs.sql`: tabela `optsislog.app_programs` (programa, visibility NULL|shown|hidden, last_log_at). `app_logs` guarda 14 dias; sem esta tabela o programa sumiria da lista dos Ajustes junto com os logs.
- `api/program_registry.py` (Repository): todo o SQL e a validação de payload. Recebe cursor, não abre conexão, por isso é testável sem banco (`api/test_program_registry.py`).
- `api/routes/app_programs.py`: HTTP fino. `GET /api/app-programs`, `PUT /api/app-programs/visibility`, `POST /api/app-programs/logs/delete`. Todas exigem login.
- `/api/logs/cleanup` (chamado a cada 30 min pelo sync no LogDashSyslog) atualiza `last_log_at` no registro **antes** de apagar os logs antigos.
- `src/features/app-logs/programRegistry.ts`: regras puras (`classifyPrograms`, `filterHiddenPrograms`...). A regra dos dias usa também o log mais recente já carregado no navegador, então um programa inativo que volta a logar reaparece na hora, sem esperar a próxima consulta.
- `useAppPrograms` roda uma vez em `App.tsx`; `logs` que as páginas recebem já vem filtrado, então Home, Logs Gerais e Ajustes enxergam o mesmo conjunto.

## Deploy

1. `update.ps1` e `python api\migrations\run_migration.py` (migration 016).
2. Reiniciar a API (o `update.ps1` já reinicia o serviço `LogDash`).

## Pontos de atenção

- O SQL foi escrito e testado só com cursor falso; confirmar no banco real (a tela Ajustes > Programas lista tudo e mostra erro se a query falhar).
- O limite de 5 dias é a constante `INACTIVE_AFTER_DAYS` em `programRegistry.ts`.
- Programas com `programa` nulo ou vazio nunca são escondidos.
