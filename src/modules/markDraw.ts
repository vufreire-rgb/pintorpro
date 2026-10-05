import type { PhotoMark } from "./types";

/** Desenho e geometria das marcações nas fotos. Sem React: o mesmo código desenha na tela e no PDF. */

export const MARK_COLORS = ["#EF4444", "#F59E0B", "#22C55E", "#3B82F6", "#111827", "#FFFFFF"] as const;

const fontOf = (w: number, h: number) => Math.round(Math.min(w, h) * 0.056);

const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
};

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.font = `700 ${size}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, size * 0.24);
  ctx.strokeStyle = isLight(color) ? "#111827" : "#FFFFFF"; // contorno para ler em qualquer fundo
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Desenha as marcações num canvas de w×h pixels. `selectedId` mostra as alças (só no editor). */
export function drawMarks(ctx: CanvasRenderingContext2D, w: number, h: number, marks: PhotoMark[], selectedId?: string | null): void {
  const u = Math.min(w, h);
  const lw = Math.max(2, u * 0.007);
  const font = fontOf(w, h);
  for (const m of marks) {
    const x1 = m.x1 * w, y1 = m.y1 * h, x2 = m.x2 * w, y2 = m.y2 * h;
    ctx.strokeStyle = m.color;
    ctx.fillStyle = m.color;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (m.kind === "text") {
      label(ctx, m.text, x1, y1, font, m.color);
    } else {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      // contorno fino para a linha aparecer em fundo da mesma cor
      ctx.save();
      ctx.strokeStyle = isLight(m.color) ? "#111827" : "#FFFFFF";
      ctx.lineWidth = lw + 2;
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (m.kind === "arrow") {
        const head = u * 0.04;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45));
        ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45));
        ctx.closePath();
        ctx.fill();
      } else {
        const tick = u * 0.022;
        for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
          ctx.beginPath();
          ctx.moveTo(x - tick * Math.sin(ang), y + tick * Math.cos(ang));
          ctx.lineTo(x + tick * Math.sin(ang), y - tick * Math.cos(ang));
          ctx.stroke();
        }
        if (m.text) label(ctx, m.text, (x1 + x2) / 2, (y1 + y2) / 2 - font * 0.9, font, m.color);
      }
    }
    if (m.id === selectedId) {
      ctx.save();
      ctx.lineWidth = Math.max(2, u * 0.004);
      ctx.strokeStyle = "#2563EB";
      ctx.fillStyle = "#FFFFFF";
      if (m.kind === "text") {
        ctx.font = `700 ${font}px sans-serif`;
        const tw = ctx.measureText(m.text).width;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x1 - tw / 2 - 6, y1 - font * 0.8, tw + 12, font * 1.6);
      } else {
        for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
          ctx.beginPath(); ctx.arc(x, y, u * 0.016, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
}

const distToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/** A marca está sob o toque (nx, ny em 0..1) numa imagem de w×h? `slop` = folga em pixels. */
export function hitMark(m: PhotoMark, nx: number, ny: number, w: number, h: number, slop = 22): boolean {
  const px = nx * w, py = ny * h;
  if (m.kind === "text") {
    const font = fontOf(w, h);
    const tw = Math.max(font, m.text.length * font * 0.6);
    return Math.abs(px - m.x1 * w) <= tw / 2 + slop / 2 && Math.abs(py - m.y1 * h) <= font * 0.8 + slop / 2;
  }
  return distToSegment(px, py, m.x1 * w, m.y1 * h, m.x2 * w, m.y2 * h) <= slop;
}

/** A marca mais "de cima" (a última desenhada) que está sob o toque. */
export const markAt = (marks: PhotoMark[], nx: number, ny: number, w: number, h: number): PhotoMark | undefined =>
  [...marks].reverse().find((m) => hitMark(m, nx, ny, w, h));

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Desloca a marca inteira, sem deixá-la sair da foto. */
export function moveMark(m: PhotoMark, dx: number, dy: number): PhotoMark {
  const minX = Math.min(m.x1, m.x2), maxX = Math.max(m.x1, m.x2), minY = Math.min(m.y1, m.y2), maxY = Math.max(m.y1, m.y2);
  const ddx = clamp(dx, -minX, 1 - maxX);
  const ddy = clamp(dy, -minY, 1 - maxY);
  return { ...m, x1: m.x1 + ddx, x2: m.x2 + ddx, y1: m.y1 + ddy, y2: m.y2 + ddy };
}

/** Seta/cota curtas demais (um toque sem arrastar) são descartadas. */
export const isTooShort = (m: PhotoMark, w: number, h: number, minPx = 12): boolean => Math.hypot((m.x2 - m.x1) * w, (m.y2 - m.y1) * h) < minPx;
