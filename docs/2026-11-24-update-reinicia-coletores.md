# update.ps1 reinicia também os coletores (24/11/2026)

## Motivo
O `update.ps1` só parava e religava o serviço `LogDash` (Vite + Flask). Os coletores `LogDashSyslog` e `LogDashUnifiPoller` rodam o mesmo código (`api/collector`) e a mesma `api\.venv`, então depois de um update continuavam com o código antigo até alguém reiniciar na mão. Com eles rodando, o `pip install` também podia falhar por arquivo da venv em uso.

## O que mudou
- Novo parâmetro `-ExtraServiceNames` (padrão `LogDashSyslog`, `LogDashUnifiPoller`). `-ExtraServiceNames @()` volta ao comportamento antigo.
- Os coletores são parados junto com o principal, antes do `git pull`, e religados no `finally` (sempre, mesmo se um passo falhar). Cada um tem o próprio `try`: a falha de um não impede os outros.
- Coletor parado com início **Automático** é tratado como caído e é iniciado; parado com início **Manual/Desativado** continua parado (foi parado de propósito).
- Serviço que não existe no servidor só gera aviso.
- Se um coletor não parar, o update segue e ele é reiniciado (`Restart-Service`) no final.
- Depois de iniciar, confere se ficou `Running`. Limite: o NSSM mantém `Running` mesmo se o python morrer e ficar reiniciando, então erro do coletor só aparece no log dele.
- Migrações continuam **fora** do script.

## Deploy
`update.ps1` está no `.gitignore`: copiar manualmente para o 201 (o que estiver em uso, ex.: `C:\Optare\update.ps1` ou `C:\Optare\LogDash\update.ps1`). Rodar em PowerShell como administrador. Não foi executado: o ambiente de desenvolvimento não tem PowerShell para testar.
