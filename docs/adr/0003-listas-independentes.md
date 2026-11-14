# Listas são independentes e podem se sobrepor

Uma mesma Printing + Finish pode aparecer em mais de uma List, sem bloqueio ou aviso. O app não mantém um inventário global exclusivo; cada List é um recorte nomeado de cartas possuídas. Isso permite casos como “deck atual” e “cartas para vender” ao mesmo tempo, mas significa que somar o valor de várias listas pode contar a mesma carta mais de uma vez.

## Alternativas consideradas

- Exclusividade por lista, exigindo mover/remover ao adicionar em outra.
- Aviso de duplicidade entre listas, sem bloquear.
- Um inventário global com cópias individuais e listas como visões.
