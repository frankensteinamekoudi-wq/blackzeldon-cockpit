/**
 * Appels aux routes protégées du serveur. Le code admin (ADMIN_TOKEN) est demandé une fois,
 * gardé le temps de l'onglet (sessionStorage) et jamais écrit dans le code ni dans localStorage.
 */
const KEY = 'bz_admin_token';

function getToken(): string {
  try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; }
}
function setToken(v: string) {
  try { sessionStorage.setItem(KEY, v); } catch { /* ignore */ }
}

export async function adminFetch(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const call = async (token: string) => {
    const res = await fetch(`/api/public/bz${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
      body: JSON.stringify(body ?? {})
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* corps vide */ }
    return { ok: res.ok, status: res.status, data };
  };

  let r = await call(getToken());
  if (r.status === 401 || r.status === 403) {
    const entered = typeof window !== 'undefined' ? window.prompt('Code admin du serveur (ADMIN_TOKEN) :') : null;
    if (!entered) return r;
    setToken(entered.trim());
    r = await call(entered.trim());
  }
  return r;
}
