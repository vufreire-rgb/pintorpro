import { describe, expect, it } from "vitest";
import { addDays, buildWorkIcs, dateBR, dateLabel, isThisWeek, paidCents, paidPct, remainingCents, suggestEnd } from "./workInfo";
import type { Work } from "./types";

const w = (o: Partial<Work> = {}): Work => ({ id: "w1", quoteId: "q", clientId: "c", title: "t", status: "scheduled", createdAt: "", plannedDays: 3, plannedHours: 24, plannedTotalCents: 300000, plannedCostCents: 0, ...o });
const NOW = new Date(2026, 9, 10, 10, 0).getTime(); // 10/10/2026

describe("dinheiro da obra", () => {
  it("soma o recebido e calcula o que falta", () => {
    const x = w({ payments: [{ id: "1", date: "2026-10-01", amountCents: 100000, note: "Entrada" }, { id: "2", date: "2026-10-05", amountCents: 50000, note: "Parcela" }] });
    expect(paidCents(x)).toBe(150000);
    expect(remainingCents(x)).toBe(150000);
    expect(paidPct(x)).toBe(50);
  });
  it("sem pagamentos falta tudo; pagou a mais não fica negativo", () => {
    expect(remainingCents(w())).toBe(300000);
    expect(remainingCents(w({ payments: [{ id: "1", date: "2026-10-01", amountCents: 400000, note: "" }] }))).toBe(0);
    expect(paidPct(w({ payments: [{ id: "1", date: "2026-10-01", amountCents: 400000, note: "" }] }))).toBe(100);
  });
});

describe("datas da obra", () => {
  it("soma dias e sugere término contando o primeiro dia", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(suggestEnd("2026-10-10", 3)).toBe("2026-10-12");
    expect(suggestEnd("2026-10-10", 0.5)).toBe("2026-10-10");
  });
  it("rótulos", () => {
    expect(dateLabel(w(), NOW)).toBe("Sem data");
    expect(dateLabel(w({ startDate: "2026-10-10" }), NOW)).toBe("Começa hoje");
    expect(dateLabel(w({ startDate: "2026-10-11" }), NOW)).toBe("Começa amanhã");
    expect(dateLabel(w({ startDate: "2026-10-20", endDate: "2026-10-22" }), NOW)).toBe("20/10 a 22/10");
    expect(dateLabel(w({ startDate: "2026-10-08", endDate: "2026-10-12", status: "in_progress" }), NOW)).toBe("Até 12/10");
    expect(dateBR("2026-10-05")).toBe("05/10/2026");
  });
  it("'desta semana': começa em até 7 dias ou está acontecendo; concluída não", () => {
    expect(isThisWeek(w({ startDate: "2026-10-15" }), NOW)).toBe(true);
    expect(isThisWeek(w({ startDate: "2026-10-30" }), NOW)).toBe(false);
    expect(isThisWeek(w({ startDate: "2026-10-08", endDate: "2026-10-12" }), NOW)).toBe(true);
    expect(isThisWeek(w({ startDate: "2026-10-08", endDate: "2026-10-09" }), NOW)).toBe(false);
    expect(isThisWeek(w({ startDate: "2026-10-12", status: "done" }), NOW)).toBe(false);
    expect(isThisWeek(w(), NOW)).toBe(false);
  });
  it("arquivo .ics: dia inteiro, término exclusivo e lembrete na véspera", () => {
    const ics = buildWorkIcs(w({ startDate: "2026-10-20", endDate: "2026-10-22" }), { id: "c", name: "Ana", phone: "", address: "", createdAt: "" } as never, "Rua A, 1");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261020");
    expect(ics).toContain("DTEND;VALUE=DATE:20261023");
    expect(ics).toContain("SUMMARY:Obra - Ana");
    expect(ics).toContain("TRIGGER:-P1D");
    expect(buildWorkIcs(w(), undefined, "")).toBe("");
  });
});

import { buildReviewIcs, firstOccurrence, isValidTime, reminderLabel } from "./reminder";
describe("lembrete de revisão", () => {
  const now = new Date(2026, 9, 10, 10, 0); // sábado 10/10/2026 10:00
  it("rótulos e validação", () => {
    expect(reminderLabel({ time: "08:00", days: [0, 1, 2, 3, 4, 5, 6] })).toBe("Todo dia às 08:00");
    expect(reminderLabel({ time: "08:00", days: [5, 4, 3, 2, 1] })).toBe("Seg a Sex às 08:00");
    expect(reminderLabel({ time: "07:30", days: [3, 1] })).toBe("Seg, Qua às 07:30");
    expect(isValidTime("08:00")).toBe(true);
    expect(isValidTime("25:00")).toBe(false);
    expect(isValidTime("")).toBe(false);
  });
  it("primeira ocorrência: hoje se ainda não passou, senão o próximo dia marcado", () => {
    expect(firstOccurrence({ time: "18:00", days: [6] }, now).getDate()).toBe(10);
    expect(firstOccurrence({ time: "08:00", days: [6] }, now).getDate()).toBe(17);
    expect(firstOccurrence({ time: "08:00", days: [1, 2, 3, 4, 5] }, now).getDate()).toBe(12); // segunda
  });
  it(".ics: recorrência semanal ou diária, alarme na hora, UID fixo", () => {
    const wk = buildReviewIcs({ time: "08:00", days: [1, 3] }, "https://x/orcamentos", now);
    expect(wk).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE");
    expect(wk).toContain("DTSTART:20261012T080000");
    expect(wk).toContain("TRIGGER:PT0S");
    expect(wk).toContain("UID:revisao-orcamentos@pintorpro");
    expect(buildReviewIcs({ time: "08:00", days: [0, 1, 2, 3, 4, 5, 6] }, "u", now)).toContain("RRULE:FREQ=DAILY");
  });
});
