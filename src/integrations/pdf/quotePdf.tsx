import { Document, Font, Image, Link, Page, Path, Circle, StyleSheet, Svg, Text, View, pdf } from "@react-pdf/renderer";
import type { QuotePdfData } from "@/modules/pdfData";

/** Fontes livres (OFL) servidas pelo próprio app: Outfit (títulos/valores) e Atkinson Hyperlegible (textos). */
const fontBase = () => (typeof window !== "undefined" ? window.location.origin : "") + "/fonts/";
let fontsReady = false;
export function registerFonts() {
  if (fontsReady) return;
  fontsReady = true;
  Font.register({
    family: "Outfit",
    fonts: [
      { src: fontBase() + "Outfit-700.ttf", fontWeight: 700 },
      { src: fontBase() + "Outfit-800.ttf", fontWeight: 800 },
    ],
  });
  Font.register({
    family: "Atkinson",
    fonts: [
      { src: fontBase() + "AtkinsonHyperlegible-Regular.ttf", fontWeight: 400 },
      { src: fontBase() + "AtkinsonHyperlegible-Bold.ttf", fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]); // sem hifenização estranha
}

export const INK = "#0E1B2E";
export const SUPPORT = "#4A5B70";
export const LINE = "#D3DBE6";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 36, paddingBottom: 78, fontFamily: "Atkinson", fontSize: 15, color: INK },
  caps: { fontFamily: "Atkinson", fontWeight: 700, fontSize: 12, lineHeight: 1.33, letterSpacing: 1.1, textTransform: "uppercase" },
  hr: { borderBottomWidth: 1, borderBottomColor: LINE },
});

export function Monogram({ text, color, size, radius, font, logo }: { text: string; color: string; size: number; radius: number; font: number; logo?: string }) {
  // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf, não é <img>
  if (logo) return <Image src={logo} style={{ width: size, height: size, objectFit: "contain" }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: font, color: "#FFFFFF" }}>{text}</Text>
    </View>
  );
}

const stroke = (color: string) => ({ stroke: color, strokeWidth: 2.2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

function Footer({ d }: { d: QuotePdfData }) {
  return (
    <View fixed style={{ position: "absolute", left: 36, right: 36, bottom: 24 }}>
      <View style={[s.hr, { marginBottom: 12 }]} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Monogram text={d.painter.initials} logo={d.logo} color={d.color} size={28} radius={8} font={11} />
          <Text style={{ marginLeft: 10, fontSize: 13, lineHeight: 1.4, color: SUPPORT }}>
            {[d.painter.company, d.painter.whatsapp && `WhatsApp ${d.painter.whatsapp}`].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: SUPPORT }} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    </View>
  );
}

function RunningHeader({ d }: { d: QuotePdfData }) {
  return (
    <View fixed>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Monogram text={d.painter.initials} logo={d.logo} color={d.color} size={34} radius={10} font={14} />
          <Text style={{ marginLeft: 12, fontFamily: "Outfit", fontWeight: 700, fontSize: 18, color: d.color }}>{d.painter.company}</Text>
        </View>
        <Text style={{ fontSize: 13, color: SUPPORT }}>Orçamento nº {d.number} · {d.clientName}</Text>
      </View>
      <View style={[s.hr, { marginBottom: 20 }]} />
    </View>
  );
}

const Title = ({ children }: { children: string }) => (
  <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 32, lineHeight: 1.19, marginBottom: 14 }}>{children}</Text>
);

function Summary({ d }: { d: QuotePdfData }) {
  return (
    <Page size="A4" style={s.page}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", flexShrink: 1 }}>
          <Monogram text={d.painter.initials} logo={d.logo} color={d.color} size={56} radius={14} font={24} />
          <View style={{ marginLeft: 16, flexShrink: 1 }}>
            <Text style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 25, lineHeight: 1.2, color: d.color }}>{d.painter.company}</Text>
            {d.painter.contact ? <Text style={{ fontSize: 14, lineHeight: 1.4, color: SUPPORT }}>{d.painter.contact}</Text> : null}
            {d.painter.whatsapp ? <Text style={{ fontSize: 14, lineHeight: 1.4, color: SUPPORT }}>WhatsApp {d.painter.whatsapp}</Text> : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[s.caps, { color: SUPPORT }]}>Orçamento nº</Text>
          <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 30, lineHeight: 1.15 }}>{d.number}</Text>
          <Text style={{ fontSize: 14, color: SUPPORT }}>{d.date}</Text>
        </View>
      </View>

      <View style={{ width: 44, height: 6, borderRadius: 3, backgroundColor: d.color, marginTop: 20, marginBottom: 12 }} />
      <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 34, lineHeight: 1.12, marginBottom: 16 }}>Orçamento de pintura</Text>

      <View style={[s.hr, { marginBottom: 14 }]} />
      <View style={{ flexDirection: "row", paddingBottom: 14 }}>
        <View style={{ width: "42%" }}>
          <Text style={[s.caps, { color: SUPPORT, marginBottom: 4 }]}>Para</Text>
          <Text style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3 }}>{d.clientName}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.caps, { color: SUPPORT, marginBottom: 4 }]}>Obra</Text>
          <Text style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3 }}>{d.siteAddress || "—"}</Text>
        </View>
      </View>
      <View style={[s.hr, { marginBottom: 14 }]} />

      {d.summary ? <Text style={{ fontSize: 15, lineHeight: 1.45, color: SUPPORT, marginBottom: 18 }}>{d.summary}</Text> : null}

      <View style={{ backgroundColor: d.tint, borderRadius: 20, padding: 24 }}>
        <Text style={[s.caps, { color: d.color }]}>Valor total</Text>
        <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 52, lineHeight: 1.08, color: d.color, marginTop: 2, marginBottom: 14 }}>{d.total}</Text>
        <View style={[s.hr, { borderBottomColor: LINE, marginBottom: 12 }]} />
        <View style={{ flexDirection: "row" }}>
          {[["Prazo", d.days, "27%"], ["Pagamento", d.payment, "37%"], ["Validade", d.validity, "36%"]].map(([label, value, w]) => (
            <View key={label} style={{ width: w }}>
              <Text style={[s.caps, { color: SUPPORT, marginBottom: 3 }]}>{label}</Text>
              <Text style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.33, paddingRight: 8 }}>{value}</Text>
            </View>
          ))}
        </View>
      </View>

      {d.deposit ? (
        <View wrap={false} style={{ marginTop: 18, borderWidth: 2, borderColor: LINE, borderRadius: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 22 }}>
            <View style={{ flexShrink: 1, paddingRight: 12 }}>
              <Text style={[s.caps, { color: d.color }]}>Para começar</Text>
              <Text style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 22, lineHeight: 1.2, marginTop: 2 }}>Pague a entrada</Text>
              <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 38, lineHeight: 1.1 }}>{d.deposit.amount}</Text>
              <Text style={{ fontSize: 14, color: SUPPORT }}>{d.deposit.pct}</Text>
            </View>
            <Link src={d.deposit.link} style={{ textDecoration: "none" }}>
              <View style={{ width: 224, height: 76, borderRadius: 16, backgroundColor: "#0B7F44", flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 19, color: "#FFFFFF", marginRight: 10 }}>PAGAR ENTRADA</Text>
                <Svg viewBox="0 0 24 24" width={22} height={22}>
                  <Path d="M5 12h13 M13 6l6 6-6 6" {...stroke("#FFFFFF")} strokeWidth={2.4} />
                </Svg>
              </View>
            </Link>
          </View>
          <View style={{ borderTopWidth: 2, borderTopColor: LINE, paddingVertical: 11, paddingHorizontal: 22 }}>
            <Text style={{ fontSize: 13, color: SUPPORT }}>
              Se o botão não abrir, copie este endereço: <Text style={{ fontWeight: 700, color: INK, textDecoration: "underline" }}>{d.deposit.link}</Text>
            </Text>
          </View>
        </View>
      ) : null}
      {!d.deposit ? <PixBlock d={d} /> : null}
      <Footer d={d} />
    </Page>
  );
}

function PixBlock({ d }: { d: QuotePdfData }) {
  if (!d.pix) return null;
  return (
        <View wrap={false} style={{ marginTop: 18, borderWidth: 2, borderColor: LINE, borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center" }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf, não é <img> */}
          <Image src={d.pix.qr} style={{ width: 118, height: 118 }} />
          <View style={{ marginLeft: 18, flexShrink: 1 }}>
            <Text style={[s.caps, { color: d.color }]}>Ou pague por Pix</Text>
            <Text style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 20, lineHeight: 1.2, marginTop: 2 }}>Entrada de {d.pix.amount}</Text>
            <Text style={{ fontSize: 13, color: SUPPORT }}>{d.pix.pct} Aponte a câmera do banco para o QR Code.</Text>
            <Text style={{ fontSize: 13, color: SUPPORT, marginTop: 4 }}>Recebedor: <Text style={{ fontWeight: 700, color: INK }}>{d.pix.receiver}</Text></Text>
            <Text style={{ fontSize: 12, color: SUPPORT, marginTop: 4 }}>O “copia e cola” segue na mensagem do WhatsApp.</Text>
          </View>
        </View>
  );
}

function Details({ d }: { d: QuotePdfData }) {
  return (
    <Page size="A4" style={s.page}>
      <RunningHeader d={d} />
      <Title>O que será feito</Title>
      {d.rooms.map((r) => (
        <View key={r.name} wrap={false} style={{ borderWidth: 1, borderColor: LINE, borderRadius: 20, padding: 20, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 24, lineHeight: 1.25 }}>{r.name}</Text>
            {r.price ? <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 24, color: d.color }}>{r.price}</Text> : null}
          </View>
          {r.facts ? <Text style={{ fontSize: 15, lineHeight: 1.33, color: SUPPORT, marginBottom: 8 }}>{r.facts}</Text> : null}
          {r.items.map((item) => (
            <View key={item} style={{ flexDirection: "row", marginBottom: 4 }}>
              <Svg viewBox="0 0 24 24" width={19} height={19} style={{ marginTop: 1.5, marginRight: 12 }}>
                <Path d="M4.5 12.5l5 5L19.5 7" {...stroke(d.color)} strokeWidth={2.6} />
              </Svg>
              <Text style={{ flex: 1, fontSize: 15, lineHeight: 1.4 }}>{item}</Text>
            </View>
          ))}
          {r.materials ? (
            <View style={{ backgroundColor: d.tint, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, marginTop: 8 }}>
              <Text style={[s.caps, { color: d.color, marginBottom: 2 }]}>Materiais inclusos</Text>
              <Text style={{ fontSize: 14, lineHeight: 1.3 }}>{r.materials}</Text>
            </View>
          ) : null}
        </View>
      ))}
      {d.showRoomPrices ? (
        <View wrap={false} style={{ backgroundColor: d.tint, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 20, marginTop: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[s.caps, { color: d.color }]}>Valor total</Text>
          <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 30, color: d.color }}>{d.total}</Text>
        </View>
      ) : null}
      <Footer d={d} />
    </Page>
  );
}

const H = ({ children }: { children: string }) => (
  <Text style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 18, lineHeight: 1.25, marginBottom: 4 }}>{children}</Text>
);

const Bullets = ({ items }: { items: string[] }) => (
  <View>{items.map((t) => <Text key={t} style={{ fontSize: 14, lineHeight: 1.43, marginBottom: 4 }}>{t}</Text>)}</View>
);

function Terms({ d }: { d: QuotePdfData }) {
  const c = d.color;
  return (
    <Page size="A4" style={s.page}>
      <RunningHeader d={d} />
      <Title>Combinados</Title>
      <View style={{ flexDirection: "row", marginBottom: 16 }}>
        <View style={{ width: "50%", flexDirection: "row", paddingRight: 14 }}>
          <Svg viewBox="0 0 24 24" width={24} height={24} style={{ marginRight: 10 }}>
            <Circle cx={12} cy={12} r={9.5} {...stroke(SUPPORT)} />
            <Path d="M7.5 12h9" {...stroke(SUPPORT)} />
          </Svg>
          <View style={{ flex: 1 }}><H>O que não está incluso</H><Bullets items={d.terms.exclusions} /></View>
        </View>
        <View style={{ width: "50%", flexDirection: "row" }}>
          <Svg viewBox="0 0 24 24" width={24} height={24} style={{ marginRight: 10 }}>
            <Path d="M9 4h6v3H9z M7.5 5.5H6.5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1 M8.5 12h7 M8.5 16h7" {...stroke(c)} strokeWidth={1.9} />
          </Svg>
          <View style={{ flex: 1 }}><H>Antes de começar</H><Bullets items={d.terms.before} /></View>
        </View>
      </View>

      {d.terms.warranty ? (
        <View style={{ flexDirection: "row", marginBottom: 16 }}>
          <Svg viewBox="0 0 24 24" width={24} height={24} style={{ marginRight: 10 }}>
            <Path d="M12 3l7 3v5.5c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6z M9 12l2.2 2.2L15.5 10" {...stroke(c)} strokeWidth={1.9} />
          </Svg>
          <View style={{ flex: 1 }}><H>Garantia</H><Text style={{ fontSize: 15, lineHeight: 1.4 }}>{d.terms.warranty}</Text></View>
        </View>
      ) : null}

      {d.notes ? (
        <View wrap={false} style={{ backgroundColor: d.tint, borderRadius: 20, padding: 18, flexDirection: "row", marginBottom: 20 }}>
          <Svg viewBox="0 0 24 24" width={24} height={24} style={{ marginRight: 12 }}>
            <Path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M8 9.5h8 M8 12.5h5" {...stroke(c)} strokeWidth={1.9} />
          </Svg>
          <View style={{ flex: 1 }}>
            <Text style={[s.caps, { color: c, marginBottom: 2 }]}>Observações do pintor</Text>
            <Text style={{ fontSize: 15, lineHeight: 1.4 }}>{d.notes}</Text>
          </View>
        </View>
      ) : null}

      {d.deposit ? <PixBlock d={d} /> : null}
      {d.photos.length > 0 ? (
        <View wrap={false}>
          <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 28, lineHeight: 1.2, marginBottom: 12 }}>Fotos da visita</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {d.photos.map((p, i) => (
              <View key={i} wrap={false} style={{ width: 163, marginRight: i % 3 === 2 ? 0 : 16, marginBottom: 14 }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf (não é <img> HTML) */}
                <Image src={p.src} style={{ width: 163, height: 96, borderRadius: 10, objectFit: "cover" }} />
                {p.room ? <Text style={{ fontWeight: 700, fontSize: 12, color: c, marginTop: 4 }}>{p.room}</Text> : null}
                {p.caption ? <Text style={{ fontSize: 13, lineHeight: 1.35 }}>{p.caption}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <Footer d={d} />
    </Page>
  );
}

function QuoteDoc({ d }: { d: QuotePdfData }) {
  return (
    <Document title={`Orçamento ${d.number} - ${d.painter.company}`} author={d.painter.company}>
      <Summary d={d} />
      <Details d={d} />
      <Terms d={d} />
    </Document>
  );
}

export async function renderQuotePdf(data: QuotePdfData): Promise<Blob> {
  registerFonts();
  return pdf(<QuoteDoc d={data} />).toBlob();
}
