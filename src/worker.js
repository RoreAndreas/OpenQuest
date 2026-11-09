/* ================================================================
   OpenQuest — la porte d'entrée (Cloudflare Worker, fichiers statiques dans public/)
   Rien n'est servi tant que le visiteur n'a pas donné son nom et le bon code d'accès.
   Le code est le secret TOKEN_PASS du projet Cloudflare : il n'apparaît jamais dans la page.
   Chaque entrée (réussie ou non) est notée dans les journaux du projet, et dans le KV
   ACCESS_LOG s'il est relié : on sait ainsi qui a accès, et quand.
   ================================================================ */
import {DurableObject} from 'cloudflare:workers';
// La session dure 15 minutes : passé ce délai, le code d'accès est redemandé. Le nom, lui, est retenu 30 jours.
const SESSION = 'oq_session', NAME = 'oq_name', EXP = 'oq_exp', SESSION_MIN = 15, NAME_DAYS = 30, MAX_STATE = 1800000;

// Le coffre de chaque joueur : un Durable Object par nom d'accès, qui garde la dernière copie de ses données
export class Coffre extends DurableObject {
  async lire() { return (await this.ctx.storage.get('etat')) || null; }
  async ecrire(etat) { await this.ctx.storage.put('etat', etat); await this.ctx.storage.put('maj', Date.now()); return true; }
}
const coffreDe = (env, name) => env.COFFRES.get(env.COFFRES.idFromName('coffre:' + name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()));
const json = (o, status = 200) => new Response(JSON.stringify(o), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}});
async function api(request, env, who) {
  if (!env.COFFRES) return json({erreur: 'coffre non configuré'}, 503);
  const coffre = coffreDe(env, who);
  if (request.method === 'GET') return json({etat: await coffre.lire()});
  if (request.method === 'PUT') {
    const body = await request.text();
    if (body.length > MAX_STATE) return json({erreur: 'données trop volumineuses'}, 413);
    let d; try { d = JSON.parse(body); } catch (e) { return json({erreur: 'JSON invalide'}, 400); }
    if (!d || !Array.isArray(d.expenses) || !Array.isArray(d.categories)) return json({erreur: 'ce ne sont pas des données OpenQuest'}, 400);
    await coffre.ecrire(body); return json({ok: true});
  }
  return json({erreur: 'méthode non permise'}, 405);
}
const enc = new TextEncoder();
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = s => b64url(enc.encode(s));
const fromB64urlText = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
// Comparaison à temps constant : on compare des empreintes de même longueur
async function sameSecret(a, b, secret) {
  const [x, y] = await Promise.all([hmac(secret, 'cmp|' + a), hmac(secret, 'cmp|' + b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0 && x.length === y.length;
}
const cookies = req => Object.fromEntries((req.headers.get('Cookie') || '').split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf('='); return [c.slice(0, i), c.slice(i + 1)]; }));

// La session : nom.expiration.signature, signée avec le secret (changer TOKEN_PASS ferme toutes les sessions)
async function makeSession(name, secret) {
  const exp = Date.now() + SESSION_MIN * 6e4, n = b64urlText(name);
  return {exp, token: `${n}.${exp}.${await hmac(secret, `${n}.${exp}`)}`};
}
async function readSession(token, secret) {
  if (!token) return null;
  const [n, exp, sig] = token.split('.');
  if (!n || !exp || !sig || +exp < Date.now()) return null;
  if (!(await sameSecret(sig, await hmac(secret, `${n}.${exp}`), secret))) return null;
  try { return fromB64urlText(n); } catch (e) { return null; }
}

async function logAccess(context, entry) {
  const {request, env} = context;
  const row = {...entry, at: new Date().toISOString(), ip: request.headers.get('CF-Connecting-IP') || '', country: (request.cf && request.cf.country) || '', ua: (request.headers.get('User-Agent') || '').slice(0, 160)};
  console.log(JSON.stringify({openquest_access: row}));
  if (env.ACCESS_LOG) context.waitUntil(env.ACCESS_LOG.put(`${row.at}|${crypto.randomUUID().slice(0, 8)}`, JSON.stringify(row), {expirationTtl: 180 * 864e5}).catch(() => {}));
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
function page(body, status = 200, extraHeaders = {}) {
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#0c0a12"><title>OpenQuest · Accès</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:radial-gradient(120% 70% at 50% 18%,#2a2440 0%,#15121f 55%,#0a0810 100%);color:#fff;font-family:'VT323',monospace;font-size:21px;display:flex;align-items:center;justify-content:center;padding:16px}
.ff{width:min(100%,380px);background:linear-gradient(180deg,#4252c4 0%,#1c2680 55%,#0c1250 100%);border:3px solid #e4e4f0;border-radius:7px;box-shadow:0 0 0 2px #06061a,inset 0 0 0 2px #6a7ad0;padding:18px 20px;text-shadow:2px 2px 0 rgba(0,0,0,.55)}
h1{font-family:'Press Start 2P',monospace;font-size:14px;font-weight:normal;color:#ffd166;margin:0 0 12px;text-align:center}
p{margin:6px 0 12px;color:#c8cff0}label{display:block;color:#a8b0e0;margin:8px 0 2px}
input{width:100%;font:inherit;color:#fff;background:#0a0e3a;border:2px solid #9aa4e0;border-radius:3px;padding:6px 8px}
input:focus{outline:2px solid #ffd166}
button{width:100%;margin-top:14px;font:inherit;color:#fff;background:linear-gradient(#5a6ad8,#2a3698);border:2px solid #e4e4f0;border-radius:4px;padding:6px 12px;cursor:pointer;text-shadow:1px 1px 0 #000}
.err{color:#ff6b70}
</style></head><body><main class="ff">${body}</main></body></html>`, {status, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...extraHeaders}});
}
const loginForm = (msg, name = '') => page(`<h1>OPENQUEST</h1><p>La cité suspendue est gardée. Dis qui tu es et donne le code d'accès.</p>
${msg ? `<p class="err">${esc(msg)}</p>` : ''}<form method="post" action="/acces" autocomplete="off">
<label for="n">Ton nom</label><input id="n" name="name" maxlength="40" required value="${esc(name)}" autofocus>
<label for="c">Code d'accès</label><input id="c" name="code" type="password" maxlength="200" required>
<button>Entrer</button></form>`, msg ? 401 : 200);

// Les cookies d'une session ouverte : la session (HttpOnly, 15 min), le nom et l'heure d'expiration (lisibles par le jeu)
async function sessionCookies(name, secret, secure) {
  const {exp, token} = await makeSession(name, secret), keep = NAME_DAYS * 86400;
  return [['Set-Cookie', `${SESSION}=${token}; Path=/; Max-Age=${SESSION_MIN * 60}; HttpOnly; SameSite=Lax${secure}`], ['Set-Cookie', `${NAME}=${encodeURIComponent(name)}; Path=/; Max-Age=${keep}; SameSite=Lax${secure}`], ['Set-Cookie', `${EXP}=${exp}; Path=/; Max-Age=${keep}; SameSite=Lax${secure}`]];
}
const nameCookie = req => { try { return decodeURIComponent(cookies(req)[NAME] || ''); } catch (e) { return ''; } };

export default {
  fetch(request, env, ctx) { return gate({request, env, waitUntil: p => ctx.waitUntil(p), next: () => env.ASSETS.fetch(request)}); },
};
async function gate(context) {
  const {request, env, next} = context, url = new URL(request.url), secret = env.TOKEN_PASS;
  if (!secret) return page(`<h1>ACCÈS FERMÉ</h1><p>Le code d'accès n'est pas configuré : ajoute le secret <b>TOKEN_PASS</b> au projet Cloudflare, puis redéploie.</p>`, 503);
  const secure = url.protocol === 'https:' ? '; Secure' : '';

  if (url.pathname === '/sortie') { // se déconnecter
    return new Response(null, {status: 302, headers: [['Location', '/'], ['Set-Cookie', `${SESSION}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`], ['Set-Cookie', `${NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`], ['Set-Cookie', `${EXP}=; Path=/; Max-Age=0; SameSite=Lax${secure}`]]});
  }
  if (url.pathname === '/acces' && request.method === 'POST') { // le formulaire d'entrée
    const form = await request.formData().catch(() => null);
    const name = String((form && form.get('name')) || '').trim().replace(/\s+/g, ' ').slice(0, 40), code = String((form && form.get('code')) || '');
    if (!name || !(await sameSecret(code, secret, secret))) {
      await logAccess(context, {ok: false, name});
      await new Promise(r => setTimeout(r, 800)); // ralentit les essais au hasard
      return loginForm(!name ? 'Indique ton nom.' : 'Code incorrect.', name);
    }
    await logAccess(context, {ok: true, name});
    return new Response(null, {status: 303, headers: [['Location', '/'], ...(await sessionCookies(name, secret, secure))]});
  }
  if (url.pathname === '/api/renouveler' && request.method === 'POST') { // le code redemandé toutes les 15 minutes, sans quitter le jeu
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || nameCookie(request) || '').trim().replace(/\s+/g, ' ').slice(0, 40), code = String(body.code || '');
    if (!name || !(await sameSecret(code, secret, secret))) { await logAccess(context, {ok: false, name, renew: true}); await new Promise(r => setTimeout(r, 800)); return json({ok: false, erreur: name ? 'Code incorrect.' : 'Nom manquant.'}, 401); }
    await logAccess(context, {ok: true, name, renew: true});
    const headers = new Headers({'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); for (const [k, v] of await sessionCookies(name, secret, secure)) headers.append(k, v);
    return new Response(JSON.stringify({ok: true}), {headers});
  }
  const who = await readSession(cookies(request)[SESSION], secret);
  if (url.pathname === '/api/coffre') return who ? api(request, env, who) : json({erreur: 'session requise'}, 401);
  if (!who) return loginForm('', nameCookie(request));
  const res = await next();
  const out = new Response(res.body, res); out.headers.set('Cache-Control', 'private, no-store'); out.headers.set('X-Robots-Tag', 'noindex');
  return out;
}
