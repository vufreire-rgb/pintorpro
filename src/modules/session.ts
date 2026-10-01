/** Quem está logado agora (null no modo local). Preenchido pelo módulo de sincronização. */
let userId: string | null = null;
export const getUserId = (): string | null => userId;
export const setUserId = (id: string | null): void => {
  userId = id;
};
