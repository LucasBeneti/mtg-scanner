# Preço manual (Price override) por List item

A Scryfall às vezes devolve valores discrepantes ou não cobre tratamentos específicos de uma Printing. Para corrigir isso sem sair do app, cada List item aceita um **Price override**: um preço unitário definido manualmente, com observação opcional (até 120 caracteres) e a data da última edição.

O preço efetivo de um List item passa a ser:

```
Price override ?? Current price ?? Entry price
```

O override é gravado em `price_override_usd_cents`, sempre em USD, e vence o Current price no Estimated value. Ele **não** sobrescreve `current_price_usd_cents`: o refresh continua atualizando o preço de mercado por baixo, o que permite ao usuário comparar a correção com a API e decidir quando removê-la.

## Ciclo de vida

- **Preserva** em "Atualizar preços": o refresh grava `current_price` e mantém o override.
- **Preserva** ao re-escanear a mesma carta (soma de quantidade) e ao alterar a quantidade.
- **Só morre** por remoção explícita ("Remover preço manual", com confirmação) ou exclusão do item/lista.
- A observação e a data acompanham o override; removê-lo apaga ambos.

## Escopo e apresentação

- O override é **por List item** (Printing + Finish), não global. Listas seguem independentes (ADR 0003).
- É **unitário**: o total da linha e o Estimated value usam `quantity × preço efetivo`.
- No row, o sinal é mínimo: badge `Manual`, chip `obs.` quando há observação, e o preço manual clicável. Mercado, entrada, observação completa e data ficam no modal "Editar preço".
- O input segue a moeda ativa (BRL converte para USD na cotação do momento); só o valor em USD é persistido, então o valor em R$ pode variar alguns centavos após salvar.
- Valores válidos: `0` até US$ 99.000.000,00, arredondados ao centavo. Negativo, vazio e não numérico são rejeitados.
- Salvar um preço igual ao mercado ainda cria o override: a intenção de anotar/editar é registrada mesmo sem mudança de valor.

## Não-objetivos

- Editar o preço pelo fluxo de scanner / `CardResultSheet`.
- Editar o Entry price ou o Current price — ambos continuam vindo da API.
- Preço por cópia (ADR 0002).
- Histórico de overrides: apenas a última edição é guardada.
- Sincronização entre dispositivos.

## Alternativas consideradas

- **Override global por Printing + Finish**, corrigindo uma vez em todas as listas: violaria a independência das listas e exigiria explicar por que o mesmo item aparece com preços diferentes.
- **Sobrescrever `current_price_usd_cents`**: mais simples, mas o usuário perderia a referência de mercado e não saberia se a correção ainda faz sentido.
- **Guardar também a moeda e o valor digitados**: criaria dois números "verdadeiros" para o mesmo preço sem ganho real. O preço canônico é em USD; como o centavo de USD vale vários centavos de BRL, digitar em R$ pode exibir alguns centavos de diferença depois de salvar (ex.: `R$ 25,00` com cotação 5,6666 grava US$ 4,41 e exibe R$ 24,99). Preservar o valor digitado exigiria armazenar a moeda original, o que foi descartado para manter uma única fonte de verdade.
- **Histórico de edições por item**: nenhuma tela consome, e o ADR 0004 já deixou histórico de preços fora do MVP.
- **Nota sem preço**: exigiria um estado que o schema não modela; se o usuário quer apenas anotar, salva o preço atual como override.
