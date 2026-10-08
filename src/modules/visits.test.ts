import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.mock("@/repositories/cloudStore", () => ({ cloudConfigured: false }));
vi.mock("@/repositories/fileStore", () => ({ putFile: vi.fn(async () => undefined), getFile: vi.fn(async () => undefined), deleteFile: vi.fn(async () => undefined) }));

import { newDb } from "./db";
import { saveQuote } from "./quotes";
import { addSurface, EMPTY_ROOM, roomFromForm } from "./rooms";
import { addVisitAudio, saveVisitRoom, createClientForVisit, createQuickVisit, createScheduledVisit, rescheduleVisit, removeVisitRoom, setVisitClient, startVisit } from "./visits";
import { buildIcs, confirmationText, countByFilter, filterVisits, firstFilledFilter, fromLocalInput, mapsUrl, telUrl, toLocalInput, visitState, waUrl, whenLabel } from "./visitList";
import type { Client, Db, Visit } from "./types";

const read = (): Db => JSON.parse(store.get("pintorpro:v1")!) as Db;
const write = (db: Db) => store.set("pintorpro:v1", JSON.stringify(db));

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();
const NOW = new Date(2026, 9, 10, 10, 0).getTime(); // 10/10/2026 10:00 (hora local)

beforeEach(() => {
  store.clear();
  const db = newDb();
  db.company = { name: "Silva Pinturas", whatsapp: "1", city: "c", paymentTerms: "50/50", hoursPerDay: 8, marginPct: 30, dailyRateCents: 25000, safetyDays: 1, pricingMode: "base_price", marginMode: "on_price" };
  write(db);
});

describe("visita rápida e cliente depois", () => {
  it("nasce na hora, iniciada e sem cliente", () => {
    const id = createQuickVisit();
    const v = read().visits[0]!;
    expect(v.id).toBe(id);
    expect(v.clientId).toBeUndefined();
    expect(v.startedAt).toBeTruthy();
    expect(visitState(v)).toBe("done");
  });

  it("cliente pode ser escolhido ou cadastrado depois; o endereço do cliente preenche a visita", () => {
    const id = createQuickVisit();
    createClientForVisit(id, { name: "Maria Souza", phone: "11999990000", address: "Rua A, 10" });
    let v = read().visits[0]!;
    expect(read().clients[0]!.name).toBe("Maria Souza");
    expect(v.clientId).toBe(read().clients[0]!.id);
    expect(v.siteAddress).toBe("Rua A, 10");
    const other = { id: "c9", name: "João", phone: "", address: "Rua B" } as Client;
    write({ ...read(), clients: [...read().clients, other] });
    setVisitClient(id, "c9");
    v = read().visits[0]!;
    expect(v.clientId).toBe("c9");
    expect(v.siteAddress).toBe("Rua A, 10"); // não sobrescreve endereço já preenchido
  });

  it("ao salvar o orçamento a visita sem cliente herda o cliente do orçamento", () => {
    const id = createQuickVisit();
    const db = read();
    const input = { rooms: [], extras: [] };
    saveQuote(db, { clientId: "cX", visitId: id, siteAddress: "x", input, paymentTerms: "p", notes: "" });
    expect(read().visits[0]!.clientId).toBe("cX");
    expect(read().visits[0]!.quoteId).toBeTruthy();
  });
});

describe("agendar visita", () => {
  it("cria visita futura, cadastra o cliente se informado, e só vira 'feita' ao começar", () => {
    const when = at(2026, 10, 11, 9, 0);
    const id = createScheduledVisit(read(), { name: "Ana", phone: "11988887777", address: "Av. Brasil, 5", scheduledAt: when });
    let v = read().visits[0]!;
    expect(v.scheduledAt).toBe(when);
    expect(v.startedAt).toBeUndefined();
    expect(read().clients[0]!.name).toBe("Ana");
    expect(visitState(v, NOW)).toBe("scheduled");
    startVisit(id);
    v = read().visits[0]!;
    expect(visitState(v, NOW)).toBe("done");
    rescheduleVisit(id, at(2026, 10, 12, 8, 0));
    expect(visitState(read().visits[0]!, NOW)).toBe("scheduled");
  });

  it("sem nome nem cliente: agenda mesmo assim (só endereço)", () => {
    createScheduledVisit(read(), { address: "Rua Z", scheduledAt: at(2026, 10, 11, 9, 0) });
    expect(read().clients).toHaveLength(0);
    expect(read().visits[0]!.clientId).toBeUndefined();
  });

  it("atrasada: passou mais de 1h e não começou", () => {
    const v = { id: "v", siteAddress: "", notes: "", photoIds: [], createdAt: at(2026, 10, 1), scheduledAt: at(2026, 10, 10, 8, 30) } as Visit;
    expect(visitState(v, NOW)).toBe("late");
    expect(visitState({ ...v, scheduledAt: at(2026, 10, 10, 9, 30) }, NOW)).toBe("scheduled"); // 30 min de atraso ainda é tolerado
  });
});

describe("lista: busca, filtros e ordem", () => {
  const clients: Client[] = [{ id: "c1", name: "João Pereira", phone: "11 99999-1111", address: "" }, { id: "c2", name: "Maria", phone: "", address: "" }];
  const base = { notes: "", photoIds: [] as string[], siteAddress: "" };
  const visits: Visit[] = [
    { ...base, id: "a", clientId: "c1", createdAt: at(2026, 10, 1), startedAt: at(2026, 10, 1), quoteId: "q1" },
    { ...base, id: "b", clientId: "c2", createdAt: at(2026, 10, 5), startedAt: at(2026, 10, 5), notes: "Parede com mofo" },
    { ...base, id: "c", clientId: "c1", createdAt: at(2026, 10, 2), scheduledAt: at(2026, 10, 12, 9) },
    { ...base, id: "d", createdAt: at(2026, 10, 3), scheduledAt: at(2026, 10, 11, 9), siteAddress: "Rua das Flores", rooms: [{ id: "r", name: "Cozinha", lengthM: 3, widthM: 3, heightM: 2.7, condition: "nova", doors: 1, windows: 1 }] },
  ];

  it("ordem: agendadas primeiro (mais próxima antes), depois as mais recentes", () => {
    expect(filterVisits(visits, clients, {}, NOW).map((v) => v.id)).toEqual(["d", "c", "b", "a"]);
  });

  it("busca sem acento e em vários campos (cliente, notas, endereço, ambiente)", () => {
    const ids = (q: string) => filterVisits(visits, clients, { query: q }, NOW).map((v) => v.id);
    expect(ids("joao")).toEqual(["c", "a"]);
    expect(ids("MOFO")).toEqual(["b"]);
    expect(ids("flores")).toEqual(["d"]);
    expect(ids("cozinha")).toEqual(["d"]);
    expect(ids("99999")).toEqual(["c", "a"]);
    expect(ids("zzz")).toEqual([]);
  });

  it("filtros e contagens", () => {
    expect(filterVisits(visits, clients, { filter: "todo" }, NOW).map((v) => v.id)).toEqual(["b"]);
    expect(filterVisits(visits, clients, { filter: "quoted" }, NOW).map((v) => v.id)).toEqual(["a"]);
    expect(filterVisits(visits, clients, { filter: "scheduled" }, NOW).map((v) => v.id)).toEqual(["d", "c"]);
    expect(countByFilter(visits, NOW)).toEqual({ all: 4, todo: 1, quoted: 1, scheduled: 2 });
  });

  it("a lista abre na primeira aba que tem visita (nunca numa aba vazia se há visitas em outra)", () => {
    const [a, b, c] = visits as [Visit, Visit, Visit];
    expect(firstFilledFilter(visits, NOW)).toBe("scheduled");
    expect(firstFilledFilter([a, b], NOW)).toBe("todo");
    expect(firstFilledFilter([a], NOW)).toBe("scheduled"); // só há visita já orçada: não é aba; abre em Agendadas (vazia) e o link mostra as orçadas
    expect(firstFilledFilter([c], NOW)).toBe("scheduled");
    expect(firstFilledFilter([], NOW)).toBe("scheduled");
  });
});

describe("datas, contato e calendário", () => {
  it("rótulos de data", () => {
    expect(whenLabel(at(2026, 10, 10, 14, 30), NOW)).toBe("Hoje, 14:30");
    expect(whenLabel(at(2026, 10, 11, 9, 0), NOW)).toBe("Amanhã, 09:00");
    expect(whenLabel(at(2026, 10, 9, 9, 0), NOW)).toBe("Ontem, 09:00");
    expect(whenLabel(at(2026, 10, 15, 9, 0), NOW)).toMatch(/15\/10.*09:00/);
  });

  it("campo de data/hora ida e volta", () => {
    const iso = at(2026, 10, 11, 9, 5);
    expect(toLocalInput(iso)).toBe("2026-10-11T09:05");
    expect(fromLocalInput("2026-10-11T09:05")).toBe(iso);
  });

  it("links de contato", () => {
    expect(telUrl("(11) 99999-1111")).toBe("tel:11999991111");
    expect(waUrl("(11) 99999-1111")).toBe("https://wa.me/5511999991111");
    expect(waUrl("5511999991111", "oi")).toBe("https://wa.me/5511999991111?text=oi");
    expect(mapsUrl("Rua A, 10")).toContain("query=Rua%20A%2C%2010");
  });

  it("texto de confirmação e arquivo .ics com alarme", () => {
    const v: Visit = { id: "v1", siteAddress: "Rua A, 10; ap. 3", notes: "Portão azul, tocar 32", photoIds: [], createdAt: at(2026, 10, 1), scheduledAt: at(2026, 10, 11, 9, 0) };
    const c: Client = { id: "c", name: "Maria Souza", phone: "1", address: "" };
    const company = { name: "Silva Pinturas" } as Db["company"];
    expect(confirmationText(v, c, company, NOW)).toBe("Olá Maria! Confirmando nossa visita amanhã, 09:00 em Rua A, 10; ap. 3. Qualquer imprevisto, me avise. — Silva Pinturas");
    const ics = buildIcs(v, c, NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("SUMMARY:Visita - Maria Souza");
    expect(ics).toContain("LOCATION:Rua A\\, 10\; ap. 3");
    expect(ics).toContain("DESCRIPTION:Portão azul\\, tocar 32");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(buildIcs({ ...v, scheduledAt: undefined }, c)).toBe("");
  });
});

describe("medidas na visita viram ambientes do orçamento", () => {
  it("anota, nomeia automaticamente e remove", () => {
    const id = createQuickVisit();
    const wall = addSurface([], "wall");
    saveVisitRoom(id, { name: "Sala", surfaces: wall, doors: 1, windows: 1 });
    saveVisitRoom(id, { name: "  ", surfaces: wall, doors: 1, windows: 1 });
    expect(read().visits[0]!.rooms!.map((r) => r.name)).toEqual(["Sala", "Ambiente 2"]);
    removeVisitRoom(id, read().visits[0]!.rooms![0]!.id);
    expect(read().visits[0]!.rooms!.map((r) => r.name)).toEqual(["Ambiente 2"]);
  });

  it("roomFromForm: usa o id da visita, sugere serviços pelo estado da parede e respeita os serviços ativos", () => {
    const form = { ...EMPTY_ROOM, name: "Sala", lengthM: 5, widthM: 4, condition: "descascando", doors: 1, windows: 0 };
    const room = roomFromForm(form, ["pintura_parede", "raspagem", "pintura_teto", "portas", "janelas"], "r-fixo");
    expect(room.id).toBe("r-fixo");
    expect(room.services.map((s) => s.serviceId)).toEqual(["raspagem", "pintura_parede", "pintura_teto", "portas"]);
    expect(room.openings).toHaveLength(1);
    expect(room.wallCondition).toBe("descascando");
    expect(roomFromForm({ ...form, name: " " }, [], undefined, "Ambiente 3").name).toBe("Ambiente 3");
  });
});

describe("marcas no áudio", () => {
  it("guarda as marcas com o momento exato", async () => {
    const id = createQuickVisit();
    await addVisitAudio(id, new Blob(["x"], { type: "audio/wav" }), 90, [{ t: 12, label: "📍 Medida" }, { t: 47, label: "⚠️ Problema" }]);
    const note = read().visits[0]!.audios![0]!;
    expect(note.seconds).toBe(90);
    expect(note.markers).toEqual([{ t: 12, label: "📍 Medida" }, { t: 47, label: "⚠️ Problema" }]);
  });
});
