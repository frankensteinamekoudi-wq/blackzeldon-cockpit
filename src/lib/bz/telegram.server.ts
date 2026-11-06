/**
 * Envoi de notifications Telegram (côté serveur : le token n'est jamais renvoyé au navigateur).
 */
import { bzFetch } from './http.server.js';
import { getSecretKey } from './keystore.server.js';

export interface SignalPayload {
  pair: string;
  timeframe: string;
  direction: 'BUY' | 'SELL';
  score: number;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  quality: string;
  pipsRisk: number;
}

const esc = (s: unknown) => String(s).replace(/[&<>]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

export function formatSignalHtml(s: SignalPayload): string {
  const icon = s.direction === 'BUY' ? '🟢 <b>ACHAT (BUY)</b>' : '🔴 <b>VENTE (SELL)</b>';
  return [
    '⚡ <b>BLACKZELDON — signal (papier)</b>',
    icon,
    '',
    `<b>Paire :</b> <code>${esc(s.pair)}</code> · <code>${esc(s.timeframe)}</code>`,
    `<b>Qualité :</b> ${esc(s.quality)} (score ${esc(s.score)}/100)`,
    `<b>Entrée :</b> <code>${esc(s.entry)}</code>`,
    `<b>SL :</b> <code>${esc(s.sl)}</code> (${esc(s.pipsRisk)} pips)`,
    `<b>TP1 (1R) :</b> <code>${esc(s.tp1)}</code>`,
    `<b>TP2 (2R) :</b> <code>${esc(s.tp2)}</code>`,
    `<b>TP3 (3R) :</b> <code>${esc(s.tp3)}</code>`,
    '',
    '<i>Information, pas un conseil financier.</i>'
  ].join('\n');
}

export async function sendTelegramText(text: string, botToken?: string, chatId?: string): Promise<{ success: boolean; error?: string }> {
  const token = botToken || getSecretKey('telegramBotToken');
  const chat = chatId || getSecretKey('telegramChatId');
  if (!token || !chat) return { success: false, error: 'Token ou Chat ID Telegram manquant.' };
  try {
    const res = await bzFetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      timeoutMs: 6000,
      retries: 0
    });
    if (!res.ok) return { success: false, error: `Telegram HTTP ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur réseau Telegram' };
  }
}

export async function sendTelegramSignal(signal: SignalPayload) {
  return sendTelegramText(formatSignalHtml(signal));
}
