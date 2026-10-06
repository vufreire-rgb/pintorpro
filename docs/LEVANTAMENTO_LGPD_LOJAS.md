# Levantamento técnico — LGPD e lojas (Apple e Google)

Data: 2026-10-06 · Código analisado: branch `main` (commit `f1a0c19`) + rotas públicas novas na branch de trabalho.
Regra deste documento: só consta o que foi verificado no código, nas migrações, nos docs do projeto ou nos prints que você mandou. O que não pude verificar está marcado **"confirmar"**. Onde algo não existe, está escrito **"não existe"**. Isto não é parecer jurídico.

## Resumo (5 linhas) — bloqueios

1. **O Pintor Pro é um app web (Next.js), não um app nativo.** Não existem AndroidManifest, Info.plist, applicationId, bundle ID, keystore, projeto Android/iOS, `.aab` nem `.ipa`. O PWA (manifest, ícones, service worker) foi desligado no commit `f927971` até o nome ser confirmado.
2. **Não existe exclusão de conta** (nem no app, nem página web). Apple e Google exigem. Apagar o usuário no Supabase apaga o JSON da conta, mas **não** apaga as fotos e áudios do Storage.
3. **Faltam o domínio próprio e o nome definitivo.** Hoje o app roda em `pintorpro-gules.vercel.app` e o nome é provisório (Pintor Pro / Medde). Sem isso não dá para fixar applicationId nem o link do `assetlinks.json`.
4. **Política de privacidade e termos não existem** (as rotas foram criadas vazias). Os dados ficam nos EUA (Supabase, Ohio) e há dados pessoais de terceiros (clientes do pintor: nome, telefone, endereço, fotos da casa, áudio da conversa, GPS). "Confirm email" está desligado e não existe "esqueci a senha". A tela de cadastro agora diz "Beta gratuito" (antes prometia "30 dias grátis"); **não existe cobrança nem controle de teste** no código.
5. **O `.aab` não foi gerado.** O ambiente onde trabalho não tem Android SDK e bloqueia o `dl.google.com`; além disso faltam o domínio, o nome, o PWA religado e a conta no Play Console. Estimativa na seção 10.

---

## Atualização (2026-10-06, depois da confirmação do titular)

- **Nome:** Medde. **Domínio:** medde.com.br. **applicationId (Android) e bundle ID (iOS): `br.com.medde.app`** (confirmado; não muda).
- **PWA religado** (manifest, ícones, service worker `v2`, aviso de instalação em Visitas e Ajustes). `public/.well-known/assetlinks.json` criado com fingerprints vazios; `android/twa-manifest.json` e `docs/ANDROID_BUILD.md` preparados. O `.aab` ainda **não foi gerado** (seção 10; domínio no ar, keystore e conta do Play ainda pendentes).
- **Ajustes pedidos pelo agente de burocracia (2026-10-06):** (1) cadastro mostra "Beta gratuito"; (2) ao **sair da conta** o app apaga deste aparelho os dados, as fotos e a fila de envio (avisa antes se houver algo ainda não enviado, que seria perdido); (3) **foto nunca é guardada com o original**: se não der para reler a imagem, ela é descartada e a pessoa é avisada (antes, o original com EXIF/GPS podia ser guardado); (4) "Você avisou o cliente?" antes de gravar áudio continua, com o registro da confirmação; (5) **iOS: só como PWA** (sem App Store por enquanto).
- Onde o texto abaixo disser "Pintor Pro" ou "PWA desligado", vale esta atualização.

## Conferências pedidas pelo agente de burocracia (2026-10-06)

**DPA do Supabase e cláusulas-padrão da ANPD**
- O DPA do Supabase (https://supabase.com/legal/dpa) incorpora as cláusulas-padrão da **União Europeia** (Decisão 2021/914, módulos 2 e 3), o adendo do **Reino Unido** e o adendo da **Suíça**. Aceitar os termos do Supabase tem o efeito de assinar essas cláusulas.
- **Não encontrei confirmação de que inclua as cláusulas-padrão da ANPD** (Resolução CD/ANPD nº 19/2024, Anexo II). As cláusulas da UE **não** substituem as da ANPD, que devem ser adotadas sem alteração. O prazo de adaptação de contratos antigos (12 meses) já terminou. **Não consegui ler a página oficial** (o ambiente bloqueia o domínio): vale uma leitura direta do DPA pelo jurídico ou uma pergunta ao suporte do Supabase.
- Caminhos possíveis (decisão jurídica): (a) pedir ao Supabase um adendo com as cláusulas da ANPD; (b) **recriar o projeto na região de São Paulo** (hoje: Ohio, EUA). Como só há dados de teste, o custo agora é baixo (novo projeto, rodar as 2 migrações, publicar a função de exclusão, trocar as variáveis na Vercel e no GitHub); depois de haver clientes reais fica bem mais difícil; (c) outro mecanismo previsto na LGPD, a critério do jurídico.

**Política de uso do Nominatim (OpenStreetMap)**
Fonte: https://operations.osmfoundation.org/policies/nominatim/ (lida por resumo; a página oficial está bloqueada neste ambiente).

| Exigência | Situação no Medde |
|---|---|
| No máximo 1 pedido por segundo | Cumpre: só dispara quando a pessoa toca no botão, que fica desligado enquanto busca |
| Identificar o app por `Referer` ou `User-Agent` | Cumpre: o navegador envia o endereço do site (não há `no-referrer`). Ao entrar no ar, será `medde.com.br` |
| Mostrar atribuição ao OpenStreetMap | Cumpre: "Endereço sugerido com dados © colaboradores do OpenStreetMap", com link |
| Proibido autocompletar e geocodificar em massa | Cumpre: um pedido por toque, sem sugestão enquanto digita |
| Guardar respostas em cache | Não é obrigatório; não fazemos |
| Uso comercial | Permitido em volume **moderado**. Uso intenso exige servidor próprio ou provedor comercial |

- **Precisamos de alternativa agora?** Não: o uso é um pedido por visita. **Precisaremos** se o volume crescer (a política não define "moderado" e pode bloquear o IP). Se falhar, o app já mantém o ponto no mapa e pede o endereço digitado. Opções comerciais citadas pela OSMF: Geofabrik, OpenCage, Stadia Maps, LocationIQ.
- **Privacidade:** as coordenadas e o IP do aparelho vão ao serviço da OSM Foundation. Deve constar na política de privacidade.

---

## 1. Serviços de terceiros

| Serviço | Finalidade | Dados que recebe | País do servidor | Termos / DPA | Custo atual |
|---|---|---|---|---|---|
| **Supabase** (Auth, Postgres, Storage) | Login, banco (um documento JSON por conta) e fotos/áudios | E-mail, senha (guardada como hash pelo Supabase), documento JSON da conta (clientes, visitas, orçamentos, obras, pagamentos, chave Pix), fotos e áudios, IP das requisições | **EUA — us-east-2 (Ohio)**. Visto no painel; o docs do projeto diz que a região não muda sem recriar o projeto | https://supabase.com/terms · https://supabase.com/legal/dpa (**confirmar** os links e assinar o DPA) | **Plano Free** (painel: "Organization is on the Free Plan"; projeto NANO). Estimativa dos docs para Pro: ≈ R$ 130/mês |
| **Vercel** | Hospedagem do app (build + CDN) | Requisições HTTP ao site (IP, user-agent). O app fala com o Supabase direto do navegador, então o conteúdo da conta **não** passa pelo servidor da Vercel (não existe rota de API própria) | Não verificado (**confirmar** a região no painel da Vercel) | https://vercel.com/terms · https://vercel.com/legal/dpa (**confirmar**) | **Plano não verificado.** `docs/CUSTOS_IA.md` registra que o Hobby é proibido para uso comercial; ≈ R$ 104/mês no Pro |
| **GitHub** | Repositório do código e CI (`.github/workflows/ci.yml`) | Código-fonte. Nenhum dado de usuário | EUA (**confirmar**) | https://docs.github.com/site-policy | Não verificado |
| **OpenStreetMap / Nominatim** | Transformar a posição GPS em endereço escrito (botão "Usar minha localização") | **Latitude e longitude** + IP e navegador do aparelho. Chamada feita direto do celular para `nominatim.openstreetmap.org` (`src/modules/geo.ts`) | Servidores da OSM Foundation (**confirmar** o país) | https://operations.osmfoundation.org/policies/nominatim/ — exige uso moderado e identificação; uso comercial em escala pode exigir servidor próprio | Grátis |
| **WhatsApp (link `wa.me`)** | Abrir conversa para enviar orçamento, cobrança e confirmação | Nenhum dado enviado pelo app a um servidor. O link abre o WhatsApp do pintor com um texto pronto | — | Termos do WhatsApp (o pintor é quem envia) | Grátis |
| **Google Maps / OpenStreetMap (links)** | Botão "Mapa" abre o endereço | Só o endereço/ponto na URL aberta pelo pintor | — | — | Grátis |
| Fontes (Outfit, Atkinson) | Visual | **Nenhum**: as fontes são arquivos locais (`@fontsource` e `public/fonts`), sem chamada ao Google Fonts | — | OFL-1.1 | Grátis |
| Push, analytics, e-mail transacional próprio, pagamentos/assinatura, relatório de falhas, anúncios, atribuição | — | **não existe** (busca no código e no `package.json` sem resultado) | — | — | — |

Observações:
- Os e-mails de confirmação de conta são enviados pelo próprio Supabase Auth (remetente padrão do Supabase). Hoje "Confirm email" está **desligado** (`docs/PLANO_TECNICO.md`).
- Nenhuma IA (Claude/OpenAI) é chamada pelo app. Elas só aparecem em `docs/CUSTOS_IA.md` (planejamento).

---

## 2. Dados pessoais

| Dado | Onde é guardado | Por quanto tempo | Quem acessa | Para quê |
|---|---|---|---|---|
| **E-mail e senha do pintor** | Supabase Auth (`auth.users`). A sessão fica no `localStorage` do aparelho (padrão do supabase-js) | Até alguém apagar o usuário (**não existe** exclusão pelo app) | O próprio usuário; quem tem acesso ao painel do Supabase (hoje: o titular) | Login |
| **Nome do negócio, WhatsApp, cidade, nome do responsável, logo, cor** | Dentro do JSON da conta (`user_data.data`), tabela com RLS; cópia no `localStorage` (`pintorpro:v1:<id>`); logo em IndexedDB e no Storage | Até apagar a conta/dados. **Não existe** política de retenção automática | Dono da conta (RLS: `auth.uid() = user_id`) + painel do Supabase | Cabeçalho do orçamento/PDF, contato |
| **Dados dos clientes do pintor** (nome, telefone, endereço da obra) | No mesmo JSON da conta e no cache local | Idem | Idem | Visitas, orçamentos, cobrança |
| **Fotos das visitas** | Aparelho: IndexedDB `pintorpro-files`. Nuvem: bucket privado `visit-files`, caminho `<user_id>/<id>`, com política por pasta | Até o pintor apagar a visita/foto (o app apaga do aparelho e da nuvem). Ao apagar o usuário no Supabase, **os arquivos ficam** | Dono (política de Storage por `auth.uid()`) + painel do Supabase | Registro da obra, PDF do orçamento |
| **Gravações de áudio da conversa com o cliente** | Igual às fotos (IndexedDB + `visit-files`) | Igual às fotos | Igual às fotos | Lembrar o combinado na visita. Antes de gravar, o app pergunta "Você avisou o cliente?" e guarda `recordingConsent` na visita |
| **Localização (latitude, longitude, precisão)** | No JSON da visita (`Visit.location`) e no cache local. Só é lida quando o pintor toca em "Usar minha localização" | Idem | Idem. Além disso as coordenadas vão ao Nominatim (seção 1) | Preencher o endereço da obra e o botão "Mapa" |
| **Chave Pix e nome/cidade do recebedor** | No JSON da conta (`company.pix`) | Idem | Idem | Gerar o "Pix copia e cola" e o QR (calculado no aparelho) |
| **Pagamentos, custos, valores** | No JSON da conta | Idem | Idem | Controle financeiro da obra |
| **ID do dispositivo / ID de publicidade** | **não existe** coleta | — | — | — |
| **IP** | Não é gravado pelo app. Aparece nos logs de infraestrutura do Supabase e da Vercel | Conforme o provedor (**confirmar**) | Provedores | Operação e segurança deles |
| **Logs do app** | **não existe** (sem Sentry, sem log próprio) | — | — | — |
| **Dados de pagamento / cartão** | **não existe** | — | — | — |

Respostas diretas:
- **As fotos guardam metadados (GPS/EXIF)?** Em geral **não**. Toda foto passa por `compress()` (`src/modules/photos.ts`): o app desenha a imagem num canvas e salva um JPEG novo, o que remove o EXIF e o GPS. As fotos tiradas pela câmera do app também vêm de um quadro de vídeo, sem EXIF. *(Corrigido em 2026-10-06: se a decodificação falhar, a foto não é guardada e a pessoa é avisada; o original nunca é guardado.)*
- **As fotos mostram clientes ou imóveis de terceiros?** **Sim.** São fotos de interiores e fachadas de imóveis de clientes e podem mostrar pessoas, documentos ou objetos. Os áudios gravam a voz do cliente. O pintor é quem decide fotografar/gravar; o app só pede a confirmação de aviso no áudio. Isso precisa constar na política (quem é controlador/operador é questão jurídica).
- **O app toca em dados de cartão?** **Não.** Não existe gateway nem token de cartão. O Pix é um QR estático gerado no aparelho com a chave do pintor; o campo `paymentLink` é um link externo do próprio pintor, que o app apenas imprime no PDF.
- **Ao sair da conta (Sair)**: *(corrigido em 2026-10-06)* o app apaga o cache local (`localStorage` e IndexedDB) deste aparelho; antes ele permanecia.

---

## 3. Permissões

**AndroidManifest e Info.plist: não existem** (o projeto não tem pasta Android nem iOS). O app web usa estas permissões do navegador. Elas valem como base para o manifesto de um empacotamento futuro.

| Permissão (nativa equivalente) | Onde é pedida | O que o usuário vê |
|---|---|---|
| **Câmera** (`CAMERA`) | Tela da visita → botão "Tirar fotos (várias)" abre `CameraCapture` | Só o aviso padrão do navegador/sistema (o app **não** mostra texto próprio antes). Se negar: "Não consegui abrir a câmera. Permita o acesso à câmera ou use "Escolher da galeria"." |
| **Microfone** (`RECORD_AUDIO`) | Tela da visita → botão "Gravar áudio" | Antes do aviso do sistema o app mostra: título "Você avisou o cliente?" · texto "Antes de gravar a conversa, avise o cliente. Ex.: “Vou gravar a conversa para não esquecer nada do que combinarmos.”" · botão "Sim, avisei. Gravar". Se negar: "Sem acesso ao microfone. Permita o microfone nas configurações do navegador e tente de novo." |
| **Localização** (`ACCESS_FINE_LOCATION`) | Tela da visita → botão "Usar minha localização". Só pede quando o botão é tocado | Aviso do sistema. Mensagens de erro em `GEO_MESSAGE` (ex.: "O celular não deixou o app usar a localização…") |
| **Galeria** | Botão "Escolher da galeria" (seletor de arquivo do sistema) | Seletor do sistema; não exige permissão ampla |
| **Notificações** | **não existe** (o campo de lembrete existe nos dados, mas não há código de notificação) | — |
| **Internet** | Sempre | — |

---

## 4. Dependências e licenças

Arquivo gerado: **`THIRD_PARTY_LICENSES.md`** (raiz do repositório), com pacote, versão, licença e site. Foi gerado com `pnpm licenses list` e cobre 161 entradas de produção e 307 só de desenvolvimento.

Dependências diretas de produção: `next 16.3.7`, `react 19.3.0`, `react-dom 19.3.0`, `@supabase/supabase-js 2.117.2`, `@react-pdf/renderer 4.9.0`, `qrcode 1.5.4`, `lucide-react 1.52.0`, `zod 4.6.5`, `@fontsource/outfit 5.3.0`, `@fontsource/atkinson-hyperlegible 5.3.0`.

| Alerta | Resultado |
|---|---|
| GPL / AGPL | **Nenhum** |
| LGPL | `@img/sharp-libvips-linux-x64` 1.3.4 (LGPL-3.0-or-later): binário do otimizador de imagens do Next, só no servidor/build. Não vai dentro de um app instalado |
| "Non-commercial" | **Nenhum** |
| Licença não identificada | **Nenhuma** |
| Exigem atribuição | `caniuse-lite` (CC-BY-4.0, só no build); fontes OFL-1.1 (textos de licença em `public/fonts/OFL-*.txt`) |
| MPL-2.0 | `axe-core`, `lightningcss` (só desenvolvimento) |
| Vulnerabilidade conhecida | `pnpm audit --prod`: **1 alta** — `source-map-js` (`next > postcss > source-map-js`, GHSA-68fv-2mgg-jv7q). É dependência de build do Next. Resolve atualizando o Next/forçando versão corrigida |

---

## 5. Exclusão de conta

- **Dentro do app: não existe.** Em Ajustes só há o botão "Sair".
- **Link web para pedir exclusão: não existia.** Foi criada a rota vazia `/excluir-conta` (seção 9); o texto e o formulário ainda não existem.
- **Não existe nenhum código do lado do servidor** que apague um usuário (isso exige chave de administrador do Supabase e uma função segura).

O que seria apagado / retido hoje, se o usuário for apagado no painel do Supabase:

| Dado | Resultado |
|---|---|
| Usuário (`auth.users`) | Apagado |
| `user_data` (todo o JSON: clientes, visitas, orçamentos, obras) | Apagado em cascata (`on delete cascade`) |
| Fotos e áudios em `visit-files/<user_id>/…` | **Ficam** (o Storage não apaga em cascata). Precisam de limpeza manual ou de código |
| Cache no aparelho (`localStorage`, IndexedDB) | Fica até o usuário limpar os dados do navegador |
| Logs de infraestrutura (Supabase/Vercel) | Seguem a retenção de cada provedor (**confirmar**) |
| Backups | **não existe** backup próprio (ver seção 8) |

Para cumprir Apple/Google é preciso: botão "Excluir minha conta" dentro do app, função segura no servidor (chave `service_role` só no servidor, nunca no app) que apague usuário + dados + arquivos, e a página `/excluir-conta` com o texto e o contato.

---

## 6. Assinatura e pagamentos

| Item | Situação |
|---|---|
| Gateway de pagamento / assinatura | **não existe** |
| Compra dentro do app (Google Play Billing / StoreKit) | **não existe** |
| Link de pagamento para a web | **não existe** para a assinatura do Pintor Pro |
| Controle de teste grátis e de plano | **não existe**. A tela de cadastro mostra "30 dias grátis, sem cartão", mas é só texto |
| Pix do pintor para o cliente dele | Existe (QR estático, `src/modules/pix.ts`). Não é a cobrança do Pintor Pro |

Falta: decidir o modelo (assinatura via web ou via loja), CNPJ/gateway, tabela de planos e status da conta no banco, bloqueio após o teste, tela de cobrança e e-mails. Atenção às regras das lojas: se a assinatura de recursos digitais for vendida dentro do app instalado, Apple e Google exigem o billing delas (e cobram comissão). Venda só pela web tem regras próprias por loja (**confirmar** antes de decidir).

---

## 7. Framework e build

| Item | Situação |
|---|---|
| Framework | **Next.js 16.3.7** (App Router) + **React 19.3.0** + **TypeScript 5.9.3** + **Tailwind 4.3.3**. Node 22 e pnpm 10 no CI. Não é Flutter, React Native, Expo nem nativo |
| minSdk / targetSdk (Android) | **não existe** (sem projeto Android) |
| Versão mínima do iOS | **não existe** (sem projeto iOS). Navegador mínimo suportado: não definido |
| applicationId (Android) | **não existe**. Proposta, a confirmar com você: `br.com.<seu-domínio-ao-contrário>.app` |
| Bundle ID (iOS) | **não existe**. Mesma proposta |
| Build instalável hoje | **Não.** Sem `.aab`, sem `.apk`, sem `.ipa`. O app é aberto pelo endereço web |
| PWA | Desligado (`f927971`). Restam `src/modules/pwa.ts` e `InstallBanner` sem uso; `tests/pwa.mjs` está desatualizado |

**Preciso que você confirme antes de eu fixar os IDs:** qual é o domínio do titular (o `[DOMÍNIO]` do seu pedido não veio preenchido)? O applicationId e o bundle ID **não mudam depois de publicados**. Exemplo: `medde.com.br` → `br.com.medde.app`. Também depende de o nome estar fechado.

---

## 8. Segurança

| Item | Situação |
|---|---|
| HTTPS | Sim em tudo o que o código chama: Supabase, Nominatim e o site na Vercel. Não há chamada `http://`. (Não consegui testar o site no ar daqui: a rede do ambiente bloqueia `vercel.app`. **Confirmar** no navegador) |
| Criptografia em repouso | O app **não** criptografa nada por conta própria. No servidor depende do Supabase/AWS (**confirmar** na documentação do plano). No aparelho, `localStorage` e IndexedDB ficam sem criptografia |
| Regras de acesso por usuário (banco) | **Sim.** `user_data` com RLS ativada: select/insert/update só da própria linha (`auth.uid() = user_id`). Não há política de delete (o usuário não apaga a própria linha) |
| Regras de acesso (fotos/áudios) | **Sim.** Bucket `visit-files` privado, com políticas de select/insert/update/delete restritas à pasta `<auth.uid()>/` |
| Backups | **Preparado em 2026-10-06:** backup semanal criptografado via GitHub Actions (`docs/BACKUP_E_PAUSA_SUPABASE.md`), pendente de configurar os secrets. Antes: **não existia** backup próprio. O plano Free do Supabase, em geral, não inclui backups diários (**confirmar** no painel). Há só uma cópia local de segurança quando há conflito de sincronização |
| Senhas, chaves ou tokens no repositório | **Nenhum encontrado.** `.env*` está no `.gitignore`; `.env.example` está em branco. As variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` são públicas por desenho do Supabase. Busca em todo o código e nos 41 commits sem achar chave secreta |
| "Confirm email" | **Desligado** (testes). Religar antes de vender |
| Recuperar senha | **não existe** |
| Cabeçalhos de segurança (CSP, HSTS etc.) | **não configurados** no projeto (`next.config.ts` vazio) |
| Sessão | Token guardado no `localStorage` (padrão do supabase-js) |
| Última gravação vence | Dois aparelhos editando ao mesmo tempo podem sobrescrever (limitação conhecida da etapa A) |

---

## 9. Site

- **Endereço atual:** `https://pintorpro-gules.vercel.app` (registrado em `docs/ROTEIRO_TESTE_PINTOR.md`). **Não existe domínio próprio.**
- **Rotas públicas criadas (vazias, sem login):** `/privacidade` ("Política de privacidade"), `/termos` ("Termos de uso") e `/excluir-conta` ("Excluir conta"). Cada uma mostra o título e "Texto em preparação." Os textos virão de você.
- **Ajuste necessário:** o app obriga login em todas as telas. Foi acrescentada uma lista de páginas públicas em `AuthGate`, para essas três rotas abrirem sem login. Testei localmente com a nuvem ligada (login ativo): `/` mostra o login e as três rotas abrem direto.
- **Estado:** estão **na branch de trabalho, ainda não no ar**. Entram no endereço acima quando você autorizar a publicação.

---

## 10. Build para o teste fechado do Google (prioridade)

**Não consegui gerar o `.aab`.** Motivos:

| # | Bloqueio | Quem resolve |
|---|---|---|
| 1 | Este ambiente tem Java 21, `keytool` e Gradle, mas **não tem Android SDK** e a rede bloqueia `dl.google.com`, de onde o SDK é baixado | Fazer o build na sua máquina ou numa automação (GitHub Actions) |
| 2 | **applicationId** não pode ser fixado sem o domínio e o nome definitivos (o `[DOMÍNIO]` não veio) | Você |
| 3 | **PWA desligado**: um app Android que abre o site (TWA) precisa de manifest válido, ícones 512/192 e service worker | Eu (religar) |
| 4 | **Domínio próprio** e arquivo `/.well-known/assetlinks.json` com a impressão digital (SHA-256) da chave de assinatura. Com o Play App Signing é a chave que o Google gera, só conhecida depois do primeiro upload | Você (domínio) + eu |
| 5 | **Conta no Play Console** (taxa única de US$ 25, verificação de identidade) | Você |
| 6 | Exigências para publicar: política de privacidade com texto, formulário de segurança dos dados, classificação de conteúdo, link web de exclusão de conta | Você (textos) + eu (exclusão) |
| 7 | **Risco de recusa:** o Google pode recusar app que seja só o site dentro de uma casca. Costuma passar quando há valor claro, instalação/offline e boa qualidade | — |

**Keystore de upload — como fazer, sem senha no repositório**
Não criei o keystore aqui: este ambiente é temporário e uma chave nascida dele não ficaria sob a sua guarda. Faça na sua máquina:

```
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

- Guarde o `.jks` e as senhas num **gerenciador de senhas** e faça **2 cópias** em lugares diferentes (ex.: pendrive guardado e um cofre online privado). **Nunca** envie ao GitHub nem cole em chat. Já deixei `*.jks`, `*.keystore` e `keystore.properties` no `.gitignore`.
- Use o **Play App Signing** (ao enviar o primeiro `.aab`): o Google guarda a chave definitiva; se você perder a chave de *upload*, dá para pedir uma nova ao suporte do Google.
- Para build em automação, as senhas entram como "secrets" do GitHub, nunca no código.

**Estimativa (dias úteis de trabalho), se você me der domínio, nome e conta do Play:**

| Etapa | Dias |
|---|---|
| Religar PWA, `assetlinks.json`, ajustes de manifesto | 0,5 a 1 |
| Configurar o empacotamento (TWA/Bubblewrap) e gerar o `.aab` assinado | 1 |
| Exclusão de conta (botão + função segura + limpeza de arquivos) | 1 a 2 |
| Textos e formulários da loja (privacidade, segurança dos dados) | 1 a 2 (a maior parte é sua) |
| Revisão do Google no primeiro envio | 1 a 3 (espera) |
| **Total** | **≈ 4 a 8 dias úteis**, mais a espera do teste fechado: contas pessoais novas costumam precisar de teste fechado com pelo menos 12 testadores por 14 dias antes da produção (**confirmar** no seu Play Console; contas de empresa podem ser isentas) |

**iOS:** exige Mac com Xcode e conta Apple Developer (US$ 99/ano). A Apple recusa app que seja só um site embrulhado (diretriz 4.2); seria preciso um app de verdade com recursos nativos (ex.: Capacitor + câmera/microfone nativos). Vale decidir se o iOS entra agora ou continua só como PWA.

---

## O que preciso de você

1. **Domínio do titular** (para o applicationId, o bundle ID e o `assetlinks.json`) e **nome definitivo** do app.
2. **Modelo de cobrança** (assinatura pela web, pela loja ou ambas) e se já há CNPJ.
3. **"Pode mover"** para publicar as 3 rotas públicas.
4. Confirmar na Vercel qual **plano** está ativo, e no Supabase o plano e os backups.
