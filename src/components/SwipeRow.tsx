"use client";
import { useRef, useState, type ReactNode } from "react";

export interface SwipeAction { label: string; icon?: ReactNode; className: string }

const THRESHOLD = 96;
const MAX = 150;

/**
 * Cartão que se arrasta para o lado: para a direita faz `right`, para a esquerda faz `left`.
 * O toque rápido continua abrindo o cartão. Rolar para cima/baixo continua normal.
 */
export function SwipeRow({ right, left, onRight, onLeft, children }: {
  right?: SwipeAction; left?: SwipeAction; onRight?: () => void; onLeft?: () => void; children: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const horizontal = useRef(false);

  const clamp = (v: number) => Math.max(left ? -MAX : 0, Math.min(right ? MAX : 0, v));
  const act = dx > 0 ? right : dx < 0 ? left : undefined;
  const armed = Math.abs(dx) >= THRESHOLD;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {act ? (
        <div aria-hidden className={`absolute inset-0 flex items-center gap-2 px-5 text-lg font-bold text-white ${dx > 0 ? "justify-start" : "justify-end"} ${act.className} ${armed ? "" : "opacity-70"}`}>
          {act.icon}{act.label}
        </div>
      ) : null}
      <div
        className="relative touch-pan-y transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${dx}px)`, transitionDuration: dragging ? "0ms" : undefined }}
        // Swipes que começam no cartão não devem trocar a aba da tela (a tela escuta o mesmo gesto).
        onTouchStart={(e) => { e.stopPropagation(); const t = e.touches[0]!; start.current = { x: t.clientX, y: t.clientY }; moved.current = false; horizontal.current = false; }}
        onTouchMove={(e) => {
          if (!start.current) return;
          e.stopPropagation();
          const t = e.touches[0]!;
          const mx = t.clientX - start.current.x, my = t.clientY - start.current.y;
          if (!horizontal.current) {
            if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { start.current = null; setDx(0); return; }
            if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my)) { horizontal.current = true; setDragging(true); } else return;
          }
          moved.current = true;
          setDx(clamp(mx));
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          const fire = horizontal.current && Math.abs(dx) >= THRESHOLD ? (dx > 0 ? onRight : onLeft) : undefined;
          start.current = null;
          horizontal.current = false;
          setDragging(false);
          setDx(0);
          fire?.();
        }}
        onTouchCancel={() => { start.current = null; horizontal.current = false; setDragging(false); setDx(0); }}
        // Depois de arrastar, o "clique" que o navegador gera não pode abrir o cartão.
        onClickCapture={(e) => { if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; } }}
      >
        {children}
      </div>
    </div>
  );
}
