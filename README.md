# MTG Scanner

Aplicativo mobile (Android-first, preparado para iOS) para identificar cartas de **Magic: The Gathering** pela câmera e exibir seus preços instantaneamente.

> 📌 O roadmap técnico completo (decisões, arquitetura e fases) está em [`PLAN.md`](./PLAN.md).

---

## Stack

- **Expo SDK 58** (React Native 0.88, TypeScript, New Architecture)
- **`react-native-vision-camera`** (câmera + captura de frames)
- **`@react-native-ml-kit/text-recognition`** (OCR on-device via Google ML Kit, modelo Latin bundled)
- **`expo-image-manipulator`** (recorte da região do código da carta)
- **`expo-sqlite`** (cache local de cartas já consultadas)
- **Scryfall API** (identificação e preços em USD — Fase 4/5)

---

## Pré-requisitos (Mac)

- Node LTS (20+)
- JDK 17 (Zulu) — já instalado em `/Library/Java/JavaVirtualMachines/zulu-17.jdk`
- Android Studio + Android SDK em `~/Library/Android/sdk`
- Um **aparelho Android físico** (recomendado para testar câmera/OCR de verdade)

O `~/.zshrc` já exporta:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

---

## Como rodar no aparelho físico Android

> ⚠️ Este app usa `react-native-vision-camera` e `@react-native-ml-kit/text-recognition` (módulos nativos customizados). **Ele não roda no Expo Go da Play Store.** É preciso gerar um *development build* (um "Expo Go" próprio com esses binários embutidos) — o passo 4 abaixo faz isso automaticamente.

### Passo 1 — Preparar o celular (só uma vez)

1. **Configurações → Sobre o telefone**.
2. Toque **7 vezes** em "Número da versão" até aparecer *"Você agora é um desenvolvedor"*.
3. **Configurações → Sistema → Opções do desenvolvedor**.
4. Ative **Depuração USB**.

> **Fabricantes:**
> - **Xiaomi/Redmi/POCO (MIUI/HyperOS):** ative também **"Instalar via USB"** e faça login na conta Mi se pedir. Pode ser preciso desligar "Otimização MIUI".
> - **Samsung:** ative "Depuração USB"; "Instalação via USB" libera após conectar o cabo.
> - **Motorola/Asus:** só a depuração USB.

### Passo 2 — Conectar por cabo USB

1. Use um **cabo de dados** (cabo só-carga não funciona).
2. Na notificação USB do celular, escolha **"Transferência de arquivos / MTP"**.
3. Aceite o popup **"Permitir depuração USB?"** marcando *"Sempre permitir deste computador"*.

### Passo 3 — Confirmar que o Mac enxerga o aparelho

Abra um **terminal novo** e rode:
```bash
adb devices
```
Esperado:
```
List of devices attached
R58M123456A     device
```
- **`unauthorized`** → aceite o popup no celular.
- **lista vazia** → verifique cabo/modo USB.
- **`adb: command not found`** → `source ~/.zshrc` ou use `~/Library/Android/sdk/platform-tools/adb devices`.

### Passo 4 — Buildar e instalar no aparelho

```bash
cd <caminho-do-projeto>/mtg-scanner
npx expo run:android
```
O que acontece na primeira vez:
1. Compila o app nativo com Gradle **já com `vision-camera` + ML Kit** embutidos.
2. Instala o APK de desenvolvimento no celular via `adb install`.
3. Sobe o Metro bundler e abre o app.

> ⏳ **A primeira build demora** (5–15 min): o Gradle baixa dependências e compila o C++ do vision-camera/Nitro + ML Kit. Builds seguintes são rápidas.
> Com mais de um aparelho/emulador: `npx expo run:android --device`.
> **Dica:** feche o emulador antes para ele não aparecer na lista.

### Passo 5 — No dia a dia (após instalar uma vez)

Para mudanças de JavaScript/TypeScript **não é preciso recompilar**:
```bash
cd <caminho-do-projeto>/mtg-scanner
npx expo start --dev-client
```
Escaneie o QR Code com o app **MTG Scanner** (ou pressione `a`). Cada `Ctrl+S` atualiza na hora (Fast Refresh).

> Rode `npx expo run:android` de novo **somente** quando mudar algo nativo (nova lib nativa, permissão no `app.json`, ícone/splash).

### Opcional — Sem cabo (Wireless debugging, Android 11+)

1. Celular e Mac na **mesma rede Wi-Fi**.
2. Celular: **Opções do desenvolvedor → Depuração sem fio → Emparelhar dispositivo com código**.
3. No Mac:
   ```bash
   adb pair <IP>:<PORTA_EMPAREILHAMENTO>   # código de 6 dígitos do celular
   adb connect <IP>:<PORTA_DEPURACAO>
   adb devices
   ```

---

## Solução de problemas

| Sintoma | Causa / Solução |
|---|---|
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | App com mesmo `package` assinado diferente. Rode `adb uninstall com.mtgscanner.app`. |
| App abre e fecha / "Unable to load script" | Metro não está rodando. Rode `npx expo start --dev-client` e reconecte. |
| Build falha com erro de Java | Confirme `java -version` → deve ser 17 (Zulu). |
| `device offline` | Reconecte o cabo e rode `adb kill-server && adb start-server`. |
| Xiaomi: `INSTALL_FAILED_USER_RESTRICTED` | Ative "Instalar via USB" nas opções de desenvolvedor. |

---

## Comandos úteis

```bash
npx tsc --noEmit    # typecheck
npx expo-doctor     # diagnostica dependências/config
```
