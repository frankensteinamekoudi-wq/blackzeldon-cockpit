import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Header } from './components/Header.js';
import { BottomTabBar, TabId } from './components/BottomTabBar.js';
import { PairsRail } from './components/PairsRail.js';
import { FeaturedOpportunityCard } from './components/FeaturedOpportunityCard.js';
import { CandleChart } from './components/CandleChart.js';
import { RadarView } from './components/RadarView.js';
import { HistoryView } from './components/HistoryView.js';
import { HealthView } from './components/HealthView.js';
import { SettingsView } from './components/SettingsView.js';
import { QuantumEdgeCard } from './components/QuantumEdgeCard.js';
import { SniperDesk } from './components/SniperDesk.js';
import { GitExportModal } from './components/GitExportModal.js';

import { PAIRS, TF_LIST, TF_LIST_RADAR, SMT_CORRELATION, getActiveKillZone } from './lib/bz/config.js';
import { Candle } from './lib/smc/structure.js';
import { evaluateSniperOpportunity } from './lib/smc/sniper-engine.js';
import {
  qxReturns,
  qxHurst,
  qxEntropy,
  qxAutocorr,
  qxFractalDim,
  qxSqueeze,
  qxTailRisk,
  qxZScore,
  qxAbsorption,
  qxGarch,
  qxMarkov,
  qxKalman,
  qxHawkes,
  qxMonteCarlo
} from './lib/quantum/edge.js';
import { analyzeMarket } from './lib/bz/analysis.js';
import { JournalRecord } from './lib/bz/journal-types.js';
import { adminFetch } from './lib/bz/admin-client.js';

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('scanner');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Pair & Timeframe Selection
  const [selectedPairId, setSelectedPairId] = useState<string>('EURUSD');
  const [selectedTFId, setSelectedTFId] = useState<string>('5min');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Chart & Git Modals
  const [isChartModalOpen, setIsChartModalOpen] = useState<boolean>(false);
  const [isGitModalOpen, setIsGitModalOpen] = useState<boolean>(false);
  const [scannerMode, setScannerMode] = useState<'sniper' | 'standard'>('sniper');

  // Sniper $10 Account Balance
  const [sniperBalance, setSniperBalance] = useState<number>(() => {
    try {
      const v = localStorage.getItem('bz_sniper_balance');
      return v ? parseFloat(v) : 10.00;
    } catch {
      return 10.00;
    }
  });

  // Demo Account & Risk
  const [demoBalance, setDemoBalance] = useState<number>(() => {
    try {
      const v = localStorage.getItem('bz_demo_balance');
      return v ? parseFloat(v) : 10000;
    } catch {
      return 10000;
    }
  });

  const [startingBalance, setStartingBalance] = useState<number>(() => {
    try {
      const v = localStorage.getItem('bz_starting_balance');
      return v ? parseFloat(v) : 10000;
    } catch {
      return 10000;
    }
  });

  const [riskCapital, setRiskCapital] = useState<number>(() => {
    try {
      const v = localStorage.getItem('bz_risk_capital');
      return v ? parseFloat(v) : 1000;
    } catch {
      return 1000;
    }
  });

  const [riskPercent, setRiskPercent] = useState<number>(2.0);

  // Auto-Trade State
  const [autoTradeEnabled, setAutoTradeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bz_autotrade_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [autoTradeMinScore, setAutoTradeMinScore] = useState<number>(60);
  const [autoTradeMaxConcurrent, setAutoTradeMaxConcurrent] = useState<number>(3);

  // Alerts
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(false);
  const [botToken, setBotToken] = useState<string>('');
  const [chatId, setChatId] = useState<string>('');
  const [telegramStatus, setTelegramStatus] = useState<string>('');

  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(false);
  const [whatsappToken, setWhatsappToken] = useState<string>('');
  const [phoneNumberId, setPhoneNumberId] = useState<string>('');
  const [whatsappRecipient, setWhatsappRecipient] = useState<string>('');
  const [whatsappStatus, setWhatsappStatus] = useState<string>('');

  // Live Data & Cache
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loadingCandles, setLoadingCandles] = useState<boolean>(false);
  const [pairDataMap, setPairDataMap] = useState<Record<string, any>>({});
  const [tfScores, setTfScores] = useState<Record<string, any>>({});
  const [journalRecords, setJournalRecords] = useState<JournalRecord[]>(() => {
    try {
      const s = localStorage.getItem('bz_journal_records');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  // Source info
  const [sourceName, setSourceName] = useState<string>('Serveur BZ');
  const [sourceStatus, setSourceStatus] = useState<'live' | 'delayed' | 'fallback'>('fallback');
  // Métadonnées réelles renvoyées par le serveur pour la paire / l'unité de temps affichées
  const [dataMeta, setDataMeta] = useState<{ freshness: string; ageSec: number | null; note?: string; marketClosed: boolean }>({
    freshness: 'unavailable', ageSec: null, marketClosed: false
  });
  const loadReqRef = useRef(0);
  const journalRef = useRef<JournalRecord[]>([]);
  const lastAutoKeyRef = useRef<string>('');

  // Selected configurations
  const selectedPair = useMemo(() => {
    return PAIRS.find(p => p.id === selectedPairId) || PAIRS[0];
  }, [selectedPairId]);

  const selectedTF = useMemo(() => {
    return TF_LIST.find(t => t.id === selectedTFId) || TF_LIST[1];
  }, [selectedTFId]);

  const activeKZ = useMemo(() => {
    return getActiveKillZone(currentTime, selectedPair);
  }, [currentTime, selectedPair]);

  // Update clock every 2 seconds
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 2000);
    return () => clearInterval(timer);
  }, []);

  // Save demo balance
  useEffect(() => {
    try {
      localStorage.setItem('bz_demo_balance', String(demoBalance));
      localStorage.setItem('bz_starting_balance', String(startingBalance));
      localStorage.setItem('bz_risk_capital', String(riskCapital));
      localStorage.setItem('bz_sniper_balance', String(sniperBalance));
      localStorage.setItem('bz_autotrade_enabled', String(autoTradeEnabled));
      localStorage.setItem('bz_journal_records', JSON.stringify(journalRecords.slice(0, 500)));
    } catch {}
  }, [demoBalance, startingBalance, riskCapital, sniperBalance, autoTradeEnabled, journalRecords]);

  // Les signaux ne sont autorisés que sur des données RÉELLES et FRAÎCHES.
  const tradingAllowed = selectedPair.feed && dataMeta.freshness === 'live';

  // Fetch Candles for current pair & timeframe
  const loadCandles = useCallback(async () => {
    const reqId = ++loadReqRef.current;
    if (!selectedPair.feed) {
      setCandles([]);
      setSourceName('Aucun flux');
      setSourceStatus('fallback');
      setDataMeta({ freshness: 'unavailable', ageSec: null, marketClosed: false, note: `Aucun flux de données pour ${selectedPair.label}.` });
      return;
    }
    setLoadingCandles(true);
    try {
      const res = await fetch(
        `/api/public/bz/live?symbol=${encodeURIComponent(selectedPair.symbol)}&interval=${selectedTF.apiInterval}&outputsize=300`
      );
      if (reqId !== loadReqRef.current) return; // réponse périmée (paire / TF changés entre-temps)
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCandles(Array.isArray(json.candles) ? json.candles : []);
      setSourceName(json.source || '—');
      setDataMeta({ freshness: json.freshness || 'unavailable', ageSec: json.ageSec ?? null, note: json.note, marketClosed: !!json.marketClosed });
      setSourceStatus(json.freshness === 'live' ? 'live' : json.freshness === 'stale' ? 'delayed' : 'fallback');
    } catch {
      if (reqId !== loadReqRef.current) return;
      setSourceStatus('fallback');
      setDataMeta(m => ({ ...m, freshness: 'unavailable', note: 'Serveur injoignable.' }));
    } finally {
      if (reqId === loadReqRef.current) setLoadingCandles(false);
    }
  }, [selectedPair, selectedTF]);

  useEffect(() => {
    loadCandles();
    const interval = setInterval(loadCandles, 20000);
    return () => clearInterval(interval);
  }, [loadCandles]);

  // Scan de toutes les paires AVEC FLUX : vraie analyse SMC sur de vraies bougies (plus de hash du nom de la paire)
  useEffect(() => {
    let cancelled = false;
    const scanAll = async () => {
      const updatedMap: Record<string, any> = {};
      for (const p of PAIRS) {
        if (cancelled) return;
        if (!p.feed) continue;
        try {
          const res = await fetch(`/api/public/bz/live?symbol=${encodeURIComponent(p.symbol)}&interval=5min&outputsize=120`);
          if (!res.ok) continue;
          const data = await res.json();
          const cList: Candle[] = data.candles || [];
          if (cList.length < 30) continue;
          const tail = cList.slice(-25);
          const last = tail[tail.length - 1].close;
          const prev = tail[0].open;
          const a = analyzeMarket(cList, p, { atrP: 14 }, { withStats: false });
          updatedMap[p.id] = {
            price: last,
            changePct: prev > 0 ? ((last - prev) / prev) * 100 : 0,
            sparkline: tail.map(c => c.close),
            dir: a ? a.bias : last >= prev ? 'BUY' : 'SELL',
            score: a ? a.scoreTotal : undefined,
            freshness: data.freshness
          };
        } catch { /* paire ignorée ce cycle */ }
      }
      if (!cancelled) setPairDataMap(prev => ({ ...prev, ...updatedMap }));
    };
    scanAll();
    const timer = setInterval(scanAll, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Analyse SMC (moteur partagé). Sans données live : direction forcée à « PAS DE TRADE », plan retiré.
  const analysis = useMemo(() => {
    const raw = analyzeMarket(candles, selectedPair, selectedTF);
    if (!raw) return null;
    if (!tradingAllowed) return { ...raw, direction: 'PAS DE TRADE' as const, plan: null };
    return raw;
  }, [candles, selectedPair, selectedTF, tradingAllowed]);

  // Indicateurs quantitatifs. NB : ils décrivent le régime du marché, ils ne sont PAS validés comme prédicteurs.
  const quantum = useMemo(() => {
    if (!candles || candles.length < 35 || !analysis) return null;

    const rets = qxReturns(candles);
    const closes = candles.map(c => c.close);
    const hurst = qxHurst(rets);
    const entropy = qxEntropy(rets);
    qxAutocorr(rets, 1); qxFractalDim(closes); qxTailRisk(rets); qxZScore(rets); qxAbsorption(candles); qxHawkes(rets);
    const squeeze = qxSqueeze(candles);
    const garch = qxGarch(rets);
    const markov = qxMarkov(rets);
    const kalman = qxKalman(closes);

    const mc = qxMonteCarlo(candles, analysis.plan, analysis.direction, rets, 400, 50);

    const markovAligned = (markov.last > 0) === (analysis.bias === 'BUY');
    const parts = [
      { k: 'Hurst', v: Math.round(50 + Math.min(1, Math.abs(hurst.h - 0.5) / 0.2) * 40), d: `${hurst.h.toFixed(3)} • ${hurst.regime}` },
      { k: 'Entropie', v: Math.round((1 - entropy) * 100), d: `${entropy.toFixed(3)} (Ordre)` },
      { k: 'Kalman', v: Math.round(40 + kalman.conf * 55), d: `${kalman.dir} (conf ${Math.round(kalman.conf * 100)}%)` },
      { k: 'Markov', v: Math.round((markovAligned ? markov.persist : 1 - markov.persist) * 100), d: markov.note },
      { k: 'Squeeze', v: Math.round(clamp(40 + (1 - squeeze.ratio) * 100, 20, 95)), d: squeeze.state },
      { k: 'GARCH', v: Math.round(clamp(70 - (garch.ratio - 1) * 60, 20, 90)), d: garch.state }
    ];

    const avgEdge = Math.round(parts.reduce((a, b) => a + b.v, 0) / parts.length);
    const blended = mc ? analysis.probability * 0.6 + mc.pTP1 * 0.4 : analysis.probability;
    // Kelly pour un gain de 1R (TP1) : f* = 2p - 1, pris au quart et plafonné à 5 % ; 0 si l'espérance est négative.
    const kelly = Math.max(0, Math.min(0.05, 0.25 * (2 * blended - 1)));

    const verdict = avgEdge >= 78 ? 'Confluence Élite' : avgEdge >= 62 ? 'Edge Favorable' : 'Neutre';
    const color = avgEdge >= 78 ? '#22c55e' : avgEdge >= 62 ? '#22d3ee' : '#eab308';

    return { edge: avgEdge, verdict, color, blended, kelly, hurst, entropy, squeeze, kalman, markov, mc, parts };
  }, [candles, analysis]);

  // Radar : VRAIE analyse de chaque unité de temps (avant : le score du TF courant × un multiplicateur inventé)
  useEffect(() => {
    if (currentTab !== 'radar') return;
    if (!selectedPair.feed) { setTfScores({}); return; }
    let cancelled = false;
    const run = async () => {
      const next: Record<string, any> = {};
      for (const tf of TF_LIST_RADAR) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/public/bz/live?symbol=${encodeURIComponent(selectedPair.symbol)}&interval=${tf.apiInterval}&outputsize=200`);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.freshness !== 'live') continue;
          const a = analyzeMarket(data.candles || [], selectedPair, tf);
          if (!a) continue;
          const t = a.scoreTotal;
          next[tf.id] = {
            total: t,
            dir: a.direction === 'PAS DE TRADE' ? a.bias : a.direction,
            prob: Math.round(a.probability * 100),
            color: t >= 70 ? '#22c55e' : t >= 55 ? '#22d3ee' : t >= 40 ? '#eab308' : '#ef4444',
            quality: t >= 75 ? 'ÉLITE' : t >= 60 ? 'A+' : t >= 45 ? 'STANDARD' : 'FAIBLE',
            args: a.scoreItems.filter(i => i.ok).map(i => i.label)
          };
        } catch { /* TF ignoré */ }
      }
      if (!cancelled) setTfScores(next);
    };
    run();
    const timer = setInterval(run, 90000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [currentTab, selectedPair]);

  // Mode Sniper $10 (SL structurel, risque plafonné, SMT réel si paire corrélée disponible)
  const sniper = useMemo(() => {
    if (!candles || candles.length < 30) return null;
    const corrRef = SMT_CORRELATION[selectedPair.id];
    const corrSnap = corrRef ? pairDataMap[corrRef.id] : undefined;
    const correlated = selectedTF.id === '5min' && corrRef && corrSnap?.freshness === 'live' && Array.isArray(corrSnap.sparkline)
      ? { label: corrRef.label, closes: corrSnap.sparkline as number[] }
      : undefined;
    const sn = evaluateSniperOpportunity(candles, selectedPair.label, selectedPair.pip, selectedPair.digits, sniperBalance, 1.0, { correlated });
    if (tradingAllowed) return sn;
    return { ...sn, isSniperReady: false, direction: 'WAIT' as const, accountSafetyStatus: 'PROTECTED' as const };
  }, [candles, selectedPair, selectedTF, sniperBalance, pairDataMap, tradingAllowed]);

  const pushRecord = (rec: JournalRecord, client: string) => {
    setJournalRecords(prev => [rec, ...prev]);
    fetch('/api/public/bz/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client, entries: [rec] })
    }).catch(() => {});
    if ((telegramEnabled || whatsappEnabled) && rec.direction && rec.entry != null && rec.sl != null && rec.tp1 != null) {
      const risk = Math.abs(rec.entry - rec.sl);
      const payload = {
        pair: rec.pair, timeframe: rec.timeframe, direction: rec.direction, score: rec.score ?? 0, entry: rec.entry,
        sl: rec.sl, tp1: rec.tp1, tp2: rec.tp2, tp3: rec.tp3, quality: rec.quality ?? '', pipsRisk: Math.round(risk / selectedPair.pip * 10) / 10
      };
      if (telegramEnabled) adminFetch('/telegram/signal', payload).catch(() => {});
      if (whatsappEnabled) adminFetch('/whatsapp/signal', payload).catch(() => {});
    }
  };

  // Open Trade Action (Manual or Bot) — journal papier, jamais d'ordre réel
  const handleExecuteTrade = () => {
    if (!tradingAllowed || !analysis || !analysis.plan || analysis.direction === 'PAS DE TRADE') return;
    const p = analysis.plan;
    const rec: JournalRecord = {
      key: `rec_${Date.now()}`,
      client: 'mobile_cockpit',
      pair: selectedPair.label,
      timeframe: selectedTF.label,
      direction: analysis.direction,
      score: analysis.scoreTotal,
      probability: Math.round(analysis.probability * 100),
      entry: p.entryA, sl: p.sl, tp1: p.tp1, tp2: p.tp2, tp3: p.tp3,
      result: 'pending',
      rMultiple: Math.round((Math.abs(p.tp1 - p.entryA) / Math.abs(p.entryA - p.sl)) * 100) / 100,
      exitPrice: null,
      timestamp: Date.now(),
      closedAt: null,
      quality: analysis.quality
    };
    pushRecord(rec, 'mobile_cockpit');
  };

  const handleExecuteSniperTrade = () => {
    if (!tradingAllowed || !sniper || !sniper.isSniperReady || sniper.direction === 'WAIT') return;
    const rec: JournalRecord = {
      key: `rec_sniper_${Date.now()}`,
      client: 'mobile_sniper_10',
      pair: selectedPair.label,
      timeframe: selectedTF.label,
      direction: sniper.direction,
      score: sniper.score,
      probability: null, // aucune probabilité mesurée pour le mode Sniper
      entry: sniper.entryPrice, sl: sniper.slPrice, tp1: sniper.tp1Price, tp2: sniper.tp2Price, tp3: sniper.tp3Price,
      result: 'pending',
      rMultiple: sniper.rrRatio,
      exitPrice: null,
      timestamp: Date.now(),
      closedAt: null,
      quality: 'SNIPER $10'
    };
    pushRecord(rec, 'mobile_sniper_10');
  };

  useEffect(() => { journalRef.current = journalRecords; }, [journalRecords]);

  // Synchronisation avec le serveur : le serveur ferme les trades (SL/TP1 touchés), le client récupère les résultats.
  useEffect(() => {
    const sync = async () => {
      try {
        const res = await fetch('/api/public/bz/journal?days=60');
        if (!res.ok) return;
        const { entries } = await res.json();
        const byKey = new Map<string, JournalRecord>((entries || []).map((e: JournalRecord) => [e.key, e]));
        setJournalRecords(prev => {
          let changed = false;
          const next = prev.map(r => {
            const srv = byKey.get(r.key);
            if (srv && r.result === 'pending' && srv.result !== 'pending') {
              changed = true;
              return { ...r, result: srv.result, rMultiple: srv.rMultiple, exitPrice: srv.exitPrice, closedAt: srv.closedAt };
            }
            return r;
          });
          return changed ? next : prev;
        });
        // trades ouverts inconnus du serveur (redémarrage) : on les lui renvoie
        const missing = journalRef.current.filter(r => r.result === 'pending' && !byKey.has(r.key)).slice(0, 50);
        if (missing.length) {
          await fetch('/api/public/bz/journal', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client: 'mobile_cockpit', entries: missing })
          });
        }
      } catch { /* hors ligne */ }
    };
    sync();
    const t = setInterval(sync, 30000);
    return () => clearInterval(t);
  }, []);

  // Bot auto-trade (papier) : uniquement sur données live, avec edge empirique non négatif et garde-fou de perte journalière.
  useEffect(() => {
    if (!autoTradeEnabled || !tradingAllowed || !analysis || !analysis.plan || analysis.direction === 'PAS DE TRADE') return;
    if (analysis.scoreTotal < autoTradeMinScore) return;
    if (analysis.stats.samples < 10 || analysis.probability < 0.5) return;

    const pendingCount = journalRecords.filter(r => r.result === 'pending').length;
    if (pendingCount >= autoTradeMaxConcurrent) return;
    if (journalRecords.some(r => r.pair === selectedPair.label && r.result === 'pending')) return;

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const todayR = journalRecords
      .filter(r => (r.result === 'win' || r.result === 'loss') && (r.closedAt ?? 0) >= startOfDay.getTime())
      .reduce((s, r) => s + (r.rMultiple ?? (r.result === 'win' ? 1 : -1)), 0);
    if (todayR <= -3) return; // stop après -3R sur la journée

    const lastTime = candles.length ? String(candles[candles.length - 1].time) : '';
    const key = `${selectedPair.id}|${selectedTF.id}|${analysis.direction}|${lastTime}`;
    if (lastAutoKeyRef.current === key) return; // une seule tentative par bougie
    lastAutoKeyRef.current = key;
    handleExecuteTrade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTradeEnabled, analysis, autoTradeMinScore, autoTradeMaxConcurrent, tradingAllowed, journalRecords, candles]);

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col max-w-lg mx-auto relative shadow-2xl">
      {/* 1. Header FIn */}
      <Header
        sourceName={sourceName}
        sourceStatus={sourceStatus}
        activeKZ={activeKZ}
        currentTime={currentTime}
        onOpenGitExport={() => setIsGitModalOpen(true)}
      />

      {/* Main Content Body */}
      <main className="flex-1 px-3 py-2 space-y-3 pb-24 overflow-y-auto no-scrollbar">
        {/* Horizontal Pairs Rail with mini-sparklines */}
        <PairsRail
          pairs={PAIRS}
          selectedPairId={selectedPairId}
          onSelectPair={setSelectedPairId}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          pairDataMap={pairDataMap}
        />

        {/* Bandeau d'état des données : pas de signal sans données réelles et fraîches */}
        {!tradingAllowed && (
          <div className="px-3 py-2 rounded-xl border border-rose-500/40 bg-rose-950/30 text-[11px] font-mono text-rose-200 leading-snug">
            ⛔ Signaux désactivés —{' '}
            {!selectedPair.feed
              ? `aucun flux de données pour ${selectedPair.label} (indice synthétique non connecté).`
              : dataMeta.freshness === 'stale'
              ? `données périmées${dataMeta.marketClosed ? ' (marché fermé)' : ''}${dataMeta.ageSec != null ? `, dernière bougie il y a ${Math.round(dataMeta.ageSec / 60)} min` : ''}.`
              : `données indisponibles. ${dataMeta.note || ''}`}
          </div>
        )}

        {/* Tab 1: SCANNER */}
        {currentTab === 'scanner' && (
          <div className="space-y-3">
            {/* Mode Switcher: Sniper $10 vs Institutionnel */}
            <div className="flex p-1 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-[11px]">
              <button
                onClick={() => setScannerMode('sniper')}
                className={`flex-1 py-1.5 rounded-lg font-black tracking-tight transition-all flex items-center justify-center gap-1.5 ${
                  scannerMode === 'sniper'
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 text-black shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>⚡ Mode Sniper Défi $10</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-black/30 rounded font-bold">ANTI-CRAMAGE</span>
              </button>

              <button
                onClick={() => setScannerMode('standard')}
                className={`flex-1 py-1.5 rounded-lg font-bold tracking-tight transition-all flex items-center justify-center gap-1.5 ${
                  scannerMode === 'standard'
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🏛️ Vue Institutionnelle</span>
              </button>
            </div>

            {/* 1. COMPARTIMENT ULTRA-PRÉCIS SNIPER $10 */}
            {scannerMode === 'sniper' && sniper && (
              <SniperDesk
                sniper={sniper}
                pair={selectedPair}
                timeframe={selectedTF.label}
                onOpenChart={() => setIsChartModalOpen(true)}
                onExecuteTrade={handleExecuteSniperTrade}
                accountBalance={sniperBalance}
                onChangeBalance={setSniperBalance}
              />
            )}

            {/* 2. Featured Opportunity Card */}
            {analysis ? (
              <FeaturedOpportunityCard
                pair={selectedPair}
                timeframe={selectedTF.label}
                direction={analysis.direction}
                scoreTotal={analysis.scoreTotal}
                probability={analysis.probability}
                probabilityNote={`empirique · n=${analysis.stats.samples}`}
                quality={analysis.quality}
                plan={analysis.plan}
                scoreItems={analysis.scoreItems}
                configuredCapital={scannerMode === 'sniper' ? sniperBalance : riskCapital}
                riskPercent={scannerMode === 'sniper' ? 5.0 : analysis.dynamicRisk}
                pipValue={selectedPair.type === 'fx' ? 10 : 1}
                onOpenChart={() => setIsChartModalOpen(true)}
                onExecuteTrade={handleExecuteTrade}
                isVerifiable={true}
              />
            ) : (
              <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center skeleton-shimmer space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto" />
                <p className="text-[12px] font-mono text-slate-400">Analyse SMC en cours…</p>
              </div>
            )}

            {/* 3. Embedded Candlestick Chart with interactive timeframes */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                <span className="font-extrabold uppercase tracking-wider text-slate-300">
                  Graphique &amp; Niveaux d'Exécution ({selectedPair.label})
                </span>
                <span className="font-mono text-cyan-400 font-bold">Tick Live + TP1/TP2/TP3</span>
              </div>
              <CandleChart
                candles={candles}
                plan={analysis?.plan || null}
                direction={analysis?.direction || 'PAS DE TRADE'}
                pairLabel={selectedPair.label}
                timeframe={selectedTF.label}
                digits={selectedPair.digits}
                pipSize={selectedPair.pip}
                zones={analysis?.chartZones || []}
                onSelectTimeframe={(tfId) => setSelectedTFId(tfId)}
              />
            </div>

            {/* 4. Statistical Quantum Edge Card */}
            <QuantumEdgeCard quantum={quantum} />
          </div>
        )}

        {/* Tab 2: RADAR */}
        {currentTab === 'radar' && (
          <RadarView
            pair={selectedPair}
            tfScores={tfScores}
            selectedTF={selectedTFId}
            onSelectTF={setSelectedTFId}
          />
        )}

        {/* Tab 3: HISTORIQUE */}
        {currentTab === 'historique' && (
          <HistoryView
            records={journalRecords}
            onClearHistory={() => setJournalRecords([])}
          />
        )}

        {/* Tab 4: SANTÉ */}
        {currentTab === 'sante' && (
          <HealthView />
        )}

        {/* Tab 5: RÉGLAGES & SIMULATION */}
        {currentTab === 'reglages' && (
          <SettingsView
            demoBalance={demoBalance}
            startingBalance={startingBalance}
            onResetDemo={(newBal) => setDemoBalance(newBal || 10000)}
            autoTradeEnabled={autoTradeEnabled}
            onToggleAutoTrade={setAutoTradeEnabled}
            autoTradeMinScore={autoTradeMinScore}
            onChangeMinScore={setAutoTradeMinScore}
            autoTradeMaxConcurrent={autoTradeMaxConcurrent}
            onChangeMaxConcurrent={setAutoTradeMaxConcurrent}
            riskCapital={riskCapital}
            onChangeCapital={setRiskCapital}
            riskPercent={riskPercent}
            onChangeRiskPercent={setRiskPercent}
            telegramEnabled={telegramEnabled}
            onToggleTelegram={setTelegramEnabled}
            botToken={botToken}
            onChangeBotToken={setBotToken}
            chatId={chatId}
            onChangeChatId={setChatId}
            onTestTelegram={async () => {
              setTelegramStatus('Envoi en cours…');
              const saved = await adminFetch('/keys/save', { telegramBotToken: botToken, telegramChatId: chatId });
              if (!saved.ok) { setTelegramStatus(`❌ ${saved.data?.error || 'Accès admin refusé'}`); return; }
              const r = await adminFetch('/telegram/test');
              setTelegramStatus(r.ok ? '✅ Message de test envoyé' : `❌ ${r.data?.error || 'Échec de l’envoi'}`);
            }}
            telegramStatus={telegramStatus}
            whatsappEnabled={whatsappEnabled}
            onToggleWhatsapp={setWhatsappEnabled}
            whatsappToken={whatsappToken}
            onChangeWhatsappToken={setWhatsappToken}
            phoneNumberId={phoneNumberId}
            onChangePhoneNumberId={setPhoneNumberId}
            whatsappRecipient={whatsappRecipient}
            onChangeWhatsappRecipient={setWhatsappRecipient}
            onTestWhatsapp={async () => {
              setWhatsappStatus('Envoi en cours…');
              const saved = await adminFetch('/keys/save', { whatsappToken, whatsappPhoneNumberId: phoneNumberId, whatsappRecipient });
              if (!saved.ok) { setWhatsappStatus(`❌ ${saved.data?.error || 'Accès admin refusé'}`); return; }
              const r = await adminFetch('/whatsapp/test');
              setWhatsappStatus(r.ok ? '✅ Message de test envoyé' : `❌ ${r.data?.error || 'Échec de l’envoi'}`);
            }}
            whatsappStatus={whatsappStatus}
          />
        )}
      </main>

      {/* Fullscreen Chart Modal */}
      {isChartModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md p-3 flex flex-col justify-center max-w-lg mx-auto">
          <CandleChart
            candles={candles}
            plan={analysis?.plan || null}
            direction={analysis?.direction || 'PAS DE TRADE'}
            pairLabel={selectedPair.label}
            timeframe={selectedTF.label}
            digits={selectedPair.digits}
            pipSize={selectedPair.pip}
            zones={analysis?.chartZones || []}
            isModal={true}
            onCloseModal={() => setIsChartModalOpen(false)}
          />
        </div>
      )}

      {/* 2. Fixed Bottom Tab Bar */}
      <BottomTabBar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        openTradesCount={journalRecords.filter(r => r.result === 'pending').length}
        strongSignalsCount={analysis && analysis.direction !== 'PAS DE TRADE' && analysis.scoreTotal >= 65 ? 1 : 0}
      />

      {/* 3. Git Export & Repository Modal */}
      <GitExportModal
        isOpen={isGitModalOpen}
        onClose={() => setIsGitModalOpen(false)}
      />
    </div>
  );
}
