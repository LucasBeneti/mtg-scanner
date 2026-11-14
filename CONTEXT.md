# MTG Scanner

Contexto do app que identifica impressões de cartas de Magic: The Gathering pela câmera e exibe preços.

## Language

**Card**:
O objeto abstrato de Magic (nome, texto oracle, tipo), independente de edição e acabamento.
_Avoid_: carta genérica

**Printing**:
Uma edição específica de um Card, identificada por Set + Collector number. É o que tem preço e imagem próprios.
_Avoid_: versão, variante

**Set**:
A coleção editorial à qual uma Printing pertence (ex.: FDN, BLB).
_Avoid_: edição, coleção

**Collector number**:
O identificador de uma Printing dentro do Set (ex.: 125, 125a, 125★).
_Avoid_: número da carta, código

**Card face**:
Uma das faces de um Card de duas faces; nome, texto oracle e imagem podem variar por face.
_Avoid_: lado, verso

**Finish**:
O acabamento físico de uma Printing: normal, foil ou etched.
_Avoid_: tipo, variante

**Scan**:
Uma leitura da câmera que produz um candidato a Set + Collector number.
_Avoid_: captura, leitura

**List**:
Um agrupamento nomeado de cartas que o usuário possui. Listas são independentes e podem se sobrepor.
_Avoid_: coleção, inventário

**List item**:
Uma Printing + Finish dentro de uma List, com uma quantidade.
_Avoid_: carta, cópia

**Entry price**:
A cotação de mercado de um Finish no momento da última adição do List item à List. Fica congelada até uma nova adição.
_Avoid_: preço do scan, preço de compra

**Current price**:
A cotação mais recente obtida para o Finish de um List item.
_Avoid_: preço de hoje, preço de venda

**Estimated value**:
O valor de uma List calculado como `quantity × (Current price ?? Entry price)`.
_Avoid_: valor da coleção

**Last accessed**:
A última abertura ou modificação de uma List; é o critério de ordenação da Home.
_Avoid_: última edição

**Copy**:
Uma instância física individual de uma carta. Não é modelada no MVP; `quantity` é apenas uma contagem no List item.
_Avoid_: unidade
