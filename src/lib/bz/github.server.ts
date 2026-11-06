/**
 * GitHub Integration & Repository Publisher Server Module
 */
import fs from 'fs';
import path from 'path';
import { bzFetch } from './http.server.js';
import { getSecretKey } from './keystore.server.js';

export interface GitHubPushResult {
  success: boolean;
  repoUrl?: string;
  message: string;
  user?: string;
}

export async function testGitHubToken(token?: string): Promise<{ valid: boolean; user?: string; error?: string }> {
  const ghToken = token || getSecretKey('githubToken');
  if (!ghToken) {
    return { valid: false, error: 'Token GitHub absent' };
  }

  try {
    const res = await bzFetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'User-Agent': 'Blackzeldon-Oscar-Pro',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeoutMs: 5000
    });

    if (!res.ok) {
      return { valid: false, error: `Erreur GitHub HTTP ${res.status} : Token invalide ou expiré.` };
    }

    const data = await res.json();
    return { valid: true, user: data.login };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Erreur de connexion à GitHub' };
  }
}

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'data', '.git', '.vite', 'coverage']);
const MAX_FILES = 400;
const MAX_FILE_BYTES = 1_500_000;

/** Liste les fichiers du projet à publier (jamais .env*, jamais de node_modules / données locales). */
function collectProjectFiles(root: string): Array<{ rel: string; abs: string }> {
  const out: Array<{ rel: string; abs: string }> = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= MAX_FILES) return;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(abs);
      } else if (entry.isFile()) {
        if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
        if (entry.name.endsWith('.zip') || entry.name.endsWith('.log')) continue;
        if (fs.statSync(abs).size > MAX_FILE_BYTES) continue;
        out.push({ rel: path.relative(root, abs).split(path.sep).join('/'), abs });
      }
    }
  };
  walk(root);
  return out;
}

export async function createAndPushToGitHub(
  repoName = 'blackzeldon-cockpit',
  isPrivate = true,
  token?: string
): Promise<GitHubPushResult> {
  const ghToken = token || getSecretKey('githubToken');
  if (!ghToken) return { success: false, message: 'Configure un token GitHub (scope repo) côté serveur.' };
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(repoName)) return { success: false, message: 'Nom de dépôt invalide.' };

  const userCheck = await testGitHubToken(ghToken);
  if (!userCheck.valid || !userCheck.user) return { success: false, message: userCheck.error || 'Token GitHub invalide.' };
  const username = userCheck.user;

  const H = {
    Authorization: `Bearer ${ghToken}`,
    'User-Agent': 'Blackzeldon-Cockpit',
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };
  const api = (p: string, init: RequestInit = {}) =>
    bzFetch(`https://api.github.com${p}`, { ...init, headers: { ...H, ...(init.headers || {}) }, timeoutMs: 20000, retries: 1 });

  try {
    // 1. Dépôt (créé avec un commit initial pour que l'API Git Data fonctionne ; PRIVÉ par défaut)
    let repoRes = await api(`/repos/${username}/${repoName}`);
    if (repoRes.status === 404) {
      const createRes = await api('/user/repos', {
        method: 'POST',
        body: JSON.stringify({ name: repoName, description: 'Blackzeldon Cockpit — SMC & Quantum Edge', private: isPrivate, auto_init: true })
      });
      if (!createRes.ok) return { success: false, message: `Création du dépôt impossible (HTTP ${createRes.status}).` };
      repoRes = createRes;
    } else if (!repoRes.ok) {
      return { success: false, message: `Accès au dépôt impossible (HTTP ${repoRes.status}).` };
    }
    const repo = await repoRes.json();
    const branch: string = repo.default_branch || 'main';

    // 2. Commit parent
    const refRes = await api(`/repos/${username}/${repoName}/git/ref/heads/${branch}`);
    if (!refRes.ok) return { success: false, message: `Branche ${branch} introuvable (HTTP ${refRes.status}).` };
    const parentSha: string = (await refRes.json()).object.sha;
    const parentCommit = await (await api(`/repos/${username}/${repoName}/git/commits/${parentSha}`)).json();

    // 3. Blobs
    const files = collectProjectFiles(process.cwd());
    const tree: Array<{ path: string; mode: string; type: string; sha: string }> = [];
    for (const f of files) {
      const blobRes = await api(`/repos/${username}/${repoName}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: fs.readFileSync(f.abs).toString('base64'), encoding: 'base64' })
      });
      if (!blobRes.ok) return { success: false, message: `Échec d'envoi de ${f.rel} (HTTP ${blobRes.status}).` };
      tree.push({ path: f.rel, mode: '100644', type: 'blob', sha: (await blobRes.json()).sha });
    }

    // 4. Arbre + commit + mise à jour de la branche
    const treeRes = await api(`/repos/${username}/${repoName}/git/trees`, {
      method: 'POST', body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree })
    });
    if (!treeRes.ok) return { success: false, message: `Création de l'arbre impossible (HTTP ${treeRes.status}).` };
    const commitRes = await api(`/repos/${username}/${repoName}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message: `Publication du cockpit (${files.length} fichiers)`, tree: (await treeRes.json()).sha, parents: [parentSha] })
    });
    if (!commitRes.ok) return { success: false, message: `Création du commit impossible (HTTP ${commitRes.status}).` };
    const patch = await api(`/repos/${username}/${repoName}/git/refs/heads/${branch}`, {
      method: 'PATCH', body: JSON.stringify({ sha: (await commitRes.json()).sha, force: false })
    });
    if (!patch.ok) return { success: false, message: `Mise à jour de la branche impossible (HTTP ${patch.status}).` };

    const htmlUrl = repo.html_url || `https://github.com/${username}/${repoName}`;
    return { success: true, repoUrl: htmlUrl, user: username, message: `${files.length} fichiers publiés sur ${htmlUrl} (branche ${branch}, dépôt ${repo.private ? 'privé' : 'PUBLIC'}).` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Erreur lors de la publication GitHub' };
  }
}
