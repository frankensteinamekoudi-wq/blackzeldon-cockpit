import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Compass, Target, Sparkles, TrendingUp, TrendingDown, Layers, ShieldAlert, Cpu } from 'lucide-react';
import { TF_LIST_RADAR, PairConfig } from '../lib/bz/config.js';
import { ForecastResponse } from '../lib/bz/forecast.js';

interface TFScoresMap {
  [tfId: string]: {
    total: number;
    dir: 'BUY' | 'SELL' | string;
    prob: number;
    color: string;
    quality: string;
    args?: string[];
  };
}

interface RadarViewProps {
  pair: PairConfig;
  tfScores: TFScoresMap;
  selectedTF: string;
  onSelectTF: (tfId: string) => void;
  serverForecast?: ForecastResponse | null;
}

export const RadarView: React.FC<RadarViewProps> = ({
  pair,
  tfScores,
  selectedTF,
  onSelectTF,
  serverForecast
}) => {
  const [radarMode, setRadarMode] = useState<'moderne' | 'analytique' | 'prevision'>('moderne');
  const [expandedSection, setExpandedSection] = useState<'essentiel' | 'details' | 'avance'>('essentiel');
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(serverForecast || null);
  const [loadingForecast, setLoadingForecast] = useState(false);

  // Load forecast if prevision tab is selected
  useEffect(() => {
    if (radarMode === 'prevision') {
      let isMounted = true;
      setLoadingForecast(true);
      fetch(`/api/public/bz/forecast?symbol=${encodeURIComponent(pair.symbol)}`)
        .then(res => res.json())
        .then(data => {
          if (isMounted) {
            setForecastData(data);
            setLoadingForecast(false);
          }
        })
        .catch(() => {
          if (isMounted) setLoadingForecast(false);
        });
      return () => { isMounted = false; };
    }
  }, [radarMode, pair.symbol]);

  // Overall multi-TF alignment
  const rows = TF_LIST_RADAR.map(tf => ({ tf, sc: tfScores[tf.id] })).filter(r => r.sc);
  const buyCount = rows.filter(r => r.sc.dir === 'BUY').length;
  const sellCount = rows.filter(r => r.sc.dir === 'SELL').length;
  const dominantDir = buyCount > sellCount ? 'BUY' : sellCount > buyCount ? 'SELL' : 'MIXTE';
  const alignedCount = Math.max(buyCount, sellCount);

  return (
    <div className="space-y-3 pb-8">
      {/* Segmented Control: Moderne | Analytique | Prévision */}
      <div className="flex p-1 rounded-xl bg-slate-900/90 border border-slate-800">
        <button
          onClick={() => setRadarMode('moderne')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold tracking-tight transition-all ${
            radarMode === 'moderne'
              ? 'bg-gradient-to-r from-cyan-500/20 to-sky-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Moderne
        </button>

        <button
          onClick={() => setRadarMode('analytique')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold tracking-tight transition-all ${
            radarMode === 'analytique'
              ? 'bg-gradient-to-r from-cyan-500/20 to-sky-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Analytique
        </button>

        <button
          onClick={() => setRadarMode('prevision')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold tracking-tight transition-all ${
            radarMode === 'prevision'
              ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-400/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Prévision
        </button>
      </div>

      {/* Main Alignment Banner */}
      <div className={`p-3 rounded-2xl border flex items-center justify-between ${
        dominantDir === 'BUY'
          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
          : dominantDir === 'SELL'
          ? 'bg-rose-950/20 border-rose-500/30 text-rose-400'
          : 'bg-slate-900/60 border-slate-800 text-slate-300'
      }`}>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Compass className="w-4 h-4" />
            <span className="text-[12px] font-black uppercase tracking-wider">
              {dominantDir === 'BUY' ? '▲ ALIGNEMENT HAUSSIER' : dominantDir === 'SELL' ? '▼ ALIGNEMENT BAISSIER' : '↔ MARCHÉ MIXTE'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            {alignedCount} / {TF_LIST_RADAR.length} timeframes concordent sur {pair.label}
          </p>
        </div>

        <div className="text-right font-mono">
          <span className="text-xl font-black">
            {Math.round((alignedCount / TF_LIST_RADAR.length) * 100)}%
          </span>
          <div className="text-[8px] text-slate-500 font-bold uppercase">CONFLUENCE</div>
        </div>
      </div>

      {/* Collapsible Sections Toggle (Essentiel / Détails / Avancé) */}
      <div className="flex items-center gap-1.5">
        {(['essentiel', 'details', 'avance'] as const).map(sec => (
          <button
            key={sec}
            onClick={() => setExpandedSection(sec)}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
              expandedSection === sec
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {sec}
          </button>
        ))}
      </div>

      {/* View 1: Radar MODERNE */}
      {radarMode === 'moderne' && (
        <div className="space-y-2">
          {TF_LIST_RADAR.map(tf => {
            const sc = tfScores[tf.id];
            const isSelected = selectedTF === tf.id;
            const dirColor = sc?.dir === 'BUY' ? 'text-emerald-400' : sc?.dir === 'SELL' ? 'text-rose-400' : 'text-slate-400';
            const bgGlow = sc?.dir === 'BUY' ? 'border-emerald-500/20 bg-emerald-950/10' : sc?.dir === 'SELL' ? 'border-rose-500/20 bg-rose-950/10' : 'border-slate-800 bg-slate-900/40';

            return (
              <div
                key={tf.id}
                onClick={() => onSelectTF(tf.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${bgGlow} ${
                  isSelected ? 'ring-1 ring-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.15)]' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 font-mono font-black text-[12px] text-white">
                      {tf.label}
                    </span>
                    <span className="text-[9.5px] uppercase text-slate-500 tracking-wider">
                      {tf.role}
                    </span>
                    <span className={`text-[11px] font-extrabold ${dirColor}`}>
                      {sc ? sc.dir : '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {sc ? `${sc.prob}% prob` : '…'}
                    </span>
                    <span className="font-mono font-black text-[13px]" style={{ color: sc?.color || '#64748b' }}>
                      {sc ? `${sc.total}pts` : '…'}
                    </span>
                  </div>
                </div>

                {/* Progress Mini Bar */}
                <div className="w-full h-1 bg-slate-800/80 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${sc ? Math.min(100, sc.total) : 0}%`,
                      backgroundColor: sc?.color || '#334155'
                    }}
                  />
                </div>

                {/* Details if selected or in 'details' / 'avance' mode */}
                {(expandedSection !== 'essentiel' || isSelected) && sc?.args && sc.args.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-1 text-[9.5px] text-slate-400">
                    {sc.args.map((arg, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5 font-mono">
                        {arg}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* View 2: Radar ANALYTIQUE */}
      {radarMode === 'analytique' && (
        <div className="grid grid-cols-2 gap-2">
          {TF_LIST_RADAR.map(tf => {
            const sc = tfScores[tf.id];
            const isSelected = selectedTF === tf.id;
            return (
              <div
                key={tf.id}
                onClick={() => onSelectTF(tf.id)}
                className={`p-3 rounded-xl border bg-slate-900/60 transition-all cursor-pointer ${
                  isSelected ? 'border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.2)]' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-[13px] text-cyan-300">{tf.label}</span>
                  <span className={`text-[10px] font-bold ${
                    sc?.dir === 'BUY' ? 'text-emerald-400' : sc?.dir === 'SELL' ? 'text-rose-400' : 'text-slate-500'
                  }`}>
                    {sc?.dir || '—'}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between font-mono">
                  <span className="text-2xl font-black" style={{ color: sc?.color || '#94a3b8' }}>
                    {sc?.total ?? '—'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {sc ? `${sc.prob}% prob` : '…'}
                  </span>
                </div>

                <div className="mt-1 text-[9px] text-slate-400 truncate">
                  Qualité : <b className="text-slate-300">{sc?.quality || 'N/A'}</b>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View 3: Radar PRÉVISION */}
      {radarMode === 'prevision' && (
        <div className="space-y-2">
          <div className="p-2 rounded-xl bg-purple-950/20 border border-purple-500/20 text-[10px] text-purple-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Modèle prédictif calibré • Projection probabiliste sur horizons d'ATR</span>
          </div>

          {loadingForecast ? (
            <div className="p-8 text-center text-slate-500 text-[11px] font-mono">
              Calcul des prévisions multi-timeframes…
            </div>
          ) : (
            (forecastData?.rows || []).map(row => (
              <div
                key={row.tf}
                className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/70 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-[13px] text-white">
                      {row.tf.toUpperCase()}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold ${
                      row.direction === 'BUY'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : row.direction === 'SELL'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {row.direction}
                    </span>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-[13px] font-extrabold text-cyan-300">
                      {row.status === 'READY' ? `${row.probability}%` : 'n/d'}
                    </span>
                    <span className="text-[9px] text-slate-500 ml-1">{row.status === 'READY' ? `empirique · n=${row.similarSamples}` : 'échantillon insuffisant'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-black/30 p-2 rounded-lg">
                  <div>
                    <span className="text-slate-500">Cible : </span>
                    <span className="text-emerald-400 font-bold">{row.target}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Invalidation : </span>
                    <span className="text-rose-400 font-bold">{row.invalidation}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5">
                  <span>Horizon : {row.horizon} bougies ({row.horizonMinutes}min)</span>
                  <span>{row.similarSamples} cas similaires testés</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
