import React from 'react';
import { Flame, Compass, Clock, Activity, Sliders } from 'lucide-react';

export type TabId = 'scanner' | 'radar' | 'historique' | 'sante' | 'reglages';

interface BottomTabBarProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  openTradesCount?: number;
  strongSignalsCount?: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  currentTab,
  onSelectTab,
  openTradesCount = 0,
  strongSignalsCount = 0
}) => {
  const tabs = [
    { id: 'scanner' as TabId, label: 'Scanner', icon: Flame, badge: strongSignalsCount > 0 ? strongSignalsCount : null },
    { id: 'radar' as TabId, label: 'Radar', icon: Compass },
    { id: 'historique' as TabId, label: 'Historique', icon: Clock, badge: openTradesCount > 0 ? openTradesCount : null, badgeColor: 'bg-emerald-500' },
    { id: 'sante' as TabId, label: 'Santé', icon: Activity },
    { id: 'reglages' as TabId, label: 'Réglages', icon: Sliders }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#070a12]/95 backdrop-blur-xl border-t border-cyan-500/15 max-w-lg mx-auto pb-safe">
      <div className="grid grid-cols-5 h-14">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? 'text-cyan-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Active glow pip */}
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 shadow-[0_0_8px_#22d3ee]" />
              )}

              <div className="relative">
                <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110 text-cyan-400' : ''}`} />
                {tab.badge !== null && tab.badge !== undefined && (
                  <span className={`absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full text-[8px] font-bold text-black ${tab.badgeColor || 'bg-amber-400'}`}>
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className={`text-[10px] tracking-tight ${isActive ? 'font-bold' : 'font-normal'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
