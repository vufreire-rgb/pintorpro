import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

/** Dados do PDF do cliente. Por construção NÃO contém custo, lucro ou margem. */
export interface QuotePdfData {
  companyName: string;
  companyWhatsapp: string;
  companyCity: string;
  number: number;
  date: string;
  validUntil: string;
  clientName: string;
  siteAddress: string;
  rooms: { name: string; lines: { name: string; qty: string }[] }[];
  materialNames: string[];
  total: string;
  days: string;
  paymentTerms: string;
  notes: string;
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  head: { borderBottom: "2 solid #1d4ed8", paddingBottom: 10, marginBottom: 14 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  muted: { color: "#475569" },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  room: { fontFamily: "Helvetica-Bold", marginTop: 6 },
  total: { marginTop: 16, padding: 12, backgroundColor: "#eff6ff", flexDirection: "row", justifyContent: "space-between" },
  totalValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
});

function QuoteDoc({ d }: { d: QuotePdfData }) {
  return (
    <Document title={`Orçamento ${d.number} - ${d.companyName}`}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <Text style={s.title}>{d.companyName}</Text>
          <Text style={s.muted}>{[d.companyWhatsapp && `WhatsApp ${d.companyWhatsapp}`, d.companyCity].filter(Boolean).join(" · ")}</Text>
        </View>
        <View style={s.row}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 14 }}>Orçamento nº {d.number}</Text>
          <Text style={s.muted}>Emitido em {d.date}</Text>
        </View>
        <Text style={s.h2}>Cliente</Text>
        <Text>{d.clientName}</Text>
        {d.siteAddress ? <Text style={s.muted}>Obra: {d.siteAddress}</Text> : null}

        <Text style={s.h2}>Escopo dos serviços</Text>
        {d.rooms.map((r) => (
          <View key={r.name} wrap={false}>
            <Text style={s.room}>{r.name}</Text>
            {r.lines.map((l) => (
              <View key={l.name} style={s.row}>
                <Text>{l.name}</Text>
                <Text style={s.muted}>{l.qty}</Text>
              </View>
            ))}
          </View>
        ))}

        {d.materialNames.length > 0 ? (
          <>
            <Text style={s.h2}>Materiais incluídos</Text>
            <Text>{d.materialNames.join(", ")}</Text>
          </>
        ) : null}

        <View style={s.total}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Valor total</Text>
          <Text style={s.totalValue}>{d.total}</Text>
        </View>

        <Text style={s.h2}>Condições</Text>
        <Text>Prazo estimado: {d.days}</Text>
        <Text>Pagamento: {d.paymentTerms}</Text>
        <Text>Validade da proposta: 7 dias (até {d.validUntil})</Text>
        {d.notes ? <Text style={{ marginTop: 6 }}>Observações: {d.notes}</Text> : null}
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(data: QuotePdfData): Promise<Blob> {
  return pdf(<QuoteDoc d={data} />).toBlob();
}
