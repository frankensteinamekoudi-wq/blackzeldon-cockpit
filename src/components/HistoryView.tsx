import React from 'react';
import { Award, TrendingUp, TrendingDown, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { JournalRecord } from '../lib/bz/db.server.js';

interface HistoryViewProps {
  records: JournalRecord[];
  onClearHistory?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ records, onClearHistory }) => {
  const closed = records.filter(r => r.result === 'win' || r.result === 'loss');
  const wins = closed.filter(r => r.result === 'win').length;
  const losses = closed.filter(r => r.result === 'loss').length;
  const total = closed.length;
  const winrate = total > 0 ? (wins / total) * 100 : 0;

  let totalGainR = 0;
  let totalLossR = 0;
  let currentStreak = 0;
  let maxWinStreak = 0;
  let equity = 0;
  let peak = 0;
  let maxDDR = 0;
  const equityPoints: number[] = [0];

  closed.forEach(r => {
    const mult = r.rMultiple ?? (r.result === 'win' ? 2 : -1);
    if (r.result === 'win') {
      totalGainR += mult;
      currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
      maxWinStreak = Math.max(maxWinStreak, currentStreak);
    } else {
      totalLossR += Math.abs(mult);
      currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
    }
    equity += mult;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDDR) maxDDR = dd;
    equityPoints.push(equity);
  });

  const profitFactor = totalLossR > 0 ? (totalGainR / totalLossR) : totalGainR > 0 ? 99 : 0;

  const renderEquityCurve = () => {
    if (equityPoints.length < 2) return null;
    const min = Math.min(0, ...equityPoints);
    const max = Math.max(1, ...equityPoints);
    const range = max - min || 1;
    const w = 280;
    const h = 70;

    const coords = equityPoints.map((v, idx) => {
      const x = (idx / (equityPoints.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16 overflow-visible">
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d={`M 0,${h} L ${coords.join(' L ')} L ${w},${h} Z`}
          fill="url(#eqGrad)"
        />
        <path
          d={`M ${coords.join(' L ')}`}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
        />
      </svg>
    );
  };

  return (
    <div className="space-y-3 pb-12">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-4 gap-2 font-mono">
        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
          <span className="text-[9px] text-slate-400 block font-bold uppercase">Winrate</span>
          <span className={`text-[15px] font-black ${winrate >= 50 ? 'text-emerald-400' : 'text-slate-300'}`}>
            {total > 0 ? `${winrate.toFixed(0)}%` : '—'}
          </span>
          <span className="text-[8px] text-slate-500 block">{wins}W / {losses}L</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
          <span className="text-[9px] text-slate-400 block font-bold uppercase">Profit F.</span>
          <span className={`text-[15px] font-black ${profitFactor >= 1.5 ? 'text-cyan-300' : 'text-slate-300'}`}>
            {total > 0 ? profitFactor.toFixed(2) : '—'}
          </span>
          <span className="text-[8px] text-slate-500 block">PF R:R</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
          <span className="text-[9px] text-slate-400 block font-bold uppercase">Total R</span>
          <span className={`text-[15px] font-black ${equity >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {equity >= 0 ? `+${equity.toFixed(1)}` : equity.toFixed(1)}R
          </span>
          <span className="text-[8px] text-slate-500 block">Cumulatif</span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
          <span className="text-[9px] text-slate-400 block font-bold uppercase">Max DD</span>
          <span className="text-[15px] font-black text-amber-400">
            -{maxDDR.toFixed(1)}R
          </span>
          <span className="text-[8px] text-slate-500 block">Pire creux</span>
        </div>
      </div>

      {/* Equity Curve Card */}
      {equityPoints.length > 2 && (
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-extrabold uppercase tracking-wider text-slate-400">Courbe d'équité en R</span>
            <span className="text-emerald-400 font-mono font-bold">Max streak: {maxWinStreak}W</span>
          </div>
          {renderEquityCurve()}
        </div>
      )}

      {/* Trade Journal List */}
      <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-white">
            Journal d'Exécution ({records.length})
          </span>
          {onClearHistory && records.length > 0 && (
            <button
              onClick={onClearHistory}
              className="text-[9px] text-slate-500 hover:text-rose-400 transition-colors"
            >
              Effacer
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-[11px] font-mono">
            Aucun signal ou trade enregistré dans ce cycle.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto no-scrollbar">
            {records.slice(0, 35).map((rec, i) => {
              const isWin = rec.result === 'win';
              const isLoss = rec.result === 'loss';
              const isPending = rec.result === 'pending';
              const isExpired = rec.result === 'expired';

              return (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 text-[11px] font-mono"
                >
                  <div className="flex items-center gap-2">
                    {isWin ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : isLoss ? (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    ) : isPending ? (
                      <span className="w-2 h-2 rounded-full bg-amber-400 pulse-live" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-slate-500" />
                    )}

                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span>{rec.pair}</span>
                        <span className="text-slate-500 text-[9px]">{rec.timeframe}</span>
                        <span className={`text-[10px] ${rec.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {rec.direction}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-500">
                        {new Date(rec.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {rec.entry ? ` • @ ${rec.entry}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`font-black text-[12px] ${
                      isWin ? 'text-emerald-400' : isLoss ? 'text-rose-400' : isPending ? 'text-amber-400' : 'text-slate-500'
                    }`}>
                      {isWin ? `+${rec.rMultiple ?? 2}R` : isLoss ? `-${Math.abs(rec.rMultiple ?? 1)}R` : isPending ? 'En cours' : 'Expiré'}
                    </span>
                    {rec.score && (
                      <span className="text-[9px] text-slate-500 block">
                        {rec.score}pts
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
