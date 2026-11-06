import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Crosshair, Target, Zap, TrendingUp, TrendingDown, Layers, Clock, AlertCircle } from 'lucide-react';
import { SniperSetup } from '../lib/smc/sniper-engine.js';
import { PairConfig } from '../lib/bz/config.js';

interface SniperDeskProps {
  sniper: SniperSetup;
  pair: PairConfig;
  timeframe: string;
  onOpenChart: () => void;
  onExecuteTrade: () => void;
  accountBalance: number;
  onChangeBalance: (b: number) => void;
}

export const SniperDesk: React.FC<SniperDeskProps> = ({
  sniper,
  pair,
  timeframe,
  onOpenChart,
  onExecuteTrade,
  accountBalance,
  onChangeBalance
}) => {
  const [showIctDetails, setShowIctDetails] = useState(false);

  const isBuy = sniper.direction === 'BUY';
  const isReady = sniper.isSniperReady;

  // Stages of $10 compound journey
  const stages = [
    { target: 25, label: 'Étape 1', desc: '$10 ➔ $25 (+150%)' },
    { target: 65, label: 'Étape 2', desc: '$25 ➔ $65' },
    { target: 160, label: 'Étape 3', desc: '$65 ➔ $160' },
    { target: 400, label: 'Étape 4', desc: '$160 ➔ $400' },
    { target: 1000, label: 'Étape 5', desc: '$400 ➔ $1,000+' }
  ];

  const currentStage = stages.find(s => accountBalance < s.target) || stages[stages.length - 1];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-[#0c1424] via-[#070b14] to-[#04060a] p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-3">
      {/* Top Banner: Sniper $10 Account Shield */}
      <div className="flex items-center justify-between gap-2 border-b border-cyan-500/15 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-emerald-400 text-black shadow-[0_0_12px_rgba(34,211,238,0.4)] font-black">
            <Crosshair className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-black tracking-tight text-white uppercase">
                Mode Sniper Défi $10
              </span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 font-mono text-[9px] font-bold border border-cyan-500/30">
                0.01 LOT STRICT
              </span>
            </div>
            <p className="text-[9.5px] text-slate-400">
              Protection anti-cramage • SL chirurgical (3-8 pips) • Théories ICT
            </p>
          </div>
        </div>

        {/* Compound Stage Badge */}
        <div className="text-right font-mono">
          <div className="text-[11px] font-bold text-emerald-400">
            ${accountBalance.toFixed(2)}
          </div>
          <div className="text-[8px] font-semibold text-slate-500 uppercase">
            Objectif: ${currentStage.target}
          </div>
        </div>
      </div>

      {/* Safety Gatekeeper Status */}
      {isReady ? (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 animate-pulse" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-wide text-emerald-200">
                ⚡ SETUP SNIPER CONFIRMÉ ({sniper.direction} {pair.label})
              </div>
              <div className="text-[9.5px] text-emerald-400/90 font-mono">
                SL ultra-serré : -{sniper.riskPips} pips (Risque : -${sniper.capitalRiskDollars} sur $10)
              </div>
            </div>
          </div>
          <span className="font-mono text-xs font-black bg-emerald-500/20 px-2 py-1 rounded-md text-emerald-300 border border-emerald-500/40">
            Score {sniper.score}/100
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/35 text-amber-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-[11px] font-black uppercase tracking-wide text-amber-200">
                🛡️ BOUCLIER CAPITAL $10 : ATTENTE DU SIGNAL PARFAIT
              </div>
              <div className="text-[9.5px] text-amber-400/80">
                Conditions de sécurité non réunies. Pas de prise de trade pour éviter le cramage.
              </div>
            </div>
          </div>
          <span className="font-mono text-[10px] font-bold bg-amber-500/15 px-2 py-0.5 rounded text-amber-300">
            {sniper.confluences.filter(c => c.met).length}/6 validés
          </span>
        </div>
      )}

      {/* Execution Levels: ENTRÉE, SL, TP1, TP2, TP3 */}
      <div className="grid grid-cols-5 gap-1.5 p-2 rounded-xl bg-black/50 border border-white/5 font-mono text-center">
        {/* Entrée */}
        <div className="flex flex-col py-1 px-1 bg-cyan-950/20 rounded-lg border border-cyan-500/20">
          <span className="text-[8px] font-bold text-cyan-400 uppercase">Entrée</span>
          <span className="text-[11px] font-extrabold text-cyan-200 truncate">
            {sniper.entryPrice.toFixed(pair.digits)}
          </span>
          <span className="text-[8px] text-slate-400">Marché</span>
        </div>

        {/* Stop Loss */}
        <div className="flex flex-col py-1 px-1 bg-rose-950/20 rounded-lg border border-rose-500/20">
          <span className="text-[8px] font-bold text-rose-400 uppercase">Stop Loss</span>
          <span className="text-[11px] font-extrabold text-rose-300 truncate">
            {sniper.slPrice.toFixed(pair.digits)}
          </span>
          <span className="text-[8px] text-rose-400">-${sniper.capitalRiskDollars}</span>
        </div>

        {/* TP1 */}
        <div className="flex flex-col py-1 px-1 bg-emerald-950/20 rounded-lg border border-emerald-500/20">
          <span className="text-[8px] font-bold text-emerald-400 uppercase">TP1 (1:2.2)</span>
          <span className="text-[11px] font-extrabold text-emerald-300 truncate">
            {sniper.tp1Price.toFixed(pair.digits)}
          </span>
          <span className="text-[8px] text-emerald-400">+${sniper.capitalGainTP1}</span>
        </div>

        {/* TP2 */}
        <div className="flex flex-col py-1 px-1 bg-emerald-950/20 rounded-lg border border-emerald-500/20">
          <span className="text-[8px] font-bold text-emerald-400 uppercase">TP2 (1:4)</span>
          <span className="text-[11px] font-extrabold text-emerald-300 truncate">
            {sniper.tp2Price.toFixed(pair.digits)}
          </span>
          <span className="text-[8px] text-emerald-400">+${sniper.capitalGainTP2}</span>
        </div>

        {/* TP3 */}
        <div className="flex flex-col py-1 px-1 bg-emerald-950/20 rounded-lg border border-emerald-500/20">
          <span className="text-[8px] font-bold text-emerald-300 uppercase">TP3 (1:6.5)</span>
          <span className="text-[11px] font-extrabold text-emerald-200 truncate">
            {sniper.tp3Price.toFixed(pair.digits)}
          </span>
          <span className="text-[8px] text-emerald-300">+${sniper.capitalGainTP3}</span>
        </div>
      </div>

      {/* ICT Confluence Indicators (Judas Swing, AMD, SMT, Silver Bullet) */}
      <div className="space-y-1.5 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-cyan-400" />
            Confluences Algorithmiques ICT
          </span>
          <button
            onClick={() => setShowIctDetails(!showIctDetails)}
            className="text-[9.5px] font-bold text-cyan-400 hover:text-cyan-300"
          >
            {showIctDetails ? 'Masquer détails' : 'Voir théories cachées ▼'}
          </button>
        </div>

        {/* AMD Cycle Status */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9.5px]">
            <span className="text-slate-400 font-mono">Cycle AMD :</span>
            <span className={`font-bold font-mono ${
              sniper.amd.phase === 'MANIPULATION' ? 'text-amber-400' :
              sniper.amd.phase === 'DISTRIBUTION' ? 'text-emerald-400' : 'text-cyan-400'
            }`}>
              {sniper.amd.phase} ({sniper.amd.progress}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                sniper.amd.phase === 'MANIPULATION' ? 'bg-amber-400' :
                sniper.amd.phase === 'DISTRIBUTION' ? 'bg-emerald-400' : 'bg-cyan-400'
              }`}
              style={{ width: `${sniper.amd.progress}%` }}
            />
          </div>
        </div>

        {/* Quick Badges: Judas Swing, SMT, Silver Bullet */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <div className={`p-1.5 rounded-lg border text-center ${
            sniper.judasSwing.detected
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-500'
          }`}>
            <div className="text-[8px] font-bold uppercase">Judas Swing</div>
            <div className="text-[9.5px] font-extrabold truncate">
              {sniper.judasSwing.detected ? '✓ Validé' : 'En attente'}
            </div>
          </div>

          <div className={`p-1.5 rounded-lg border text-center ${
            sniper.smtDivergence.detected
              ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-500'
          }`}>
            <div className="text-[8px] font-bold uppercase">Divergence SMT</div>
            <div className="text-[9.5px] font-extrabold truncate">
              {sniper.smtDivergence.detected ? '✓ Détectée' : 'Neutre'}
            </div>
          </div>

          <div className={`p-1.5 rounded-lg border text-center ${
            sniper.silverBullet.isActive
              ? 'bg-purple-950/30 border-purple-500/40 text-purple-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-500'
          }`}>
            <div className="text-[8px] font-bold uppercase">Silver Bullet</div>
            <div className="text-[9.5px] font-extrabold truncate">
              {sniper.silverBullet.isActive ? '⚡ Active' : 'Hors fenêtre'}
            </div>
          </div>
        </div>

        {/* Detailed explanations if toggled */}
        {showIctDetails && (
          <div className="p-2 mt-2 rounded-lg bg-black/40 border border-white/5 space-y-1.5 text-[9.5px] text-slate-300">
            <div>
              <span className="text-cyan-400 font-bold">• Judas Swing :</span> {sniper.judasSwing.description}
            </div>
            <div>
              <span className="text-purple-400 font-bold">• Divergence SMT :</span> {sniper.smtDivergence.description}
            </div>
            <div>
              <span className="text-emerald-400 font-bold">• Livraison Silver Bullet :</span> {sniper.silverBullet.description}
            </div>
            <div>
              <span className="text-amber-400 font-bold">• Plan de Compound $10 :</span> À R:R 1:2.2, chaque gain rapporte +${sniper.capitalGainTP1}. Il ne faut que {sniper.compoundPlan.tradesToDouble} trades consécutifs à TP1 pour doubler le compte de $10 à $20 !
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onOpenChart}
          className="flex-1 py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(34,211,238,0.15)] active:scale-95"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>Afficher Niveaux Sniper sur Graphique</span>
        </button>

        <button
          onClick={onExecuteTrade}
          disabled={!isReady}
          className={`py-2 px-3.5 rounded-xl font-black text-[11px] transition-all flex items-center gap-1 ${
            isReady
              ? isBuy
                ? 'bg-emerald-400 hover:bg-emerald-300 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)] active:scale-95'
                : 'bg-rose-400 hover:bg-rose-300 text-black shadow-[0_0_15px_rgba(239,68,68,0.4)] active:scale-95'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{isReady ? (isBuy ? 'Tir BUY 0.01' : 'Tir SELL 0.01') : 'Sécurité Active'}</span>
        </button>
      </div>
    </div>
  );
};
