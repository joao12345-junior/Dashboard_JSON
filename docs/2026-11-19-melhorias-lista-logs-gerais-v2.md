# 2026-11-19 — Lista de Logs Gerais, segunda rodada (inspirada em Datadog / Kibana / Grafana / SigNoz)

## Referências pesquisadas
- **Datadog Log Explorer / Kibana Discover:** facetas com contagem por valor e "filtrar por este valor" com um clique; agrupamento de logs parecidos em padrões.
- **Grafana (Loki / Explore):** deduplicação de linhas repetidas, quebra de linha opcional, destaque do termo buscado, cor por nível.
- **SigNoz:** histograma de volume, "Pause/Resume" do feed ao vivo, opções de formato/linhas por registro.
- Fora do que cabia nesta rodada (ver Backlog): histograma por hora, "eventos ao redor" (contexto), views salvas/URL compartilhável.

## O que mudou
Barra nova acima dos filtros, em `AppList.tsx`:
- **Chips de severidade com contagem** (Erros / Avisos / Info / Debug). Clique filtra (vários podem ficar ligados; usa o mesmo estado do filtro "Tipo"). A contagem reflete os *outros* filtros (programa, classe, mensagem, dia), como nas facetas do Datadog.
- **Clique no programa ou na classe de uma linha filtra por ele** (como o "filter for value" do Kibana). "Sem programa" não é clicável.
- **Destaque do termo** digitado em "Mensagem" dentro do texto das linhas.
- **Agrupar repetidos** (desligado por padrão): junta registros *consecutivos* com mesmo programa/classe/tipo e mensagem igual ignorando números (`chamado 142` e `chamado 143` são o mesmo padrão). Mostra "×N"; clicar expande os repetidos.
- **Quebrar linhas** (desligado por padrão): mostra a mensagem inteira em vez de cortar com "…".
- **Pausar / Retomar:** congela a lista numa foto enquanto você lê; os logs novos continuam chegando por trás e o botão mostra "(N novos)".
- **Exportar CSV:** baixa *todos* os registros que passam pelos filtros (não só a página), separador `;`, BOM UTF-8 para acento no Excel, células iniciadas por `= + - @` recebem `'` para o Excel não tratar como fórmula.

Arquivos: `AppList.tsx`, `components/AppLogFeed.tsx` (reescrito), novos `lib/collapseRepeats.ts` e `lib/exportCsv.ts`.

## Importante sobre "agrupar repetidos"
É só apresentação: nenhum registro é apagado ou alterado, a contagem total e os totais por dia continuam sobre os dados completos, e o botão vem desligado. Não é deduplicação de resultado do banco.

## Validação
- `tsc --noEmit` e `eslint` sem erros.
- Helpers puros testados com script descartável (agrupamento por padrão numérico, escape de CSV e prefixo anti-fórmula).
- Conferido no Chrome do João: chips e contagens, clique no programa (OptCore → contagens recalculadas), agrupar repetidos (×3, ×2) e expansão, destaque do termo, quebrar linhas.
- **Não conferido no navegador:** o download do CSV (só a lógica foi testada) e o comportamento de "(N novos)" durante a pausa com logs chegando.

## Ajustes feitos durante o teste
- Linha de repetido expandida desalinhava das colunas (padding extra): agora usa o mesmo padding e se distingue por fundo e opacidade.
- Botões de opção ligados quase não se destacavam: borda na cor primária quando ativos.

## Backlog desta lista
1. Histograma por hora do dia selecionado (clicar na barra filtra a hora) — precisa de filtro de intervalo.
2. "Eventos ao redor" no modal de detalhes (N logs antes/depois do mesmo programa).
3. Filtros na URL (link compartilhável) e views salvas.
4. Filtro de intervalo ("últimos 7 dias").
5. As páginas `WindowsList` e `ProcessList` têm o mesmo problema de largura ao filtrar (corrigido só em `AppList`).

Commit sugerido: `feat: filtros rápidos, agrupar repetidos, pausa e exportação na lista de logs gerais`
