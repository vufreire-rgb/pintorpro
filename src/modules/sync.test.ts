import { beforeEach, describe, expect, it, vi } from "vitest";

// localStorage em memória (o ambiente de teste é Node).
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const cloud = { row: null as null | { data: string; updatedAt: string }, failPull: false, pushes: [] as string[] };
vi.mock("@/repositories/cloudStore", () => ({
  pull: vi.fn(async () => {
    if (cloud.failPull) throw new Error("offline");
    return cloud.row;
  }),
  push: vi.fn(async (_uid: string, raw: string) => {
    cloud.pushes.push(raw);
    const updatedAt = new Date().toISOString();
    cloud.row = { data: raw, updatedAt };
    return updatedAt;
  }),
}));

const FULL = JSON.stringify({ company: { name: "João" }, visits: [{ id: "v1" }] });

async function load() {
  vi.resetModules();
  const sync = await import("./sync");
  const local = await import("@/repositories/localStore");
  return { sync, local };
}

beforeEach(() => {
  store.clear();
  cloud.row = null;
  cloud.failPull = false;
  cloud.pushes = [];
});

describe("sincronização", () => {
  it("aparelho novo recebe os dados da nuvem (inclusive a empresa) e não envia nada", async () => {
    cloud.row = { data: FULL, updatedAt: "2026-10-01T10:00:00.000Z" };
    const { sync, local } = await load();
    await sync.startSync("u1");
    expect(local.readRaw()).toBe(FULL);
    expect(cloud.pushes).toHaveLength(0);
    await sync.stopSync();
  });

  it("falha ao ler a nuvem num aparelho sem cópia local: para e NÃO grava nada na nuvem", async () => {
    cloud.row = { data: FULL, updatedAt: "2026-10-01T10:00:00.000Z" };
    cloud.failPull = true;
    const { sync, local } = await load();
    await expect(sync.startSync("u1")).rejects.toThrow();
    local.writeRaw(JSON.stringify({ company: null }), {}); // mesmo que algo grave depois, nada é enviado
    await new Promise((r) => setTimeout(r, 1000));
    expect(cloud.pushes).toHaveLength(0);
    expect(cloud.row?.data).toBe(FULL);
  });

  it("falha ao ler a nuvem com cópia local: segue offline, mas só envia depois de ler a nuvem", async () => {
    vi.useFakeTimers();
    cloud.row = { data: FULL, updatedAt: "2026-10-01T10:00:00.000Z" };
    const first = await load();
    await first.sync.startSync("u1"); // baixa e guarda cache local
    await first.sync.stopSync();
    store.set("pintorpro:v1:u1", FULL); // cache do aparelho
    store.set("pintorpro:v1:u1:meta:synced", "2026-10-01T10:00:00.000Z"); // última sincronização conhecida
    cloud.failPull = true;
    const { sync, local } = await load();
    await sync.startSync("u1");
    local.writeRaw(JSON.stringify({ company: { name: "João" }, visits: [{ id: "v1" }, { id: "v2" }] }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(cloud.pushes).toHaveLength(0); // ainda sem ter lido a nuvem: não envia
    cloud.failPull = false;
    await vi.advanceTimersByTimeAsync(16000); // volta a internet: lê a nuvem e reconcilia
    expect(cloud.row?.data).toContain("v2"); // edição offline foi preservada
    vi.useRealTimers();
    await sync.stopSync();
  });

  it("conflito (nuvem mudou enquanto havia edição local): a nuvem manda e o local vai para uma cópia de segurança", async () => {
    const mine = JSON.stringify({ company: { name: "Local" }, visits: [] });
    store.set("pintorpro:v1:u1", mine);
    store.set("pintorpro:v1:u1:meta:dirty", "1");
    store.set("pintorpro:v1:u1:meta:synced", "2026-10-01T09:00:00.000Z");
    cloud.row = { data: FULL, updatedAt: "2026-10-01T10:00:00.000Z" };
    const { sync, local } = await load();
    await sync.startSync("u1");
    expect(local.readRaw()).toBe(FULL);
    expect(store.get("pintorpro:v1:backup:pintorpro:v1:u1")).toBe(mine);
    await sync.stopSync();
  });

  it("conta nova sobe os dados que já existiam no aparelho (modo local antigo)", async () => {
    store.set("pintorpro:v1", FULL);
    const { sync } = await load();
    await sync.startSync("u1");
    expect(cloud.row?.data).toBe(FULL);
    expect(store.has("pintorpro:v1")).toBe(false); // dados antigos já foram adotados
    await sync.stopSync();
  });

  it("duas chamadas simultâneas de login fazem uma única carga", async () => {
    cloud.row = { data: FULL, updatedAt: "2026-10-01T10:00:00.000Z" };
    const { sync } = await load();
    const cs = await import("@/repositories/cloudStore");
    await Promise.all([sync.startSync("u1"), sync.startSync("u1")]);
    expect(cs.pull).toHaveBeenCalledTimes(1);
    await sync.stopSync();
  });
});
