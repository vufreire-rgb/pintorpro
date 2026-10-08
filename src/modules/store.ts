/**
 * Loja do Medde: links de compra de materiais (Mercado Livre por enquanto).
 * Para ganhar comissão, coloque o parâmetro de afiliado em AFFILIATE_PARAMS (ex.: "matt_tool=123&matt_word=medde").
 * Enquanto estiver vazio, os links são buscas comuns, sem comissão.
 */
export const AFFILIATE_PARAMS = "";

export interface StoreItem { id: string; title: string; hint: string; query: string }
export interface StoreCategory { id: string; title: string; items: StoreItem[] }

export const STORE_CATEGORIES: StoreCategory[] = [
  { id: "tintas", title: "Tintas e massas", items: [
    { id: "tinta-acrilica", title: "Tinta acrílica", hint: "Paredes internas e externas", query: "tinta acrilica fosca 18 litros" },
    { id: "massa-corrida", title: "Massa corrida", hint: "Para nivelar a parede", query: "massa corrida 25kg" },
    { id: "selador", title: "Selador acrílico", hint: "Antes da tinta", query: "selador acrilico 18 litros" },
  ] },
  { id: "ferramentas", title: "Ferramentas", items: [
    { id: "rolo-la", title: "Rolo de lã", hint: "Paredes lisas e texturizadas", query: "rolo de la pintura parede" },
    { id: "trincha", title: "Trincha e pincel", hint: "Recortes e acabamento", query: "trincha pintura kit" },
    { id: "bandeja", title: "Bandeja de pintura", hint: "Para o rolo", query: "bandeja pintura rolo" },
    { id: "espatula", title: "Espátula e desempenadeira", hint: "Massa e reparos", query: "espatula aco pintor" },
  ] },
  { id: "protecao", title: "Proteção da obra", items: [
    { id: "fita-crepe", title: "Fita crepe", hint: "Proteger cantos e rodapés", query: "fita crepe pintura 48mm" },
    { id: "lona", title: "Lona plástica", hint: "Cobrir piso e móveis", query: "lona plastica pintura" },
    { id: "lixa", title: "Lixas", hint: "Preparar a parede", query: "lixa parede kit pintor" },
  ] },
  { id: "epi", title: "Segurança (EPI)", items: [
    { id: "mascara", title: "Máscara respirador", hint: "Contra pó e vapores", query: "mascara respirador pintura pff2" },
    { id: "oculos", title: "Óculos de proteção", hint: "Ao lixar e pintar o teto", query: "oculos protecao incolor" },
    { id: "luvas", title: "Luvas", hint: "Para manusear tintas", query: "luvas pintor" },
  ] },
];

/** Link de busca no Mercado Livre (com o parâmetro de afiliado, quando houver). */
export function storeUrl(query: string): string {
  const slug = encodeURIComponent(query.trim().toLowerCase().replace(/\s+/g, "-")).replace(/%2D/g, "-");
  return `https://lista.mercadolivre.com.br/${slug}${AFFILIATE_PARAMS ? `?${AFFILIATE_PARAMS}` : ""}`;
}
