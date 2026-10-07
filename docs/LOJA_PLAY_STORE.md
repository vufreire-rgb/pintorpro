# Medde na Google Play: passo a passo (para quem não é técnico)

**Status (2026-10-07):** tudo que dá para preparar no repositório está pronto. **Ainda não foi gerado o `.aab`** (o ambiente de desenvolvimento não tem o Android SDK e bloqueia o `dl.google.com`) e **nada foi enviado ao Google**. O que falta depende de você: conta, chave e testadores.

## Pronto no repositório
- Identificador do app: **`br.com.medde.app`** (não muda depois de publicado). Domínio: **medde.com.br**.
- PWA completo: `manifest.webmanifest`, ícones 192/512 (o ícone "maskable" cabe na área segura), service worker com **notificações**.
- `android/twa-manifest.json` com as **notificações ligadas** (`enableNotifications: true`).
- `public/.well-known/assetlinks.json` com o pacote e **impressão digital vazia** (passo 6).
- 6 imagens para a loja em `docs/loja/` (1080 × 2096, proporção aceita pelo Google). São de **exemplo**: dados fictícios e sem fotos. Para a versão final, tire prints no seu celular com uma visita real (de preferência com fotos).
- Textos da loja (abaixo) e rascunho do formulário de segurança dos dados.

## O que só você faz
1. **Conta de desenvolvedor do Google Play** (https://play.google.com/console): taxa única de US$ 25 e verificação de identidade. Pode levar dias. **Comece por aqui.**
2. **Política de privacidade com texto de verdade.** `/privacidade` e `/termos` ainda estão como "texto em preparação": o Google **não aprova** sem isso. Os textos vêm do jurídico e devem citar tudo que está em "Dados tratados" abaixo.
3. **E-mail de contato público** para constar na loja e na política.
4. **12 testadores** com conta Google, que aceitem o teste fechado. Pelas regras atuais do Google para contas pessoais novas, o teste fechado precisa ter pelo menos 12 pessoas participando por 14 dias seguidos antes de liberar a publicação. **Confirme isso no Play Console**, porque a regra muda.

## Gerar o arquivo da loja (`.aab`)
### Caminho mais simples (recomendado): PWABuilder, sem instalar nada
1. Abra https://www.pwabuilder.com e digite `https://medde.com.br`.
2. Ele confere o app. Se pedir ajustes, me mande um print.
3. Toque em **Package for stores → Android → Generate package**.
4. Preencha: Package ID `br.com.medde.app`, nome `Medde`, versão `1.0.0` (código 1).
5. Em **Signing key**, escolha **Create new** (ele gera a chave) e **baixe o arquivo `.zip`**. Dentro vêm o `.aab`, a chave (`signing.keystore`) e um arquivo com as senhas.
6. **Guarde a chave e as senhas** no gerenciador de senhas e faça 2 cópias em lugares diferentes. **Nunca** coloque no GitHub nem mande no chat.
7. No Play Console: **Criar app → Teste fechado → Criar versão → Enviar o `.aab`**. Aceite o **Play App Signing**.

### Caminho avançado: Bubblewrap
Está em `docs/ANDROID_BUILD.md` (precisa de Node, Java e do Android SDK no seu computador).

## 6. Depois do primeiro envio: tirar a barra do navegador
No Play Console, em **Integridade do app → Assinatura de apps**, copie o **SHA-256 do certificado de assinatura** e me mande (é uma sequência de letras e números, **não é segredo**). Eu coloco em `public/.well-known/assetlinks.json` e publicamos. Sem isso o app abre com a barra do Chrome em cima.

## Textos da loja (pt-BR)
- **Nome (até 30):** `Medde - Orçamento de Pintura` (28)
- **Descrição curta (até 80):** `Visitas, orçamentos e obras para pintores. Fale o preço e envie pelo WhatsApp.` (78)
- **Categoria:** Negócios · **Classificação:** Livre (confirmar no questionário)
- **Descrição completa:**

> O Medde é o app do pintor que quer orçar rápido e saber quanto realmente ganha.
>
> • VISITAS: registre a visita com fotos, medidas por parede e observações, direto no celular.
> • ORÇAMENTO RÁPIDO: calcule pelas medidas e pelos seus preços, ou fale o valor e o app monta o orçamento para você conferir.
> • ENVIE E ACOMPANHE: mande o orçamento em PDF ou por link no WhatsApp e veja quando o cliente abriu. Receba a entrada por Pix.
> • OBRAS E DINHEIRO: pagamentos, parcelas, gastos (com foto do recibo) e o resultado do mês: vendido, recebido, gasto e o que sobrou.
> • SUA PÁGINA: tenha um link para o cliente pedir orçamento e receba o pedido no app.
> • AVISOS NO CELULAR quando o cliente abre o orçamento ou chega um pedido novo.
>
> Feito para quem trabalha na obra: telas simples, botões grandes e funciona mesmo com internet fraca. Você escolhe se quer calcular por medidas ou só falar o preço fechado.
>
> Teste grátis por 30 dias.

(Se o preço mudar, ajuste a última linha antes de enviar. Não prometa nada que o app não faz.)

## Dados tratados (base para o formulário "Segurança dos dados" e para a política)
| Dado | Por quê | Com quem passa |
|---|---|---|
| E-mail e senha do pintor | Conta e login | Supabase (banco e login, EUA) |
| Nome, telefone e endereço dos **clientes do pintor** | Visitas, orçamentos, cobrança | Supabase |
| Fotos e áudios da visita | Registro da visita (ficam na conta) | Supabase (armazenamento privado) |
| Localização (só se o pintor tocar em "Usar minha localização") | Endereço da obra | Serviço de mapas OpenStreetMap/Nominatim (só o ponto) |
| Voz ditada e foto de recibo | Montar orçamento e ler o recibo (**só quando usa**, não são guardados) | OpenAI (EUA) |
| Orçamento publicado por link (nome e endereço do cliente, valores) | O cliente ver o orçamento | Supabase (a página é pública para quem tem o link) |
| Nome, WhatsApp e texto de quem **pede orçamento pela página** | O pintor retornar o contato | Supabase |
| Endereço do aparelho para notificações | Avisos no celular | Supabase e o serviço de push do Google/Apple |
| Pix do pintor (chave) | Gerar QR de cobrança | Fica na conta (não há pagamento dentro do app) |

- **Criptografia em trânsito:** sim (HTTPS). **Exclusão de conta:** dentro do app (Ajustes → Excluir minha conta) e em https://medde.com.br/excluir-conta.
- **Não há anúncios, nem venda de dados, nem rastreamento de terceiros.**
- Isto é um **rascunho técnico**: o formulário final e a política passam pela revisão do jurídico.

## Checklist antes de pedir revisão ao Google
- [ ] Conta de desenvolvedor aprovada
- [ ] Política de privacidade e termos com texto final
- [ ] E-mail de contato
- [ ] Prints finais (com fotos reais) e ícone 512
- [ ] `.aab` enviado em Teste fechado, 12 testadores, 14 dias
- [ ] SHA-256 no `assetlinks.json`
- [ ] Formulário de segurança dos dados e classificação de conteúdo
