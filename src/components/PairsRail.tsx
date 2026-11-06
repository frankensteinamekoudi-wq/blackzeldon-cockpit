import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { PairConfig } from '../lib/bz/config.js';

interface PairSnapshotInfo {
  price: number;
  prevPrice?: number;
  changePct: number;
  sparkline: number[];
  dir?: 'BUY' | 'SELL' | null;
  score?: number;
}

interface PairsRailProps {
  pairs: PairConfig[];
  selectedPairId: string;
  onSelectPair: (id: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  pairDataMap: Record<string, PairSnapshotInfo>;
}

export const PairsRail: React.FC<PairsRailProps> = ({
  pairs,
  selectedPairId,
  onSelectPair,
  selectedCategory,
  onSelectCategory,
  pairDataMap
}) => {
  const categories = [
    { id: 'all', label: 'Tout' },
    { id: 'fx', label: '💱 Forex' },
    { id: 'idx', label: '📊 Indices' },
    { id: 'crypto', label: '🪙 Crypto' },
    { id: 'synthetic', label: '🧬 Synthétiques' }
  ];

  const filteredPairs = pairs.filter(p => {
    if (selectedCategory === 'all') return true;
    return p.type === selectedCategory;
  });

  const renderSparkline = (points: number[], isUp: boolean) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 48;
    const height = 16;
    const strokeColor = isUp ? '#22c55e' : '#ef4444';

    const coords = points.map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 3) - 1.5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M ${coords.join(' L ')}`;

    return (
      <svg width={width} height={height} className="overflow-visible">
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="w-full space-y-2">
      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1 py-0.5">
        {categories.map(cat => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Horizontal Rail of Pairs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1 snap-x snap-mandatory">
        {filteredPairs.map(p => {
          const isSelected = selectedPairId === p.id;
          const snap = pairDataMap[p.id] || {
            price: 0,
            changePct: 0,
            sparkline: [1, 2, 1.5, 3, 2.5, 4]
          };

          const isUp = snap.changePct >= 0;
          const displayPrice = snap.price > 0 ? snap.price.toFixed(p.digits) : '—';

          return (
            <button
              key={p.id}
              onClick={() => onSelectPair(p.id)}
              className={`snap-start flex-shrink-0 flex flex-col gap-1 p-2 rounded-xl text-left transition-all min-w-[115px] border ${
                isSelected
                  ? 'bg-gradient-to-br from-slate-800/90 to-slate-900/95 border-cyan-400/80 shadow-[0_4px_16px_rgba(34,211,238,0.2)] scale-[1.02]'
                  : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700/80'
              }`}
            >
              {/* Header: Icon + Pair Label + Direction Arrow */}
              <div className="flex items-center justify-between gap-1 w-full">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[11px] leading-none">{p.icon}</span>
                  <span className="text-[11px] font-extrabold tracking-tight text-slate-100 truncate">
                    {p.label}
                  </span>
                </div>

                <div className="flex items-center">
                  {snap.changePct > 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  ) : snap.changePct < 0 ? (
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  ) : (
                    <Minus className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  )}
                </div>
              </div>

              {/* Price & Sparkline in compact row */}
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <span className="text-[12px] font-bold font-mono tracking-tight text-white tabular-nums">
                  {displayPrice}
                </span>
                <div className="opacity-90">
                  {renderSparkline(snap.sparkline, isUp)}
                </div>
              </div>

              {/* Direction tag or score pill if active */}
              {snap.dir && (
                <div className="flex items-center justify-between text-[8.5px] mt-0.5">
                  <span className={`px-1 py-0.2 rounded font-bold ${
                    snap.dir === 'BUY'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {snap.dir}
                  </span>
                  {snap.score && (
                    <span className="text-slate-400 font-mono font-medium">
                      {snap.score}pts
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
