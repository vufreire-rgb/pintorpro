import { ImageResponse } from "next/og";
import { readQuotePeek } from "../pageData";

/** Imagem da prévia do link do orçamento (1200×630): nome de quem enviou, número e total, na cor do pintor. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  const p = await readQuotePeek(token);
  if (!p) return new Response("not found", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: p.color, color: "#fff", padding: 72 }}>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>{p.company}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 44, opacity: 0.9 }}>{`Orçamento${p.number ? ` nº ${p.number}` : ""}`}</div>
          {p.total ? <div style={{ display: "flex", fontSize: 120, fontWeight: 700, marginTop: 8 }}>{p.total}</div> : null}
        </div>
        <div style={{ display: "flex", fontSize: 38, opacity: 0.9 }}>Toque para ver os detalhes</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
