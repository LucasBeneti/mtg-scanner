# List items agregam cópias e guardam o preço da última entrada

Cada List item é uma linha por Printing + Finish com uma quantidade, em vez de uma linha por cópia física. O preço de entrada é a cotação de mercado do Finish no momento da última adição e fica congelado; o preço atual é atualizado separadamente pelo refresh manual. A escolha mantém a UI e o CRUD simples, ao custo de não modelar condição, idioma, preço pago ou histórico por cópia.

## Alternativas consideradas

- Uma linha por cópia física, permitindo condição/idioma/preço pago por unidade.
- Média ponderada das adições, mais fiel ao lote mas menos previsível para o usuário.
- Guardar apenas o preço atual, perdendo a comparação com o momento da entrada.
