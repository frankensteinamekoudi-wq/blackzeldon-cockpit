/**
 * Stockage : journal des trades (persisté sur disque en JSON), diagnostics et heartbeat.
 * Le journal survit aux redémarrages (data/journal.json, désactivable avec BZ_PERSIST=false).
 */
import fs from 'fs';
import path from 'path';
import type { JournalRecord } from './journal-types.js';

export type { JournalRecord } from './journal-types.js';

export interface DiagnosticEvent {
  event: string;
  symbol?: string;
  reason?: string;
  created_at: string;
}

const MAX_JOURNAL = 5000;

class BlackzeldonDB {
  private journal: Map<string, JournalRecord> = new Map();
  private diagnostics: DiagnosticEvent[] = [];
  private lastCycleAt: string = new Date().toISOString();
  private lastDataAt: string | null = null;
  private lastSignalAt: string | null = null;
  private lastTradeAt: string | null = null;
  private cycleCount = 0;
  private lastError: string | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly persistEnabled = process.env.BZ_PERSIST !== 'false';
  private readonly file = path.resolve(process.env.BZ_DATA_DIR || path.join(process.cwd(), 'data'), 'journal.json');

  private storageKey(client: string, key: string) {
    return JSON.stringify([client, key]);
  }

  constructor() {
    this.loadFromDisk();
    this.recordDiagnostic('SYSTEM_INIT', undefined, `Moteur BZ démarré (${this.journal.size} trades en journal)`);
  }

  private loadFromDisk() {
    if (!this.persistEnabled) return;
    try {
      if (!fs.existsSync(this.file)) return;
      const arr = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (Array.isArray(arr)) {
        for (const r of arr) {
          if (r && typeof r.key === 'string') {
            const client = typeof r.client === 'string' && r.client ? r.client : 'anonymous';
            this.journal.set(this.storageKey(client, r.key), { ...r, client });
          }
        }
      }
    } catch (e: any) {
      console.warn('[db] lecture du journal impossible :', e?.message);
    }
  }

  private schedulePersist() {
    if (!this.persistEnabled || this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        const tmp = this.file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(Array.from(this.journal.values())));
        fs.renameSync(tmp, this.file);
      } catch (e: any) {
        console.warn('[db] écriture du journal impossible :', e?.message);
      }
    }, 500);
    this.persistTimer.unref?.();
  }

  recordDiagnostic(event: string, symbol?: string, reason?: string) {
    this.diagnostics.unshift({ event, symbol, reason, created_at: new Date().toISOString() });
    if (this.diagnostics.length > 200) this.diagnostics.pop();
  }

  touchCycle(error?: string) {
    this.lastCycleAt = new Date().toISOString();
    this.cycleCount++;
    if (error) this.lastError = error;
  }
  touchData() { this.lastDataAt = new Date().toISOString(); }
  touchSignal() { this.lastSignalAt = new Date().toISOString(); }
  touchTrade() { this.lastTradeAt = new Date().toISOString(); }

  getHeartbeat() {
    return {
      last_cycle_at: this.lastCycleAt,
      last_data_at: this.lastDataAt,
      last_signal_at: this.lastSignalAt,
      last_trade_at: this.lastTradeAt,
      cycle_count: this.cycleCount,
      last_error: this.lastError
    };
  }

  getDiagnostics() { return this.diagnostics; }

  saveJournalEntries(client: string, entries: Partial<JournalRecord>[]) {
    const owner = client.trim();
    if (!owner) return;
    for (const e of entries) {
      if (!e || typeof e.key !== 'string' || !e.key) continue;
      const storageKey = this.storageKey(owner, e.key);
      const existing = this.journal.get(storageKey);
      const merged: JournalRecord = {
        key: e.key,
        pair: e.pair || '',
        timeframe: e.timeframe || '',
        direction: e.direction || null,
        score: e.score ?? null,
        probability: e.probability ?? null,
        entry: e.entry ?? null,
        sl: e.sl ?? null,
        tp1: e.tp1 ?? null,
        tp2: e.tp2 ?? null,
        tp3: e.tp3 ?? null,
        result: e.result || 'pending',
        rMultiple: e.rMultiple ?? null,
        exitPrice: e.exitPrice ?? null,
        timestamp: e.timestamp || Date.now(),
        closedAt: e.closedAt ?? null,
        quality: e.quality || null,
        ...existing,
        ...e,
        client: owner
      };
      // Le serveur fait foi : un client ne peut pas rouvrir / réécrire un trade déjà résolu.
      if (existing && existing.result !== 'pending') {
        merged.result = existing.result;
        merged.rMultiple = existing.rMultiple;
        merged.exitPrice = existing.exitPrice;
        merged.closedAt = existing.closedAt;
      }
      this.journal.set(storageKey, merged);
    }
    const owned = Array.from(this.journal.entries())
      .filter(([, record]) => record.client === owner)
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
    if (owned.length > MAX_JOURNAL) {
      for (const [storageKey] of owned.slice(0, owned.length - MAX_JOURNAL)) {
        this.journal.delete(storageKey);
      }
    }
    this.schedulePersist();
  }

  updateJournalResult(client: string, key: string, patch: Pick<JournalRecord, 'result' | 'rMultiple' | 'exitPrice' | 'closedAt'>) {
    const storageKey = this.storageKey(client, key);
    const r = this.journal.get(storageKey);
    if (!r || r.result !== 'pending') return false;
    this.journal.set(storageKey, { ...r, ...patch });
    this.schedulePersist();
    return true;
  }

  getPending(): JournalRecord[] {
    return Array.from(this.journal.values()).filter(r => r.result === 'pending');
  }

  getJournalEntries(client?: string, days = 3650) {
    if (!client) return [];
    const minTime = Date.now() - days * 86400000;
    const all = Array.from(this.journal.values()).filter(r => r.timestamp >= minTime);
    return all.filter(r => r.client === client);
  }
}

export const db = new BlackzeldonDB();
