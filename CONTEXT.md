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
