import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, CheckCircle2, XCircle, LineChart, AlertTriangle, ShieldCheck } from 'lucide-react';
import { TradePlan } from '../lib/bz/trade-plan.js';
import { ScoreItem } from '../lib/bz/scoring.js';
import { PairConfig } from '../lib/bz/config.js';

interface FeaturedOpportunityProps {
  pair: PairConfig;
  timeframe: string;
  direction: 'BUY' | 'SELL' | 'PAS DE TRADE';
  scoreTotal: number;
  probability: number;
  probabilityNote?: string;
  quality: string;
  plan: TradePlan | null;
  scoreItems: ScoreItem[];
  configuredCapital: number;
  riskPercent: number;
  pipValue?: number;
  onOpenChart: () => void;
  onExecuteTrade?: () => void;
  isVerifiable?: boolean;
}

export const FeaturedOpportunityCard: React.FC<FeaturedOpportunityProps> = ({
  pair,
  timeframe,
  direction,
  scoreTotal,
  probability,
  probabilityNote,
  quality,
  plan,
  scoreItems,
  configuredCapital,
  riskPercent,
  pipValue = 10,
  onOpenChart,
  onExecuteTrade,
  isVerifiable = true
}) => {
  const isBuy = direction === 'BUY';
  const isTrade = direction !== 'PAS DE TRADE' && plan !== null;

  // Calcul du risque en dollars ($) et calcul des distances en pips
  const riskAmount = (configuredCapital * (riskPercent / 100));
  const slPips = plan ? plan.riskPips : 0;
  const tp1Pips = plan ? plan.tp1Pips : 0;
  const tp2Pips = plan ? plan.tp2Pips : 0;
  const tp3Pips = plan ? plan.tp3Pips : 0;

  // Estimation du lot standard
  const estimatedLot = slPips > 0 && pipValue > 0 ? (riskAmount / (slPips * pipValue)) : 0.01;
  const finalLot = Math.max(0.01, Math.floor(estimatedLot * 100) / 100);
  const actualLossDollars = finalLot * slPips * pipValue;
  const tp1GainDollars = finalLot * tp1Pips * pipValue;
  const tp2GainDollars = finalLot * tp2Pips * pipValue;
  const tp3GainDollars = finalLot * tp3Pips * pipValue;

  // Score Ring calculation (radius 30, circumference 2 * PI * 30 = 188.5)
  const radius = 30;
  const circ = 2 * Math.PI * radius;
  const strokeOffset = circ - (scoreTotal / 100) * circ;

  const scoreColor = scoreTotal >= 75 ? '#22c55e' : scoreTotal >= 60 ? '#22d3ee' : scoreTotal >= 45 ? '#eab308' : '#ef4444';

  const confirmedCount = scoreItems.filter(it => it.ok).length;
  const totalItemsCount = scoreItems.length || 1;

  return (
    <div className={`relative overflow-hidden rounded-2xl border transition-all ${
      isTrade
        ? isBuy
          ? 'bg-gradient-to-br from-emerald-950/30 via-slate-900/90 to-[#070a12] border-emerald-500/40 shadow-[0_4px_24px_rgba(34,197,94,0.15)]'
          : 'bg-gradient-to-br from-rose-950/30 via-slate-900/90 to-[#070a12] border-rose-500/40 shadow-[0_4px_24px_rgba(239,68,68,0.15)]'
        : 'bg-slate-900/80 border-slate-800'
    } p-3.5 space-y-3`}>
      {/* Top Header: Badge Opportunité Vedette + Verification Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 pulse-live" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300">
            Meilleure Opportunité
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-[10.5px] font-bold text-slate-300 font-mono">
            {pair.label} ({timeframe})
          </span>
        </div>

        {/* Badge Vérifiable / Non Vérifiable */}
        <div className="flex items-center">
          {isVerifiable ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-2.5 h-2.5" />
              Vérifiable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <AlertTriangle className="w-2.5 h-2.5" />
              Non vérifiable
            </span>
          )}
        </div>
      </div>

      {/* Hero Core: Big BUY/SELL typography + Circular Score Ring */}
      <div className="flex items-center justify-between gap-3 pt-1">
        {/* Left: Direction */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {isTrade ? (
              isBuy ? (
                <div className="flex items-center gap-1.5">
                  <ArrowUpCircle className="w-7 h-7 text-emerald-400" />
                  <span className="text-3xl font-black tracking-tight text-emerald-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.4)]">
                    BUY
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <ArrowDownCircle className="w-7 h-7 text-rose-400" />
                  <span className="text-3xl font-black tracking-tight text-rose-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.4)]">
                    SELL
                  </span>
                </div>
              )
            ) : (
              <span className="text-2xl font-black tracking-tight text-slate-400">
                ATTENTE
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Prob. : <b className="text-white font-mono">{Math.round(probability * 100)}%</b>{probabilityNote && <span className="text-slate-500 ml-1">({probabilityNote})</span>}</span>
            <span>•</span>
            <span>Qualité : <b className="text-cyan-300">{quality}</b></span>
          </div>
        </div>

        {/* Right: Score Ring SVG */}
        <div className="relative flex items-center justify-center w-16 h-16 flex-shrink-0">
          <svg className="w-16 h-16 transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="5"
              fill="transparent"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke={scoreColor}
              strokeWidth="5"
              strokeDasharray={circ}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
              style={{ filter: `drop-shadow(0 0 6px ${scoreColor}88)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[17px] font-black font-mono leading-none" style={{ color: scoreColor }}>
              {scoreTotal}
            </span>
            <span className="text-[7.5px] font-bold text-slate-400 tracking-wider">
              SCORE
            </span>
          </div>
        </div>
      </div>

      {/* Trade Execution Plan: Entry, SL, TP1, TP2, TP3 with pip distances & dollar amounts */}
      {isTrade && plan && (
        <div className="space-y-1.5 font-mono">
          {/* Row 1: Entrée & Stop Loss */}
          <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-black/50 border border-white/5">
            <div className="flex flex-col">
              <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">ENTRÉE</span>
              <span className="text-[13px] font-extrabold text-cyan-300 truncate">
                {plan.entryA.toFixed(pair.digits)}
              </span>
              <span className="text-[8.5px] text-slate-400">Lot: {finalLot}</span>
            </div>

            <div className="flex flex-col text-right">
              <span className="text-[8.5px] font-bold text-rose-400 uppercase tracking-wider">STOP LOSS</span>
              <span className="text-[13px] font-extrabold text-rose-400 truncate">
                {plan.sl.toFixed(pair.digits)}
              </span>
              <span className="text-[8.5px] text-rose-300">
                -{slPips.toFixed(1)}p (-${actualLossDollars.toFixed(2)})
              </span>
            </div>
          </div>

          {/* Row 2: TP1, TP2, TP3 Multi-Target Grid */}
          <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-black/40 border border-white/5 text-center">
            {/* TP1 */}
            <div className="flex flex-col py-0.5 px-1 bg-emerald-950/20 rounded border border-emerald-500/20">
              <span className="text-[8px] font-bold text-emerald-400">TP1 (1:1.5)</span>
              <span className="text-[11px] font-extrabold text-emerald-300 truncate">
                {plan.tp1.toFixed(pair.digits)}
              </span>
              <span className="text-[8px] text-emerald-400/90">
                +{tp1Pips.toFixed(1)}p (+${tp1GainDollars.toFixed(2)})
              </span>
            </div>

            {/* TP2 */}
            <div className="flex flex-col py-0.5 px-1 bg-emerald-950/20 rounded border border-emerald-500/20">
              <span className="text-[8px] font-bold text-emerald-400">TP2 (1:2.5)</span>
              <span className="text-[11px] font-extrabold text-emerald-300 truncate">
                {plan.tp2.toFixed(pair.digits)}
              </span>
              <span className="text-[8px] text-emerald-400/90">
                +{tp2Pips.toFixed(1)}p (+${tp2GainDollars.toFixed(2)})
              </span>
            </div>

            {/* TP3 */}
            <div className="flex flex-col py-0.5 px-1 bg-cyan-950/20 rounded border border-cyan-500/20">
              <span className="text-[8px] font-bold text-cyan-300">TP3 (1:4.0)</span>
              <span className="text-[11px] font-extrabold text-cyan-200 truncate">
                {plan.tp3.toFixed(pair.digits)}
              </span>
              <span className="text-[8px] text-cyan-300/90">
                +{tp3Pips.toFixed(1)}p (+${tp3GainDollars.toFixed(2)})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible / Micro Confirmation Checklist */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span className="font-semibold uppercase tracking-wider">Liste de confirmation</span>
          <span className="font-mono text-cyan-300 font-bold">{confirmedCount}/{totalItemsCount} validés</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {scoreItems.slice(0, 6).map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] border ${
                item.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400'
              }`}
            >
              {item.ok ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-3 h-3 text-slate-500 flex-shrink-0" />
              )}
              <span className="font-medium truncate">{item.label}</span>
              <span className="ml-auto font-mono text-[9px] opacity-80">+{item.pts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions: Voir sur graphique + Exécuter */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onOpenChart}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-600/20 hover:from-cyan-500/30 hover:to-purple-600/30 border border-cyan-400/40 text-cyan-300 font-bold text-[12px] shadow-[0_0_12px_rgba(34,211,238,0.2)] active:scale-95 transition-all"
        >
          <LineChart className="w-4 h-4 text-cyan-300" />
          <span>Voir sur graphique</span>
        </button>

        {isTrade && onExecuteTrade && (
          <button
            onClick={onExecuteTrade}
            className={`py-2 px-4 rounded-xl font-bold text-[12px] text-black active:scale-95 transition-all shadow-md ${
              isBuy
                ? 'bg-emerald-400 hover:bg-emerald-300'
                : 'bg-rose-400 hover:bg-rose-300'
            }`}
          >
            {isBuy ? 'Ouvrir BUY' : 'Ouvrir SELL'}
          </button>
        )}
      </div>
    </div>
  );
};
