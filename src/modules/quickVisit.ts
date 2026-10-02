"use client";
import { createQuickVisit } from "./visits";

/** Cria a visita na hora (sem cliente) e devolve o endereço da tela dela. */
export const startQuickVisit = (): string => `/visitas/${createQuickVisit()}`;
