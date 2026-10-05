import { Document, Image, Page, StyleSheet, View, pdf } from "@react-pdf/renderer";
import type { ChargePdfData } from "@/modules/chargeData";
import { INK, LINE, Monogram, SUPPORT, Text, registerFonts } from "./quotePdf";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Atkinson", fontSize: 15, color: INK },
  caps: { fontFamily: "Atkinson", fontWeight: 700, fontSize: 12, letterSpacing: 1.1, textTransform: "uppercase", color: SUPPORT },
});

function ChargeDoc({ d }: { d: ChargePdfData }) {
  const rows: [string, string][] = [
    ["Parcela", d.label],
    ["Vencimento", d.dueDate],
    ...(d.siteAddress ? [["Obra", d.siteAddress] as [string, string]] : []),
  ];
  return (
    <Document title={`Cobrança ${d.label}`} author={d.company.name}>
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
            <Text style={s.caps}>Orçamento nº</Text>
            <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 24 }}>{d.number}</Text>
          </View>
        </View>

        <View style={{ borderBottomWidth: 1, borderBottomColor: LINE, marginVertical: 22 }} />
        <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 34, marginBottom: 6 }}>Cobrança</Text>
        <Text style={{ fontSize: 16, lineHeight: 1.5 }}>
          Para <Text style={{ fontWeight: 700 }}>{d.clientName || "—"}</Text>
        </Text>

        <View style={{ backgroundColor: d.tint, borderRadius: 18, padding: 22, marginVertical: 16 }}>
          <Text style={s.caps}>Valor a pagar</Text>
          <Text style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 44, color: d.color, lineHeight: 1.1 }}>{d.amount}</Text>
          <Text style={{ fontSize: 14, color: SUPPORT, marginTop: 4 }}>({d.amountWords})</Text>
          <Text style={{ fontWeight: 700, fontSize: 14, marginTop: 8, color: d.late ? "#B3261E" : INK }}>{d.status}</Text>
        </View>

        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={{ width: 120, fontWeight: 700, fontSize: 14, color: SUPPORT }}>{k}</Text>
            <Text style={{ flex: 1, fontSize: 15 }}>{v}</Text>
          </View>
        ))}

        {d.pix ? (
          <View wrap={false} style={{ marginTop: 14, borderWidth: 2, borderColor: LINE, borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf, não é <img> */}
            <Image src={d.pix.qr} style={{ width: 130, height: 130 }} />
            <View style={{ marginLeft: 18, flexShrink: 1 }}>
              <Text style={[s.caps, { color: d.color }]}>Pague por Pix</Text>
              <Text style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 20, lineHeight: 1.2, marginTop: 2 }}>{d.amount}</Text>
              <Text style={{ fontSize: 13, color: SUPPORT }}>Aponte a câmera do banco para o QR Code.</Text>
              <Text style={{ fontSize: 13, color: SUPPORT, marginTop: 4 }}>Recebedor: <Text style={{ fontWeight: 700, color: INK }}>{d.pix.receiver}</Text></Text>
              <Text style={{ fontSize: 12, color: SUPPORT, marginTop: 4 }}>O “copia e cola” segue na mensagem do WhatsApp.</Text>
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", marginTop: 22, borderWidth: 1, borderColor: LINE, borderRadius: 16 }}>
          {([["Valor combinado", d.summary.agreed], ["Já recebido", d.summary.received], ["Saldo da obra", d.summary.remaining]] as const).map(([k, v], i) => (
            <View key={k} style={{ flex: 1, padding: 14, borderLeftWidth: i ? 1 : 0, borderLeftColor: LINE }}>
              <Text style={s.caps}>{k}</Text>
              <Text style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 18, marginTop: 2 }}>{v}</Text>
            </View>
          ))}
        </View>
        <Text style={{ position: "absolute", left: 40, right: 40, bottom: 28, fontSize: 11, color: SUPPORT, textAlign: "center" }}>
          Depois de pagar, envie o comprovante pelo WhatsApp para darmos baixa. Obrigado!
        </Text>
      </Page>
    </Document>
  );
}

export async function renderChargePdf(data: ChargePdfData): Promise<Blob> {
  registerFonts();
  return pdf(<ChargeDoc d={data} />).toBlob();
}
