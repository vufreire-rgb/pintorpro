/**
 * Exclusão de conta (roda no servidor, com a chave de administrador do Supabase).
 * Apaga, nesta ordem: arquivos (fotos e áudios) → dados da conta → usuário.
 * O usuário é o último passo: se algo falhar antes, a pessoa ainda consegue entrar e tentar de novo.
 */
type Err = { message: string } | null;

export interface AdminLike {
  storage: {
    from(bucket: string): {
      list(path: string, opts: { limit: number; offset: number }): Promise<{ data: { name: string }[] | null; error: Err }>;
      remove(paths: string[]): Promise<{ error: Err }>;
    };
  };
  from(table: string): { delete(): { eq(column: string, value: string): Promise<{ error: Err }> } };
  auth: { admin: { deleteUser(id: string): Promise<{ error: Err }> } };
}

export const BUCKET = "visit-files";
const PAGE = 1000;
const BATCH = 100;

export async function deleteAccount(admin: AdminLike, userId: string): Promise<{ filesRemoved: number }> {
  const bucket = admin.storage.from(BUCKET);

  const names: string[] = [];
  for (;;) {
    // Sempre offset 0: depois de remover, o que sobra "sobe" na lista.
    const { data, error } = await bucket.list(userId, { limit: PAGE, offset: 0 });
    if (error) throw new Error(`list: ${error.message}`);
    if (!data || data.length === 0) break;
    const batch = data.map((f) => `${userId}/${f.name}`);
    for (let i = 0; i < batch.length; i += BATCH) {
      const { error: rmError } = await bucket.remove(batch.slice(i, i + BATCH));
      if (rmError) throw new Error(`remove: ${rmError.message}`);
    }
    names.push(...batch);
  }

  const { error: dataError } = await admin.from("user_data").delete().eq("user_id", userId);
  if (dataError) throw new Error(`user_data: ${dataError.message}`);

  const { error: userError } = await admin.auth.admin.deleteUser(userId);
  if (userError) throw new Error(`user: ${userError.message}`);

  return { filesRemoved: names.length };
}
