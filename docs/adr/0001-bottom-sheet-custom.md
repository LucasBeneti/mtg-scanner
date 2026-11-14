# Bottom sheet custom em vez de biblioteca

O painel de resultado usa um sheet próprio com `Animated` + `PanResponder`
(arrasto restrito ao handle e ao peek), em vez de `@gorhom/bottom-sheet` +
`react-native-reanimated` + `react-native-gesture-handler`. A escolha evita
dependências nativas e rebuild do dev client, e mantém o gesto fora do
`ScrollView`. O custo é menos polimento e animação no JS thread; migrar para a
biblioteca fica como follow-up se o comportamento no device não for satisfatório.

## Alternativas consideradas

- `@gorhom/bottom-sheet`: gestos melhores e integração com scroll, mas exige
  três dependências nativas e rebuild do dev client.
- Arrastar de qualquer ponto do sheet: conflita com o scroll do conteúdo;
  exigiria gesture-handler/reanimated para funcionar bem.
