import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

/** Roda public/sw.js num ambiente falso e devolve os "ouvintes" que ele registrou. */
function load() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const shown: { title: string; opts: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const navigated: string[] = [];
  const focused = vi.fn();
  let windows: { url: string; focus: () => Promise<void>; navigate: (u: string) => Promise<void> }[] = [];
  const self = {
    location: { origin: "https://medde.com.br" },
    addEventListener: (type: string, fn: (e: unknown) => void) => { handlers[type] = fn; },
    skipWaiting: () => undefined,
    registration: { showNotification: async (title: string, opts: Record<string, unknown>) => { shown.push({ title, opts }); } },
    clients: { claim: async () => undefined, matchAll: async () => windows, openWindow: async (u: string) => { opened.push(u); } },
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL, caches: {}, fetch: () => undefined, Response, console });
  return { handlers, shown, opened, navigated, focused, setWindows: (w: string[]) => { windows = w.map((url) => ({ url, focus: async () => focused(url), navigate: async (u: string) => { navigated.push(u); } })); } };
}

const pushEvent = (payload: unknown) => {
  const waits: Promise<unknown>[] = [];
  return { event: { data: { json: () => (typeof payload === "string" ? JSON.parse(payload) : payload), text: () => String(payload) }, waitUntil: (p: Promise<unknown>) => waits.push(p) }, done: () => Promise.all(waits) };
};

describe("service worker: notificações", () => {
  it("mostra a notificação com título, texto e endereço dentro do app", async () => {
    const sw = load();
    const { event, done } = pushEvent({ title: "O cliente abriu seu orçamento", body: "Maria abriu o orçamento nº 0042.", url: "/orcamentos/abc" });
    sw.handlers.push!(event);
    await done();
    expect(sw.shown[0]).toMatchObject({ title: "O cliente abriu seu orçamento", opts: { body: "Maria abriu o orçamento nº 0042.", data: { url: "/orcamentos/abc" }, icon: "/icons/icon-192.png" } });
  });
  it("endereço de fora do app vira a tela inicial", async () => {
    const sw = load();
    for (const url of ["https://golpe.com", "//golpe.com", 42]) {
      const { event, done } = pushEvent({ title: "x", url });
      sw.handlers.push!(event);
      await done();
    }
    expect(sw.shown.map((s) => (s.opts.data as { url: string }).url)).toEqual(["/", "/", "/"]);
  });
  it("sem texto válido ainda mostra uma notificação com o nome do app", async () => {
    const sw = load();
    const { event, done } = pushEvent("isto não é json");
    event.data.json = () => { throw new Error("bad"); };
    sw.handlers.push!(event);
    await done();
    expect(sw.shown[0]!.title).toBe("Medde");
  });
  it("tocar na notificação abre o app já aberto nessa tela, ou abre uma janela nova", async () => {
    const sw = load();
    const waits: Promise<unknown>[] = [];
    const closed = vi.fn();
    const click = { notification: { close: closed, data: { url: "/pedidos" } }, waitUntil: (p: Promise<unknown>) => waits.push(p) };
    sw.setWindows(["https://medde.com.br/obras"]);
    sw.handlers.notificationclick!(click);
    await Promise.all(waits);
    expect(closed).toHaveBeenCalled();
    expect(sw.focused).toHaveBeenCalled();
    expect(sw.navigated).toEqual(["/pedidos"]);
    expect(sw.opened).toEqual([]);

    const sw2 = load();
    const w2: Promise<unknown>[] = [];
    sw2.setWindows([]);
    sw2.handlers.notificationclick!({ notification: { close: () => undefined, data: { url: "/pedidos" } }, waitUntil: (p: Promise<unknown>) => w2.push(p) });
    await Promise.all(w2);
    expect(sw2.opened).toEqual(["/pedidos"]);
  });
});
