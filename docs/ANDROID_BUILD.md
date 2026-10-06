# Android (Google Play): como gerar o .aab do Medde

**Status:** configuração preparada, **ainda não testada** (o ambiente de desenvolvimento não tem o Android SDK e bloqueia o `dl.google.com`). O build deve ser feito na sua máquina ou numa automação.

## Identificadores (fixos)
- Android `applicationId` e iOS bundle ID: **`br.com.medde.app`** (confirmado em 2026-10-06; não muda depois de publicado).
- Domínio: **medde.com.br**. Nome do app: **Medde**.

## O que já existe no repositório
- PWA religado: `src/app/manifest.ts` (`/manifest.webmanifest`), ícones 192/512, `public/sw.js`.
- `public/.well-known/assetlinks.json` com o pacote `br.com.medde.app` e **fingerprints vazios** (preencher no passo 5).
- `android/twa-manifest.json`: configuração do Bubblewrap (TWA = app Android que abre o site em tela cheia).
- `.gitignore` já ignora `*.jks`, `*.keystore`, `keystore.properties`.

## Pré-requisitos (você)
1. `medde.com.br` apontando para o app na Vercel (domínio ligado e com HTTPS). O build lê o manifesto do endereço público.
2. Conta no Google Play Console.
3. Node 22 e Java 17+ na sua máquina (o Bubblewrap baixa o Android SDK sozinho).

## Passo a passo
1. **Keystore de upload** (uma vez, na sua máquina; nunca no repositório):
   `keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
   Guarde o arquivo e as senhas num gerenciador de senhas e faça 2 cópias em lugares diferentes.
2. `npm i -g @bubblewrap/cli`
3. Na pasta `android/`: `bubblewrap init --manifest https://medde.com.br/manifest.webmanifest` (confira que os campos batem com `twa-manifest.json`) e depois `bubblewrap build`.
4. Saída: `app-release-bundle.aab` (envie ao Play Console, em Teste fechado) e `app-release-signed.apk` (para testar no celular).
5. Depois do primeiro envio, no Play Console, em **Integridade do app → Assinatura de apps**, copie o **SHA-256 do certificado de assinatura** e cole em `public/.well-known/assetlinks.json` (`sha256_cert_fingerprints`). Publique. Sem isso o app abre com a barra do navegador em cima.
6. Ative o **Play App Signing** no primeiro envio.

## Antes de pedir revisão ao Google
Política de privacidade com texto (`/privacidade`), termos (`/termos`), link de exclusão de conta (`/excluir-conta`) e a exclusão funcionando dentro do app, formulário de segurança dos dados, classificação de conteúdo.

## iOS
Decisão do titular (2026-10-06): **sem App Store por enquanto**. Usuários de iPhone usam o Medde como PWA (Safari → Compartilhar → Adicionar à Tela de Início; o aviso de instalação mostra o passo a passo). Não há empacotamento iOS a fazer agora.
