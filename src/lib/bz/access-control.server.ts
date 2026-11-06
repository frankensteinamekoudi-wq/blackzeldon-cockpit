/**
 * Contrôle d'accès : limiteur de débit (token bucket par IP) + authentification admin
 * pour les routes sensibles (clés API, GitHub, envois de notifications).
 */
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

interface ClientBucket { tokens: number; lastRefill: number }

const BUCKETS = new Map<string, ClientBucket>();
const CAPACITY = 120;   // rafale max
const REFILL_RATE = 2;  // jetons / seconde

export function checkRateLimit(clientId: string, now = Date.now()): { allowed: boolean; remaining: number } {
  let bucket = BUCKETS.get(clientId);
  if (!bucket) {
    bucket = { tokens: CAPACITY - 1, lastRefill: now };
    BUCKETS.set(clientId, bucket);
    return { allowed: true, remaining: CAPACITY - 1 };
  }
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsedSec * REFILL_RATE);
  bucket.lastRefill = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
  }
  return { allowed: false, remaining: 0 };
}

/** Évite la croissance infinie de la Map (une entrée par IP rencontrée). */
export function purgeIdleBuckets(maxIdleMs = 10 * 60 * 1000, now = Date.now()): number {
  let n = 0;
  for (const [k, b] of BUCKETS) {
    if (now - b.lastRefill > maxIdleMs) { BUCKETS.delete(k); n++; }
  }
  return n;
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = req.ip || req.socket.remoteAddress || 'unknown';
  const r = checkRateLimit(id);
  if (!r.allowed) {
    res.status(429).json({ error: 'Trop de requêtes. Réessaie dans quelques secondes.' });
    return;
  }
  next();
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Routes sensibles :
 *  - si ADMIN_TOKEN est défini : l'en-tête `x-admin-token` doit correspondre ;
 *  - sinon : accès autorisé uniquement depuis la machine locale (loopback).
 * Sécurisé par défaut : en ligne, rien ne passe tant que ADMIN_TOKEN n'est pas défini.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_TOKEN || '';
  if (expected) {
    const given = String(req.header('x-admin-token') || '');
    if (given && safeEqual(given, expected)) return next();
    res.status(401).json({ error: 'Code admin invalide ou manquant (en-tête x-admin-token).' });
    return;
  }
  const ip = req.socket.remoteAddress || '';
  if (LOOPBACK.has(ip)) return next();
  res.status(403).json({
    error: "Route protégée. Définis la variable d'environnement ADMIN_TOKEN sur le serveur puis envoie-la dans l'en-tête x-admin-token."
  });
}
