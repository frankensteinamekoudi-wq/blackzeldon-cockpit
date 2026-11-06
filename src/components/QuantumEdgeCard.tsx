import React from 'react';
import { Cpu, Dna, Activity, ShieldAlert, Sparkles, Orbit } from 'lucide-react';

interface QuantumMetrics {
  edge: number;
  verdict: string;
  color: string;
  blended: number;
  kelly: number;
  hurst: { h: number; regime: string };
  entropy: number;
  squeeze: { ratio: number; state: string };
  kalman: { slope: number; conf: number; dir: string };
  markov: { persist: number; note: string };
  mc?: { pTP1: number; pSL: number; expR: number; paths: number } | null;
  parts: Array<{ k: string; v: number; d: string }>;
}

interface QuantumEdgeCardProps {
  quantum: QuantumMetrics | null;
}

export const QuantumEdgeCard: React.FC<QuantumEdgeCardProps> = ({ quantum }) => {
  if (!quantum) return null;

  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const strokeOffset = circ - (quantum.edge / 100) * circ;

  return (
    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-[#0a0f1d] to-[#070a12] border border-cyan-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.5)] space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Orbit className="w-4 h-4 text-cyan-400 animate-spin-slow" />
          <h3 className="text-[11px] font-black uppercase tracking-wider text-white">
            Quantum Edge Recoupement
          </h3>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[9px] font-bold border"
          style={{
            backgroundColor: `${quantum.color}18`,
            borderColor: `${quantum.color}44`,
            color: quantum.color
          }}
        >
          {quantum.verdict}
        </span>
      </div>

      {/* Ring & Top Stats */}
      <div className="flex items-center gap-3">
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
              stroke={quantum.color}
              strokeWidth="5"
              strokeDasharray={circ}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              fill="transparent"
              style={{ filter: `drop-shadow(0 0 6px ${quantum.color}aa)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
            <span className="text-[17px] font-black leading-none" style={{ color: quantum.color }}>
              {quantum.edge}
            </span>
            <span className="text-[7.5px] font-bold text-slate-400">EDGE</span>
          </div>
        </div>

        <div className="flex-1 space-y-1 text-[10.5px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Régime Hurst :</span>
            <span className="font-mono font-bold text-white">{quantum.hurst.regime}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Proba fusionnée :</span>
            <span className="font-mono font-bold text-cyan-300">{Math.round(quantum.blended * 100)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Mise Kelly ½ :</span>
            <span className="font-mono font-bold text-emerald-400">{(quantum.kelly * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Monte Carlo Summary Bar if available */}
      {quantum.mc && (
        <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1.5 font-mono text-[9.5px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Monte-Carlo ({quantum.mc.paths} trajectoires)</span>
            <span className="text-emerald-400 font-bold">E[R] {quantum.mc.expR.toFixed(2)}R</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${Math.round(quantum.mc.pTP1 * 100)}%` }}
              title="Hit TP1"
            />
            <div
              className="bg-rose-500 h-full transition-all"
              style={{ width: `${Math.round(quantum.mc.pSL * 100)}%` }}
              title="Hit SL"
            />
          </div>
          <div className="flex items-center justify-between text-[8.5px] text-slate-400">
            <span className="text-emerald-400">TP1 avant SL: {Math.round(quantum.mc.pTP1 * 100)}%</span>
            <span className="text-rose-400">SL: {Math.round(quantum.mc.pSL * 100)}%</span>
          </div>
        </div>
      )}

      {/* Metric Cells Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {quantum.parts.slice(0, 6).map(p => (
          <div key={p.k} className="p-2 rounded-xl bg-black/30 border border-white/5 text-[10px]">
            <div className="flex items-center justify-between text-slate-400 font-mono text-[9px]">
              <span className="uppercase">{p.k}</span>
              <span className="font-bold text-white">{p.v}</span>
            </div>
            <p className="text-slate-400 text-[9px] mt-0.5 truncate">{p.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
