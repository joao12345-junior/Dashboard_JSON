# init.ps1 falha ao rodar como Serviço do Windows (Task Scheduler → Services)

Data: 2026-11-12 | Status: **RESOLVIDO no essencial — serviço sobe e fica RUNNING (testado 13:34 no servidor 201). Correção do regex HTTPS aplicada só na cópia de desenvolvimento; falta copiar para o servidor e fazer os testes de ciclo de vida.**

## Ambiente do serviço (confirmado via `sc qc` / `nssm dump`)
- Serviço `LogDash` ("OptSisLog - LogDash"), wrapper **NSSM** (`C:\Ferramentas\nssm\nssm.exe`), conta **LocalSystem**, `SERVICE_DELAYED_AUTO_START`.
- Application: `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:\Optare\LogDash\init.ps1`; AppDirectory `C:\Optare\LogDash`.
- `AppExit Default Restart`, `AppRestartDelay 5000`.
- Stdout/stderr do NSSM: `C:\Optare\LogDash\logs\servico.out.log` / `servico.err.log` (rotação 10 MB).
- Vite e Flask servem em **HTTPS** (5173 e 8765).
- Tarefa agendada antiga `LogDash`: **desabilitada** (confirmado por João).

## Sintoma original
LogDash não subia como serviço; `init.ps1` reiniciado em loop (~7–11 s). `init-log.txt` mostrava 4 execuções morrendo no mesmo segundo do "Aguardando URL" com `A propriedade 'Count' não foi encontrada` (linha 204). `~vite-*.tmp` = "Deseja finalizar o arquivo em lotes (S/N)?" + `^C` (NSSM encerrando filhos ao reiniciar; consequência, não causa).

## Causa 1 (RESOLVIDA): `$lines.Count` sobre `$null` + StrictMode
- `Set-StrictMode -Version Latest` + `Read-TempOutput` com `return $result`: lista vazia é desenrolada pelo pipeline → `$null` → `$null.Count` lança erro. O loop dorme 500 ms antes da 1ª leitura; com o arquivo ainda vazio, o script morria. No Agendador era uma corrida ganha por sorte; como serviço (LocalSystem) perdeu. (Explicação de timing = inferência.)
- **Correção:** última linha de `Read-TempOutput` → `return ,$result`. Cobre também o defeito latente da linha ~233 (`.Add`).

## Causa 2 (RESOLVIDA): script era launcher que terminava
- Com `AppExit Default Restart`, o NSSM reiniciava o `powershell.exe` ao sair (mesmo com exit 0) e encerrava os filhos.
- **Correção** (antes de "init.ps1 concluido."): `$proc.WaitForExit()` com logs "Modo servico: aguardando o processo do Vite encerrar...". Teste (`nssm start LogDash`): `SERVICE_RUNNING`, Vite "ready in 1296 ms", Flask "Running on https://0.0.0.0:8765".

## Alterações no init.ps1 (cópia de desenvolvimento, `Dashboard_JSON/logdash/init.ps1`, 2026-11-12)
1. `return ,$result` em `Read-TempOutput` (Causa 1).
2. `$proc.WaitForExit()` antes do "init.ps1 concluido." final (Causa 2).
3. Regex `http://localhost` → `https?://localhost` (3 ocorrências), pois o Vite agora serve HTTPS e o script dava "Timeout atingido (30 s)" falso em toda inicialização.
- Original preservado em `Claude outputs/init.ps1.original-2026-11-12`.
- **`*.ps1` está no `.gitignore`**: o arquivo NÃO vai pelo git/`update.ps1`. Precisa ser copiado manualmente para `C:\Optare\LogDash\init.ps1` no servidor 201 (e reiniciar o serviço).

## Pendências
1. Copiar o `init.ps1` atualizado para o servidor 201 e `nssm restart LogDash`; conferir no `init-log.txt` "Servidor detectado apos ... s" (sem o aviso de timeout).
2. Testes de ciclo de vida: `nssm stop LogDash` (sem node/python sobrando; 5173/8765 liberadas), `nssm restart LogDash`, reboot (início automático atrasado).
3. `taskkill /IM node.exe /F` e `/IM python.exe /F` (linhas 29–30) matam TODO node/python da máquina e rodam antes do lock/guarda de porta. Trocar por kill por PID/árvore.
4. `~vite-*.tmp` (stdout do Vite+Flask) cresce enquanto o serviço roda — monitorar tamanho.
5. Linha ~127: `(Get-Content $lockFile -Raw).Trim()` quebra sob StrictMode se o lock estiver vazio (fora do `try`).
6. Cosmético: `â` no lugar de `➜` no log (Vite emite UTF-8; `Read-TempOutput` lê em codepage 1252). Aviso do Vite sobre `__dirname` em `vite.config.ts:21` (usar `import.meta.dirname`).
7. Longo prazo: Plano B (um único Waitress servindo build; sem Vite/npm.cmd/polling).

## Descartado / não é problema (informado por João)
- `[ERRO] Pasta não encontrada: public\data\process_logs` / `windows_logs` (generate_index): sistema legado do LogDash, sem utilidade e sem efeito no funcionamento. Opcional: remover o generate_index do start-up para limpar o log.
- Risco LocalSystem × UNC (`\\192.168.16.200\dev\Script\Log`): irrelevante, o ingestor não é mais usado pelo LogDash.

## Lições
- PowerShell: função que retorna coleção vazia devolve `$null`; sob StrictMode usar `return ,$x` ou `@(...)` antes de `.Count`/`.Add`.
- `~vite-*.tmp` com "Deseja finalizar o arquivo em lotes" / `^C` = sintoma de encerramento, não procurar no Vite.
- Script fire-and-forget (ok no Agendador) não serve como serviço NSSM: o processo monitorado precisa ficar vivo; `AppExit Default Restart` reinicia mesmo com exit 0.
- Ao mudar o Vite para HTTPS, revisar todo regex/healthcheck que assuma `http://`.
- Config de serviço NSSM: `sc.exe qc <nome>` e `nssm dump <nome>`.
