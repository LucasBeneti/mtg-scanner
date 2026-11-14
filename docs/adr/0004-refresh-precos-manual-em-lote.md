# Refresh de preços manual e em lote

A atualização de cotações acontece somente quando o usuário toca em “Atualizar preços”. O app usa `POST /cards/collection` em lotes de até 75 cartas, respeitando ~550 ms entre requests, e aplica sucesso parcial: atualiza o que voltou, mantém o preço anterior em falhas e mostra um resumo. O refresh altera apenas o preço atual; o preço da última entrada permanece congelado.

## Alternativas consideradas

- Refresh automático ao abrir a lista, que gastaria rede/rate limit sem intenção.
- Uma chamada por carta, mais simples mas cara e sujeita a rate limit.
- Refresh “tudo ou nada”, que descartaria lotes bem-sucedidos por causa de uma falha.
- Histórico de preços por refresh, fora do escopo do MVP.
