"use client";
import { useEffect } from "react";
import { useDb } from "@/modules/db";
import { themeVars } from "@/modules/theme";

/** Pinta o app com a cor que o pintor escolheu em Ajustes (a mesma do PDF). */
export function ThemeApplier() {
  const color = useDb()?.company?.brandColor;
  useEffect(() => {
    if (!color) return;
    const root = document.documentElement;
    for (const [k, v] of Object.entries(themeVars(color))) root.style.setProperty(k, v);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  }, [color]);
  return null;
}
