"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { drawMarks, isTooShort, MARK_COLORS, markAt, moveMark } from "@/modules/markDraw";
import { useFileUrl } from "@/modules/photos";
import { shareMarkedPhoto } from "@/modules/share";
import type { PhotoMark } from "@/modules/types";
import { Maximize2, MousePointer2, MoveUpRight, Pencil, Plus, Minus, Ruler, Send, Trash2, Type, Undo2, X, type LucideIcon, Check } from "lucide-react";
import { Button, Chip } from "./ui";

type Tool = "move" | "text" | "arrow" | "dim";

const HINT: Record<Tool, string> = {
  move: "Toque numa marca para mexer · dois dedos dão zoom",
  text: "Toque onde quer escrever",
  arrow: "Arraste do começo até onde quer apontar",
  dim: "Arraste de uma ponta à outra da medida",
};
const MAX_SCALE = 6;
const clampN = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Tela cheia para desenhar na foto: texto, seta e cota (medida), em 6 cores, com zoom, desfazer e apagar.
 * As marcas são guardadas separadas da foto (coordenadas de 0 a 1); a foto original não muda.
 */
export function PhotoMarker({ photoId, initial, onSave, onClose }: { photoId: string; initial: PhotoMark[]; onSave: (marks: PhotoMark[]) => void; onClose: () => void }) {
  const url = useFileUrl(photoId);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState(1);
  const [box, setBox] = useState({ w: 0, h: 0 }); // área disponível
  const [marks, setMarks] = useState<PhotoMark[]>(initial);
  const [history, setHistory] = useState<PhotoMark[][]>([]);
  const [tool, setTool] = useState<Tool>("move");
  const [color, setColor] = useState<string>(MARK_COLORS[0]);
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<PhotoMark | null>(null);
  const [prompt, setPrompt] = useState<{ mark: PhotoMark; value: string; isNew: boolean } | null>(null);
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 }); // zoom e deslocamento (px)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // tamanho da foto na tela com zoom 1
  const fit = (() => {
    if (!box.w || !box.h) return { w: 0, h: 0 };
    const w = Math.min(box.w, box.h * aspect);
    return { w, h: w / aspect };
  })();
  const baseX = (box.w - fit.w) / 2, baseY = (box.h - fit.h) / 2;
  const W = fit.w * view.s, H = fit.h * view.s;

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // redesenha as marcas
  useEffect(() => {
    const c = canvas.current;
    if (!c || !W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const k = Math.min(1, 2048 / Math.max(W * dpr, H * dpr));
    c.width = Math.round(W * dpr * k);
    c.height = Math.round(H * dpr * k);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    drawMarks(ctx, c.width, c.height, draft ? [...marks, draft] : marks, sel);
  }, [marks, draft, sel, W, H]);

  const commit = useCallback((next: PhotoMark[]) => {
    setHistory((h) => [...h.slice(-30), marks]);
    setMarks(next);
  }, [marks]);

  // ---- gestos ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<null | { kind: "draw" | "drag" | "pan" | "pinch"; start?: { nx: number; ny: number }; last?: { nx: number; ny: number }; id?: string; moved?: boolean; pinch?: { dist: number; s: number; cx: number; cy: number }; panFrom?: { x: number; y: number; tx: number; ty: number }; before?: PhotoMark[] }>(null);

  const norm = (clientX: number, clientY: number) => {
    const r = stage.current!.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    return { nx: (x - baseX - view.tx) / W, ny: (y - baseY - view.ty) / H, x, y };
  };
  const inside = (p: { nx: number; ny: number }) => p.nx >= 0 && p.nx <= 1 && p.ny >= 0 && p.ny <= 1;

  /** Mantém a foto na tela: se ela é maior que a área, não deixa mostrar espaço vazio; se menor, centraliza. */
  const clampView = (s: number, tx: number, ty: number) => {
    const axis = (len: number, area: number, base: number, t: number) => {
      if (len <= area) return -base + (area - len) / 2;
      return Math.min(-base, Math.max(area - base - len, t));
    };
    return { s, tx: axis(fit.w * s, box.w, baseX, tx), ty: axis(fit.h * s, box.h, baseY, ty) };
  };

  const zoomTo = (s: number, cx = box.w / 2, cy = box.h / 2) => {
    const ns = Math.min(MAX_SCALE, Math.max(1, s));
    // mantém o ponto (cx, cy) no mesmo lugar da tela
    const px = (cx - baseX - view.tx) / view.s, py = (cy - baseY - view.ty) / view.s;
    setView(clampView(ns, cx - baseX - px * ns, cy - baseY - py * ns));
  };

  const onDown = (e: React.PointerEvent) => {
    if (prompt || !W) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      setDraft(null);
      const r = stage.current!.getBoundingClientRect();
      gesture.current = { kind: "pinch", pinch: { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), s: view.s, cx: (a!.x + b!.x) / 2 - r.left, cy: (a!.y + b!.y) / 2 - r.top }, panFrom: { x: 0, y: 0, tx: view.tx, ty: view.ty } };
      return;
    }
    const p = norm(e.clientX, e.clientY);
    if (tool === "move") {
      const hit = inside(p) ? markAt(marks, p.nx, p.ny, W, H) : undefined;
      if (hit) {
        setSel(hit.id);
        gesture.current = { kind: "drag", id: hit.id, last: p, before: marks };
      } else {
        setSel(null);
        gesture.current = { kind: "pan", panFrom: { x: p.x, y: p.y, tx: view.tx, ty: view.ty } };
      }
    } else if (tool === "text") {
      if (inside(p)) setPrompt({ mark: { id: crypto.randomUUID(), kind: "text", color, x1: p.nx, y1: p.ny, x2: p.nx, y2: p.ny, text: "" }, value: "", isNew: true });
    } else if (inside(p)) {
      const nx = clampN(p.nx), ny = clampN(p.ny);
      gesture.current = { kind: "draw", start: { nx, ny } };
      setDraft({ id: crypto.randomUUID(), kind: tool, color, x1: nx, y1: ny, x2: nx, y2: ny, text: "" });
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.kind === "pinch" && g.pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const r = stage.current!.getBoundingClientRect();
      const cx = (a!.x + b!.x) / 2 - r.left, cy = (a!.y + b!.y) / 2 - r.top;
      const ns = Math.min(MAX_SCALE, Math.max(1, g.pinch.s * (Math.hypot(a!.x - b!.x, a!.y - b!.y) / g.pinch.dist)));
      // o ponto sob o centro inicial acompanha o centro atual
      const k = ns / g.pinch.s;
      const tx = cx - baseX - (g.pinch.cx - baseX - g.panFrom!.tx) * k;
      const ty = cy - baseY - (g.pinch.cy - baseY - g.panFrom!.ty) * k;
      setView(clampView(ns, tx, ty));
      return;
    }
    const p = norm(e.clientX, e.clientY);
    if (g.kind === "draw" && g.start) {
      setDraft((d) => (d ? { ...d, x2: clampN(p.nx), y2: clampN(p.ny) } : d));
    } else if (g.kind === "drag" && g.id && g.last) {
      const dx = p.nx - g.last.nx, dy = p.ny - g.last.ny;
      g.last = p;
      g.moved = true;
      setMarks((ms) => ms.map((m) => (m.id === g.id ? moveMark(m, dx, dy) : m)));
    } else if (g.kind === "pan" && g.panFrom) {
      setView(clampView(view.s, g.panFrom.tx + (p.x - g.panFrom.x), g.panFrom.ty + (p.y - g.panFrom.y)));
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    gesture.current = null;
    if (g.kind === "draw" && draft) {
      const m = draft;
      setDraft(null);
      if (!isTooShort(m, W, H)) {
        if (m.kind === "dim") setPrompt({ mark: m, value: "", isNew: true });
        else { commit([...marks, m]); setSel(m.id); setTool("move"); }
      }
    } else if (g.kind === "drag" && g.moved && g.before) {
      setHistory((h) => [...h.slice(-30), g.before!]); // o arraste já alterou `marks`; guarda o estado de antes
    }
  };

  // ---- ações ----
  const selected = marks.find((m) => m.id === sel);
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setMarks(prev);
    setSel(null);
  };
  const remove = () => {
    if (!selected) return;
    commit(marks.filter((m) => m.id !== selected.id));
    setSel(null);
  };
  const pickColor = (c: string) => {
    setColor(c);
    if (selected) commit(marks.map((m) => (m.id === selected.id ? { ...m, color: c } : m)));
  };
  const confirmPrompt = () => {
    if (!prompt) return;
    const text = prompt.value.trim();
    if (!text) return setPrompt(null);
    const mark = { ...prompt.mark, text };
    commit(prompt.isNew ? [...marks, mark] : marks.map((m) => (m.id === mark.id ? mark : m)));
    setSel(mark.id);
    setPrompt(null);
    setTool("move");
  };
  const send = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await shareMarkedPhoto(photoId, marks);
      if (r === "missing") setMsg("Essa foto não está neste aparelho.");
      else if (r === "downloaded") setMsg("Foto baixada. Procure nos arquivos do celular.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-slate-900" role="dialog" aria-modal="true" aria-label="Marcar a foto">
      <header className="flex items-start justify-between gap-3 bg-brand px-4 py-3 text-white">
        <div>
          <div className="flex items-center gap-2 font-display text-xl font-bold"><Pencil size={22} strokeWidth={2.2} aria-hidden />Marcar a foto</div>
          <div className="min-h-12 text-base text-white/85">{HINT[tool]}</div>
        </div>
        <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15" aria-label="Fechar sem salvar" onClick={onClose}><X size={24} strokeWidth={2.2} aria-hidden /></button>
      </header>

      <div ref={stage} className="relative min-h-0 flex-1 touch-none select-none overflow-hidden" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {prompt ? (
        <div className="absolute inset-x-0 top-0 z-10 flex gap-2 bg-slate-100/95 p-3" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={prompt.value}
            onChange={(e) => setPrompt({ ...prompt, value: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && confirmPrompt()}
            placeholder={prompt.mark.kind === "dim" ? "Medida (ex.: 4,55 m)" : "Escreva aqui"}
            aria-label={prompt.mark.kind === "dim" ? "Medida" : "Texto da marca"}
            className="min-h-12 min-w-0 flex-1 rounded-2xl border-2 border-field bg-white px-3 text-xl outline-none focus:border-live"
          />
          <button className="min-h-12 rounded-2xl bg-accent-dark px-4 font-display text-lg font-bold text-white" onClick={confirmPrompt}>Incluir</button>
          <button className="grid min-h-12 w-12 place-items-center rounded-2xl bg-slate-200" aria-label="Cancelar" onClick={() => setPrompt(null)}><X size={20} strokeWidth={2.4} aria-hidden /></button>
        </div>
      ) : null}

        {url ? (
          <div className="absolute" style={{ left: baseX + view.tx, top: baseY + view.ty, width: W, height: H }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Foto para marcar"
              draggable={false}
              className="h-full w-full"
              onLoad={(e) => setAspect(e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1))}
            />
            <canvas ref={canvas} className="absolute inset-0 h-full w-full" data-testid="marks-canvas" />
          </div>
        ) : <p className="p-6 text-center text-white">Essa foto não está neste aparelho.</p>}
        <div className="absolute bottom-3 right-3 flex flex-col gap-2" onPointerDown={(e) => e.stopPropagation()}>
          <button className="grid h-12 w-12 place-items-center rounded-xl bg-white/90" aria-label="Aproximar" onClick={() => zoomTo(view.s * 1.5)}><Plus size={24} strokeWidth={2.4} aria-hidden /></button>
          <button className="grid h-12 w-12 place-items-center rounded-xl bg-white/90" aria-label="Afastar" onClick={() => zoomTo(view.s / 1.5)}><Minus size={24} strokeWidth={2.4} aria-hidden /></button>
          <button className="grid h-12 w-12 place-items-center rounded-xl bg-white/90" aria-label="Ajustar à tela" onClick={() => setView({ s: 1, tx: 0, ty: 0 })}><Maximize2 size={22} strokeWidth={2.2} aria-hidden /></button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-t-3xl bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-6 gap-1.5">
          {([["move", "Mover", MousePointer2], ["text", "Texto", Type], ["arrow", "Seta", MoveUpRight], ["dim", "Cota", Ruler]] as const).map(([id, label, Icon]) => (
            <ToolButton key={id} active={tool === id} onClick={() => { setTool(id); if (id !== "move") setSel(null); }} label={label} icon={Icon} />
          ))}
          <button className="grid min-h-14 place-items-center rounded-2xl border-2 border-field disabled:opacity-40" aria-label="Desfazer" disabled={history.length === 0} onClick={undo}><Undo2 size={24} strokeWidth={2.2} aria-hidden /></button>
          <button className="grid min-h-14 place-items-center rounded-2xl border-2 border-field text-err disabled:opacity-40" aria-label="Apagar marca" disabled={!selected} onClick={remove}><Trash2 size={24} strokeWidth={2.2} aria-hidden /></button>
        </div>
        <div className="flex items-center gap-2">
          {MARK_COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Cor ${c}`}
              aria-pressed={(selected?.color ?? color) === c}
              onClick={() => pickColor(c)}
              className={`h-10 w-10 rounded-full border-2 ${(selected?.color ?? color) === c ? "border-slate-900 ring-2 ring-brand" : "border-slate-300"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          {selected && selected.kind !== "arrow" ? <Chip active={false} onClick={() => setPrompt({ mark: selected, value: selected.text, isNew: false })}>Editar texto</Chip> : null}
        </div>
        {msg ? <p className="text-base text-support">{msg}</p> : null}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="ghost" icon={X} className="!px-2 !text-lg" onClick={onClose}>Cancelar</Button>
          <Button variant="ghost" icon={Send} className="!gap-1 !px-2 !text-lg" disabled={busy || marks.length === 0} onClick={send}>{busy ? "…" : "Enviar"}</Button>
          <Button icon={Check} className="!px-2 !text-lg" onClick={() => onSave(marks)}>Salvar</Button>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: LucideIcon }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-0.5 text-base font-bold leading-4 ${active ? "border-brand bg-brand-soft text-brand" : "border-field bg-white text-ink"}`}>
      <Icon size={22} strokeWidth={2.2} aria-hidden />
      {label}
    </button>
  );
}
