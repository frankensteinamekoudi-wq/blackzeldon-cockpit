import React from 'react';
import { Activity, ShieldCheck, Zap, GitBranch, LogOut } from 'lucide-react';
import { getMinutesUntilNextKZ, KillZone } from '../lib/bz/config.js';

interface HeaderProps {
  sourceName: string;
  sourceStatus: 'live' | 'delayed' | 'fallback';
  activeKZ: KillZone | null;
  currentTime: Date;
  onOpenGitExport?: () => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sourceName,
  sourceStatus,
  activeKZ,
  currentTime,
  onOpenGitExport,
  onSignOut
}) => {
  const kzInfo = getMinutesUntilNextKZ(currentTime);

  const formatLomeTime = (d: Date) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Africa/Lome'
      }).format(d);
    } catch {
      return d.toTimeString().slice(0, 8);
    }
  };

  const getSourceBadge = () => {
    if (sourceStatus === 'live') {
      return {
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-400',
        label: `${sourceName} • Live`
      };
    }
    if (sourceStatus === 'delayed') {
      return {
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        dot: 'bg-amber-400',
        label: `${sourceName} • Retardé`
      };
    }
    return {
      bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      dot: 'bg-cyan-400',
      label: `${sourceName} • Serveur`
    };
  };

  const badge = getSourceBadge();

  return (
    <header className="sticky top-0 z-40 w-full px-3 py-2 border-b border-cyan-500/15 bg-[#070a12]/90 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
        {/* Brand Lockup */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.3)]">
            <Zap className="w-4 h-4 text-cyan-300" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 pulse-live" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-extrabold text-[13px] tracking-wide bg-gradient-to-r from-cyan-300 via-sky-200 to-purple-300 bg-clip-text text-transparent">
                BLACKZELDON
              </span>
              <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                PRO
              </span>
            </div>
            <div className="text-[9px] text-slate-400 font-mono tracking-wider flex items-center gap-1 mt-0.5">
              <span>{formatLomeTime(currentTime)}</span>
              <span className="text-slate-600">|</span>
              <span className="text-[8px] text-cyan-400/80">LOMÉ UTC+0</span>
            </div>
          </div>
        </div>

        {/* Right Status Clustered */}
        <div className="flex items-center gap-1.5 text-right">
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/70 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Source pill */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9.5px] font-medium font-mono ${badge.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} pulse-live`} />
            <span className="truncate max-w-[85px]">{badge.label}</span>
          </div>

          {/* Git Code button */}
          {onOpenGitExport && (
            <button
              onClick={onOpenGitExport}
              title="Code source et Git Push"
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[9.5px] font-bold font-mono active:scale-95 transition-all shadow-sm"
            >
              <GitBranch className="w-3 h-3 text-cyan-400" />
              <span>Git/Code</span>
            </button>
          )}

          {/* Kill Zone Countdown */}
          <div className="hidden xs:flex flex-col items-end">
            {activeKZ ? (
              <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[9px] font-bold flex items-center gap-1">
                <span>{activeKZ.emoji}</span>
                <span>{activeKZ.label} ACTIF</span>
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/50 text-[9px] font-medium font-mono">
                KZ dans {kzInfo.minutesLeft}m
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
