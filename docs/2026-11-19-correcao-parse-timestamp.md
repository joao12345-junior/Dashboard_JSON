# 2026-11-19 — Correção do parse de data/hora nos mappers

## O que mudou
- Novo `src/lib/parseTimestamp.ts` (helper único).
- `AppLogMapper.tsx` e `WindowsEventLogMapper.ts` passaram a importá-lo; as duas cópias locais da função foram removidas.

## Por quê
O `datetime.isoformat()` do Python **omite a fração de segundo quando os microssegundos são 0**. Os mappers cortavam só no `.`, então um timestamp como `2026-11-19T14:23:05-03:00` virava hora `"14:23:05-03:00"` (sufixo de fuso grudado). Isso quebra a exibição e a ordenação por `${date}T${time}`. Só acontece em logs com microssegundo exatamente 0 (raro, mas real).

## Como ficou
A hora é cortada no primeiro `.`, `Z`, `+` ou `-`. **Não há conversão de fuso**: os dígitos do banco são mantidos, como antes. Os horários exibidos hoje estão corretos (confirmado pelo João), então converter deslocaria o que já funciona.

## Validação
- Casos que já funcionavam (com fração, `Z`, `+00:00`, vazio, só data): saída idêntica à anterior.
- Casos corrigidos: `...05-03:00`, `...05+00:00`, `...05z` → `14:23:05`.
- `tsc --noEmit`: sem erros.
- Sem framework de testes no projeto; a checagem foi um script descartável.

## Risco / pendência
- Depende de a sessão do banco devolver o fuso desejado (comportamento anterior, inalterado).
- Nada a copiar manualmente ao servidor 201 (arquivos versionados no git).
- Commit sugerido: `fix: remove sufixo de fuso da hora quando timestamp não tem fração`
