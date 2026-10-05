import { Document, Page, StyleSheet, View, pdf } from "@react-pdf/renderer";
import type { ReceiptPdfData } from "@/modules/receiptData";
import { INK, LINE, Monogram, SUPPORT, Text, registerFonts } from "./quotePdf";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Atkinson", fontSize: 15, color: INK },
  caps: { fontFamily: "Atkinson", fontWeight: 700, fontSize: 12, letterSpacing: 1.1, textTransform: "uppercase", color: SUPPORT },
});

function ReceiptDoc({ d }: { d: ReceiptPdfData }) {
  const rows: [string, string][] = [
    ["Referente a", d.note],
    ...(d.method ? [["Forma de pagamento", d.method] as [string, string]] : []),
    ...(d.siteAddress ? [["Obra", d.siteAddress] as [string, string]] : []),
  ];
  return (
    <Document title={`Recibo ${d.number}`} author={d.company.name}>
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", flexShrink: 1 }}>
            <Monogram text={d.company.initials} logo={d.logo} color={d.color} size={52} radius={14} font={22} />
            <View style={{ marginLeft: 14, flexShrink: 1 }}>
              <Text style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 22, lineHeight: 1.2, color: d.color }}>{d.company.name}</Text>
              {d.company.owner || d.company.city ? <Text style={{ fontSize: 13, color: SUPPORT }}>{[d.company.owner, d.company.city].filter(Boolean).join(" · ")}</Text> : null}
              {d.company.whatsapp ? <Text style={{ fontSize: 13, color: SUPPORT }}>WhatsApp {d.company.whatsapp}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.caps}>Recibo nº</Text>
            <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 24 }}>{d.number}</Text>
            <Text style={{ fontSize: 13, color: SUPPORT }}>{d.date}</Text>
          </View>
        </View>

        <View style={{ borderBottomWidth: 1, borderBottomColor: LINE, marginVertical: 22 }} />
        <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 34, marginBottom: 14 }}>Recibo de pagamento</Text>
        <Text style={{ fontSize: 16, lineHeight: 1.5 }}>
          Recebi de <Text style={{ fontWeight: 700 }}>{d.clientName || "—"}</Text> a quantia de:
        </Text>

        <View style={{ backgroundColor: d.tint, borderRadius: 18, padding: 22, marginVertical: 16 }}>
          <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 44, color: d.color, lineHeight: 1.1 }}>{d.amount}</Text>
          <Text style={{ fontSize: 14, color: SUPPORT, marginTop: 4 }}>({d.amountWords})</Text>
        </View>

        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={{ width: 150, fontWeight: 700, fontSize: 14, color: SUPPORT }}>{k}</Text>
            <Text style={{ flex: 1, fontSize: 15 }}>{v}</Text>
          </View>
        ))}

        <View style={{ flexDirection: "row", marginTop: 22, borderWidth: 1, borderColor: LINE, borderRadius: 16 }}>
          {([["Valor combinado", d.summary.agreed], ["Recebido até aqui", d.summary.received], ["Saldo a receber", d.summary.remaining]] as const).map(([k, v], i) => (
            <View key={k} style={{ flex: 1, padding: 14, borderLeftWidth: i ? 1 : 0, borderLeftColor: LINE }}>
              <Text style={s.caps}>{k}</Text>
              <Text style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 18, marginTop: 2 }}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 60, alignItems: "center" }}>
          <View style={{ width: 260, borderTopWidth: 1, borderTopColor: INK, paddingTop: 6, alignItems: "center" }}>
            <Text style={{ fontWeight: 700 }}>{d.company.owner || d.company.name}</Text>
            <Text style={{ fontSize: 12, color: SUPPORT }}>{[d.company.city, d.date].filter(Boolean).join(", ")}</Text>
          </View>
        </View>
        <Text style={{ position: "absolute", left: 40, right: 40, bottom: 28, fontSize: 11, color: SUPPORT, textAlign: "center" }}>
          Este recibo comprova o pagamento acima e não substitui nota fiscal.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReceiptPdf(data: ReceiptPdfData): Promise<Blob> {
  registerFonts();
  return pdf(<ReceiptDoc d={data} />).toBlob();
}
