# 2026-11-19 — Limpeza da página de Configurações

## O que mudou
- `src/features/settings/settingsPage.tsx` (1296 → ~630 linhas):
  - Removidas as seções "Fontes de Dados" e "Tipos de Logs Registrados" (legado do modelo JSON; o `public/data` está vazio e o ingestor não é mais usado).
  - `ApiCard` agora só configura a Flask API (habilitar, endereço, testar). A "Lista URLs" de ping foi removida: o campo `urls` não era lido em lugar nenhum.
  - Removidos os tipos `IngestSucesso`/`IngestErro`/`IngestResult`.
  - Monitoramento de URLs: falha ao salvar ou alternar um site agora mostra Toast de erro (antes só `console.error`); sucesso ao salvar mostra Toast. `res.ok` falso agora registra o status HTTP.
  - O estado do teste de conexão virou um único `status` (`idle | testing | ok | error`) e é descartado quando o endereço é editado.
  - Handlers async chamados com `void` (regra `no-misused-promises`).
- `src/lib/storage/logPaths.ts`: removidos `loadLogTypes`/`saveLogTypes` e a chave `logdash:logtype:v3` (só a página usava).
- Apagados: `sourceFormModal.tsx`, `logTypeFormModal.tsx`, `converterFormModal.tsx` (sem uso) e `api/routes/ingest.py` (rota nunca registrada em `app.py`).

## Por quê
Origem: auditoria de 19/11 (achados 9, 13) e pedido do João de terminar Configurações. A página mostrava opções sem efeito real no sistema.

## O que NÃO foi mexido (de propósito)
- `useProgressiveLogs` ainda carrega as "fontes estáticas" (`loadEnabledSources`, padrão `/data/windows_logs`). Como `public/data` está vazio, hoje não traz nada, mas remover esse modo mexe no coração do carregamento e merece mudança própria.
- `generate_index.py` continua: `vite.config.ts` ainda o executa.
- `ingestor/` continua: `update.ps1` (servidor) ainda instala as dependências dele (`ingestor\.venv`). Apagar a pasta sem ajustar o `update.ps1` quebra o update.
- `loadLogSources`/`saveLogSources`/`resetLogSources` ficaram sem uso na UI; entram na limpeza do modo estático.

## Validação
`tsc --noEmit` e `eslint` (página + logPaths) sem erros. Sem testes automatizados; conferir no navegador: abrir Configurações, testar a API, criar/editar/ativar um site monitorado e forçar um erro (API fora) para ver o Toast.

## Servidor 201
Nada a copiar manualmente (arquivos versionados).

## Próximos passos relacionados
1. Remover o modo estático do `useProgressiveLogs` + `generate_index.py` + plugin no `vite.config.ts`.
2. Ajustar `update.ps1` e então apagar `ingestor/`.
3. Novas opções de configuração (retenção, aparência) conforme combinado; retenção editável exige rota na API (`TODO(João)`).

Commit sugerido: `refactor: remove legado de fontes/tipos de log da página de configurações`
