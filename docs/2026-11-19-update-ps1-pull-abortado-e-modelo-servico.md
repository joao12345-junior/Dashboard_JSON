# update.ps1: pull abortado por conflito e reescrita para o modelo de serviço (NSSM)

Data: 2026-11-19 (atualizado em 2026-11-20) | Status: **rodou no servidor 201: detecção de conflito, `-Stash`, pull e dependências funcionaram; 1ª execução falhou ao iniciar o serviço por falta de elevação (provável); 2ª execução (`-Force`, PowerShell elevado) concluiu: parou o serviço em execução, atualizou, religou e confirmou Vite e Flask escutando.**

## O que aconteceu
Ao rodar o `update.ps1` no servidor 201:

```
Updating 79bf382..8ba8353
error: Your local changes to the following files would be overwritten by merge:
        api/routes/ingest.py
Aborting
[update] Código atualizado.
```

- **Causa do abort:** o commit `3d4cb89` (já no GitHub) **apaga** `api/routes/ingest.py`. No servidor esse arquivo tem uma edição local, então o git recusa (conflito modificar × apagar). Reproduzido num repositório de teste com a mesma mensagem.
- **O arquivo era código morto:** em `79bf382` o `app.py` não registra o blueprint `ingest_bp` (nenhuma referência a `ingest`), então a edição local não afetava o funcionamento. Não sei o que foi editado; está só na cópia do servidor.
- **Defeito do script antigo:** imprimia "Código atualizado." mesmo com o `git pull` abortado e seguia para `npm install`/`pip` em cima do código velho. Nenhum passo conferia o código de saída.
- **Não é problema de serviço, mas apareceu junto:** o passo 5 do script antigo reiniciava a **tarefa agendada** `LogDash`, que está desabilitada desde a migração para o serviço NSSM. O serviço nunca era reiniciado por ele.
- **Acentos quebrados** (`AtualizaÃ§Ã£o`): o arquivo era UTF-8 sem BOM com acentos; o PowerShell 5.1 lê como ANSI.

## O que mudou (`update.ps1`, cópia de desenvolvimento)
Original preservado em `Claude outputs/update.ps1.original-2026-11-19`.

1. **Pré-checagens antes de derrubar qualquer coisa:** serviço existe, `git fetch`, há novidade, o servidor não tem commits que o GitHub não tem, e nenhuma alteração local coincide com arquivo que o GitHub vai alterar. Sem novidade: encerra sem reiniciar (`-Force` ignora isso).
2. **Conflito só quando há conflito:** alteração local em arquivo que o GitHub não mexe é mantida e não bloqueia. Em conflito, lista os arquivos (marcando os "apagado no GitHub") e para. `-Stash` guarda **só os arquivos conflitantes** em `git stash` e segue; o stash **não é reaplicado sozinho**.
3. **Para o serviço antes de atualizar** (`Stop-Service`), porque node/python seguram arquivos abertos no Windows (`.pyd` do psycopg2, `node_modules`), e espera as portas 5173–5175 e 8765 liberarem (aviso se sobrar processo órfão).
4. **`git pull --ff-only`**, `npm.cmd install` e `pip install` da API, cada um conferindo `$LASTEXITCODE`. A saída silenciosa foi trocada por `--loglevel=error`/`--quiet`, então erros aparecem.
5. **Religa o serviço sempre** (bloco `finally`), mesmo se um passo falhar, e confere se Vite e Flask estão escutando (até 60 s). Se não abrirem, aponta `init-log.txt` e `logs\servico.err.log` e sai com código 1.
6. Se o pull já tinha ocorrido quando algo falhou, imprime o SHA anterior e o comando para voltar.
7. **Ingestor removido do script:** o LogDash não depende dele e a rota `/api/ingest` saiu no `3d4cb89`. Com isso a pasta `ingestor/` pode ser apagada do repositório sem quebrar o update (decisão sua; a `ingestor/.venv` no servidor fica sem atualização de dependências).
8. Arquivo **só ASCII** (convenção do `init.ps1`) com CRLF.

## ⚠ Copiar manualmente para o servidor 201
`*.ps1` está no `.gitignore`: este arquivo **não** vai pelo `git pull`. Copie `logdash\update.ps1` para o mesmo lugar do antigo no servidor (o caminho do projeto é parâmetro, o padrão é `C:\Optare\LogDash`). Rodar **como Administrador** (parar/iniciar serviço).

## Como destravar o servidor agora
1. Copie o `update.ps1` novo para o servidor.
2. Opcional, para ver o que foi editado: `cd C:\Optare\LogDash; git diff api/routes/ingest.py`
3. Em **PowerShell elevado** (Executar como administrador): `.\update.ps1 -Stash` (guarda a edição do `ingest.py` no stash e atualiza). Se preferir não usar o script novo ainda: `git stash push -m "ingest local" -- api/routes/ingest.py` e depois `git pull --ff-only`.
4. Depois: conferir o serviço (`sc.exe query LogDash`), abrir o dashboard e, se a edição guardada não fizer falta, `git stash drop` (só você decide).

## Primeira execução no servidor 201 (2026-11-20)
- Sem `-Stash`: parou **antes de mexer em qualquer coisa**, listando `api/routes/ingest.py   <- apagado no GitHub`.
- Com `-Stash`: stash `update.ps1 2026-11-20 12:02:46`, `git pull --ff-only` (`79bf382` → `8ba8353`, 68 arquivos), `npm install` e `pip install` sem erro.
- **Falha:** `Start-Service` respondeu "Não é possível abrir o serviço LogDash no computador '.'", mensagem típica de PowerShell **sem elevação**. O passo de parar o serviço imprimiu "parado" sem erro, o que indica (inferência, não confirmada) que o serviço já estava parado e o `Stop-Service` nem foi chamado; se estivesse rodando, ele também teria falhado.
- Efeito: o código do servidor já está em `8ba8353`, mas o serviço ficou parado até alguém iniciá-lo.
- **Correção no script:** checa elevação **primeiro** (nada é alterado se não for administrador) e diz "Serviço já estava parado" em vez de "parado" quando não chamou o `Stop-Service`. Esta versão precisa ser copiada de novo para o servidor.

### Segunda execução (2026-11-20, `.\update.ps1 -Force` elevado)
- `Start-Service LogDash` manual funcionou; em seguida o script parou o serviço **em execução**, fez `git pull --ff-only` (`8ba8353` → `f96b9fe`), `npm install`/`pip install` e religou. Saída: "Vite escutando." e "Flask escutando na porta 8765." Confirma o ciclo parar → atualizar → iniciar → verificar portas.
- O aviso "Aguardando que o serviço ... seja parado..." vem do próprio `Stop-Service`; é normal.
- O script informou **9 arquivos com alteração local que não conflitam** (mantidos). Não foi investigado o que são; se forem só diferenças de fim de linha, vão reaparecer como conflito quando o GitHub mexer neles (aí `-Stash` resolve). Para ver: `git status --short` no servidor.

## Como testar
- `.\update.ps1` sem novidade: deve dizer "Já está na versão mais recente" sem mexer no serviço.
- `.\update.ps1 -Force`: reinstala dependências, para e religa o serviço, "Vite escutando" e "Flask escutando na porta 8765".
- Com uma alteração local num arquivo que o GitHub também alterou: deve parar **antes** de derrubar o serviço, listar o arquivo e sugerir `-Stash`.
- Simular falha (ex.: renomear `api\.venv\Scripts\pip.exe` temporariamente): o serviço deve voltar mesmo assim e o script sair com código 1.

## Não verificado
- A checagem de administrador e a mensagem "já estava parado" (versão de 2026-11-20) nunca rodaram. A versão anterior executou no PowerShell 5.1 do servidor até o `Start-Service` sem erro de sintaxe, mas só a parte de pré-checagens, stash, pull e instalação de dependências foi exercitada.
- A lógica de git (detecção de conflito, stash só do arquivo conflitante, pull) foi testada num repositório de teste com `git` no Linux, reproduzindo este caso.
- Já exercitado em 2026-11-20: parar serviço em execução, religar e verificar as portas. Ainda **não** exercitado: o caminho de falha (um passo falhando no meio com o serviço já parado, para confirmar que o `finally` religa) e a checagem de administrador (não dá para saber pela saída se o servidor já tem a versão com essa checagem: `Select-String Test-IsAdministrator .\update.ps1`).

## Pendências / decisões suas
- Apagar `ingestor/` do repositório e, no servidor, a `ingestor/.venv`.
- `init.ps1` atualizado ainda precisa ir ao servidor (pendência do doc de 2026-11-12), junto dos testes de ciclo de vida (`nssm stop/restart`, reboot) e do `taskkill /IM`.
- O script não faz backup nem rollback automático do código: só informa o SHA anterior.
