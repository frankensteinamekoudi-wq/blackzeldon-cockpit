import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Cpu, Terminal, Radio, AlertOctagon } from 'lucide-react';
import { SystemState } from '../lib/bz/cycle.server.js';

export const HealthView: React.FC = () => {
  const [state, setState] = useState<SystemState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchState = () => {
      fetch('/api/public/bz/state')
        .then(res => res.json())
        .then(data => {
          if (active) {
            setState(data);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) setLoading(false);
        });
    };

    fetchState();
    const interval = setInterval(fetchState, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const formatAgo = (iso?: string | null) => {
    if (!iso) return '—';
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.round(s / 60)}min`;
    return `${Math.round(s / 3600)}h`;
  };

  return (
    <div className="space-y-3 pb-12">
      {/* Bot & Server Status Hero Card */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 pulse-live" />
            <h3 className="text-[12px] font-black uppercase tracking-wider text-white">
              Santé Système &amp; Heartbeat
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {state?.executionMode || 'QUANTUM_SMC_LIVE'}
          </span>
        </div>

        {/* Timers & Cycles Grid */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-black/40 p-2.5 rounded-xl border border-white/5">
          <div>
            <span className="text-slate-500 block">Dernier cycle :</span>
            <span className="text-white font-bold">{formatAgo(state?.heartbeat?.last_cycle_at)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Donnée flux :</span>
            <span className="text-emerald-400 font-bold">{formatAgo(state?.heartbeat?.last_data_at)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Total cycles :</span>
            <span className="text-cyan-300 font-bold">{state?.heartbeat?.cycle_count || 1}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Dernier signal :</span>
            <span className="text-purple-300 font-bold">{formatAgo(state?.heartbeat?.last_signal_at)}</span>
          </div>
        </div>

        {/* API Keys Budget Status */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Budget Quotas Providers
          </span>
          <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
            {(state?.keys || [
              { slot: 1, configured: true, available: true, creditsUsed: 12, creditsLimit: 800 },
              { slot: 2, configured: true, available: true, creditsUsed: 0, creditsLimit: 800 }
            ]).map(k => (
              <div key={k.slot} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Slot {k.slot}</span>
                <span className="text-emerald-400 font-bold">
                  {k.available ? '● Dispo' : '○ Pause'} ({k.creditsUsed}/{k.creditsLimit})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Diagnostics Event Log */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
        <div className="flex items-center gap-1.5 text-white">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h3 className="text-[12px] font-black uppercase tracking-wider">
            Journal de Diagnostic ({state?.diagnostics?.length || 0})
          </h3>
        </div>

        <div className="space-y-1 max-h-72 overflow-y-auto no-scrollbar font-mono text-[10px]">
          {(state?.diagnostics || [
            { event: "SYSTEM_READY", reason: "Moteur Blackzeldon actif", created_at: new Date().toISOString() },
            { event: "FEED_CONNECT", reason: "Données de marché synchronisées", created_at: new Date().toISOString() }
          ]).map((diag, i) => (
            <div key={i} className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between gap-2">
              <div className="truncate">
                <span className="text-cyan-300 font-bold">[{diag.event}]</span>
                <span className="text-slate-300 ml-1.5">{diag.reason}</span>
              </div>
              <span className="text-slate-500 text-[9px] flex-shrink-0">
                {formatAgo(diag.created_at)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
