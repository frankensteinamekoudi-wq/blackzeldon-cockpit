import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleLive } from './src/routes/api/public/bz/live.js';
import { handleCandles } from './src/routes/api/public/bz/candles.js';
import { handleState } from './src/routes/api/public/bz/state.js';
import { handleNews } from './src/routes/api/public/bz/news.js';
import { handleNewsPoll } from './src/routes/api/public/bz/news-poll.js';
import { handleForecast } from './src/routes/api/public/bz/forecast.js';
import { handleGetJournal, handlePostJournal } from './src/routes/api/public/bz/journal.js';
import { handleCycle } from './src/routes/api/public/bz/cycle.js';
import { getKeysPublicStatus, setApiKeys } from './src/lib/bz/keystore.server.js';
import { testGitHubToken, createAndPushToGitHub } from './src/lib/bz/github.server.js';
import { rateLimitMiddleware, requireAdmin, purgeIdleBuckets } from './src/lib/bz/access-control.server.js';
import { sendTelegramText, sendTelegramSignal } from './src/lib/bz/telegram.server.js';
import { sendWhatsAppText } from './src/lib/bz/whatsapp.server.js';
import { startJournalResolver } from './src/lib/bz/journal-resolver.server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/', rateLimitMiddleware);
  setInterval(() => purgeIdleBuckets(), 5 * 60 * 1000).unref();

  // ── Routes publiques (lecture de marché, journal) ──
  app.get('/api/public/bz/live', handleLive);
  app.get('/api/public/bz/candles', handleCandles);
  app.get('/api/public/bz/state', handleState);
  app.get('/api/public/bz/news', handleNews);
  app.get('/api/public/bz/news-poll', handleNewsPoll);
  app.get('/api/public/bz/forecast', handleForecast);
  app.get('/api/public/bz/journal', handleGetJournal);
  app.post('/api/public/bz/journal', handlePostJournal);
  app.get('/api/public/bz/cycle', handleCycle);

  // ── Routes protégées (ADMIN_TOKEN, ou loopback si non défini) ──
  app.get('/api/public/bz/keys/status', requireAdmin, (_req, res) => {
    res.json(getKeysPublicStatus());
  });

  app.post('/api/public/bz/keys/save', requireAdmin, (req, res) => {
    try {
      const b = req.body || {};
      setApiKeys({
        twelveDataApiKey: b.twelveDataApiKey, finnhubApiKey: b.finnhubApiKey, githubToken: b.githubToken,
        telegramBotToken: b.telegramBotToken, telegramChatId: b.telegramChatId,
        whatsappToken: b.whatsappToken, whatsappPhoneNumberId: b.whatsappPhoneNumberId, whatsappRecipient: b.whatsappRecipient
      });
      res.json({ success: true, status: getKeysPublicStatus() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/public/bz/telegram/test', requireAdmin, async (_req, res) => {
    const r = await sendTelegramText('✅ Test Blackzeldon : la connexion Telegram fonctionne.');
    res.status(r.success ? 200 : 502).json(r);
  });

  app.post('/api/public/bz/telegram/signal', requireAdmin, async (req, res) => {
    const b = req.body || {};
    const ok = ['pair', 'timeframe', 'direction', 'entry', 'sl', 'tp1'].every(k => b[k] !== undefined);
    if (!ok) return res.status(400).json({ success: false, error: 'Signal incomplet.' });
    const r = await sendTelegramSignal({
      pair: String(b.pair), timeframe: String(b.timeframe), direction: b.direction === 'SELL' ? 'SELL' : 'BUY',
      score: Number(b.score) || 0, entry: Number(b.entry), sl: Number(b.sl), tp1: Number(b.tp1),
      tp2: Number(b.tp2), tp3: Number(b.tp3), quality: String(b.quality || ''), pipsRisk: Number(b.pipsRisk) || 0
    });
    res.status(r.success ? 200 : 502).json(r);
  });

  app.post('/api/public/bz/whatsapp/signal', requireAdmin, async (req, res) => {
    const b = req.body || {};
    if (!b.pair || !b.direction || b.entry === undefined) return res.status(400).json({ success: false, error: 'Signal incomplet.' });
    const text = `BLACKZELDON (papier)\n${b.direction === 'SELL' ? 'VENTE' : 'ACHAT'} ${b.pair} ${b.timeframe || ''}\nEntrée ${b.entry}\nSL ${b.sl}\nTP1 ${b.tp1} | TP2 ${b.tp2} | TP3 ${b.tp3}\nQualité ${b.quality || ''} (score ${b.score || 0}/100)`;
    const r = await sendWhatsAppText(text);
    res.status(r.success ? 200 : 502).json(r);
  });

  app.post('/api/public/bz/whatsapp/test', requireAdmin, async (_req, res) => {
    const r = await sendWhatsAppText('✅ Test Blackzeldon : la connexion WhatsApp fonctionne.');
    res.status(r.success ? 200 : 502).json(r);
  });

  app.post('/api/public/bz/github/test', requireAdmin, async (req, res) => {
    try {
      res.json(await testGitHubToken(req.body?.token));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/public/bz/github/push', requireAdmin, async (req, res) => {
    try {
      const { repoName, isPrivate, token } = req.body || {};
      res.json(await createAndPushToGitHub(repoName, isPrivate !== false, token));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Front ──
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  startJournalResolver();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Blackzeldon Server] http://0.0.0.0:${PORT}`);
    if (!process.env.ADMIN_TOKEN) {
      console.warn('[Sécurité] ADMIN_TOKEN non défini : routes admin accessibles uniquement depuis la machine locale.');
    }
  });
}

startServer().catch(err => {
  console.error('[Blackzeldon Server Error]', err);
  process.exit(1);
});
