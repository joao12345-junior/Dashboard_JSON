# Combinados de trabalho — LogDash

Adaptado do `combinados-de-trabalho.md` do projeto Cofre em 2026-11-19. Vale para toda sessão com o Claude neste projeto.

## Quem escreve o quê
**Claude**
- Frontend: componentes, hooks, páginas, estilos (`src/features`, `src/components`, `src/hooks`).
- Testes e documentação (`docs/`), TSDoc/XML docs, revisão e auditoria.
- Correções pequenas e isoladas que o João autorizar explicitamente (ex.: `parseTimestamp`).

**João**
- API Flask (`api/`), banco/migrations, camada de dados (`LogRepository`, mappers de domínio, adapters), scripts (`init.ps1`) e deploy no servidor 201.
- O Claude não escreve código de produção dessas camadas sem um "faz você". Quando precisar de algo delas, deixa `TODO(João)` no frontend e descreve o contrato (rota, payload, resposta).

## Testes
- O projeto ainda não tem framework de testes. Proposta: Vitest, começando pela lógica pura (`parseTimestamp`, mappers, filtros). Decisão do João; até lá, validação = `tsc --noEmit` + `eslint` + checagem manual descrita no doc da mudança.
- Quando houver framework: teste escrito antes e falhando, depois a implementação.

## Fluxo de cada mudança
1. Dizer o que vai mudar e onde.
2. Mudar, rodar `tsc --noEmit` e `eslint`.
3. Registrar em `docs/AAAA-MM-DD-assunto.md` (o quê, por quê, validação, riscos) e atualizar o índice em `docs/README.md`.
4. Se mexer em arquivo ignorado pelo git (`*.ps1`, `.env`, `certs/`), avisar que precisa copiar manualmente ao servidor 201.
5. Commit feito pelo João: `feat|fix|docs|chore: descrição`.

## Estilo
- Respostas curtas, em português, sem elogio vazio; discordar quando houver motivo.
- Código: nomes em inglês, SOLID, records para DTOs, nullable/tipagem estrita, `HashSet`/`Set` para lookups, async só onde há I/O real.
- Sempre citar o padrão por trás de uma decisão (Repository, Ports and Adapters, Clean Architecture), porque o João está aprendendo.
- XML/TSDoc em classes e métodos públicos; comentários em português para lógica não óbvia.

## Restrições
- Não ler `api/.env`.
- Não deduplicar resultados do PostgreSQL sem perguntar (linhas repetidas podem ter significado).
- Conferir fim de linha (CRLF/LF) do arquivo antes de editar.
- Não apagar nada sem pedir permissão; sem permissão, mover para `_to_delete/`.

## Retomada após compactação/nova sessão
Ler nesta ordem: este arquivo → `docs/README.md` → docs mais recentes do índice.
