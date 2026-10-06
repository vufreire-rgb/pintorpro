import { describe, expect, it } from "vitest";
import { deleteAccount, type AdminLike } from "./logic";

function fake(opts: { files?: string[]; failOn?: "list" | "remove" | "data" | "user" } = {}) {
  const calls: string[] = [];
  let files = [...(opts.files ?? [])];
  const admin: AdminLike = {
    storage: {
      from: () => ({
        async list(path, { limit, offset }) {
          calls.push(`list ${path}`);
          if (opts.failOn === "list") return { data: null, error: { message: "boom" } };
          return { data: files.slice(offset, offset + limit).map((name) => ({ name })), error: null };
        },
        async remove(paths) {
          calls.push(`remove ${paths.length}`);
          if (opts.failOn === "remove") return { error: { message: "boom" } };
          files = files.filter((f) => !paths.includes(`u1/${f}`));
          return { error: null };
        },
      }),
    },
    from: (t) => ({ delete: () => ({ eq: async (c, v) => { calls.push(`delete ${t} ${c}=${v}`); return { error: opts.failOn === "data" ? { message: "boom" } : null }; } }) }),
    auth: { admin: { async deleteUser(id) { calls.push(`deleteUser ${id}`); return { error: opts.failOn === "user" ? { message: "boom" } : null }; } } },
  };
  return { admin, calls, left: () => files };
}

describe("deleteAccount", () => {
  it("apaga arquivos, dados e por último o usuário", async () => {
    const f = fake({ files: ["a", "b", "c"] });
    const r = await deleteAccount(f.admin, "u1");
    expect(r.filesRemoved).toBe(3);
    expect(f.left()).toEqual([]);
    expect(f.calls.at(-2)).toBe("delete user_data user_id=u1");
    expect(f.calls.at(-1)).toBe("deleteUser u1");
  });

  it("conta sem arquivos também funciona", async () => {
    const f = fake();
    expect((await deleteAccount(f.admin, "u1")).filesRemoved).toBe(0);
    expect(f.calls).toContain("deleteUser u1");
  });

  it("muitos arquivos: remove em lotes de 100", async () => {
    const f = fake({ files: Array.from({ length: 250 }, (_, i) => `f${i}`) });
    await deleteAccount(f.admin, "u1");
    expect(f.calls.filter((c) => c.startsWith("remove")).sort()).toEqual(["remove 100", "remove 100", "remove 50"]);
    expect(f.left()).toEqual([]);
  });

  it("se falhar antes do fim, o usuário NÃO é apagado (dá para tentar de novo)", async () => {
    for (const failOn of ["list", "remove", "data"] as const) {
      const f = fake({ files: ["a"], failOn });
      await expect(deleteAccount(f.admin, "u1")).rejects.toThrow();
      expect(f.calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
    }
  });

  it("falha ao apagar o usuário é reportada", async () => {
    await expect(deleteAccount(fake({ failOn: "user" }).admin, "u1")).rejects.toThrow(/user/);
  });
});

describe("COLAR_NO_PAINEL.ts", () => {
  it("está igual ao código atual (se falhar: node supabase/functions/delete-account/gerar-arquivo-unico.mjs)", async () => {
    const { readFileSync } = await import("node:fs");
    const { compose } = await import("./gerar-arquivo-unico.mjs");
    const dir = new URL(".", import.meta.url);
    const want = compose(readFileSync(new URL("logic.ts", dir), "utf8"), readFileSync(new URL("index.ts", dir), "utf8"));
    expect(readFileSync(new URL("COLAR_NO_PAINEL.ts", dir), "utf8")).toBe(want);
  });
});
