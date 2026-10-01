/**
 * Fotos ficam no aparelho (IndexedDB), pois são arquivos pesados demais para o cache de texto.
 * Quando o armazenamento em nuvem (Supabase Storage) for ligado, só este arquivo muda.
 */
const DB_NAME = "pintorpro-files";
const STORE = "photos";

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putPhoto = (id: string, blob: Blob) => run("readwrite", (s) => s.put(blob, id)).then(() => undefined);
export const getPhoto = (id: string) => run<Blob | undefined>("readonly", (s) => s.get(id));
export const deletePhoto = (id: string) => run("readwrite", (s) => s.delete(id)).then(() => undefined);
