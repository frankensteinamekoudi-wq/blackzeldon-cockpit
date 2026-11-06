import React, { useState } from 'react';
import { Sliders, AlertTriangle, RefreshCw, Send, MessageSquare, Bot, Shield, DollarSign } from 'lucide-react';

interface SettingsProps {
  demoBalance: number;
  startingBalance: number;
  onResetDemo: (newBal?: number) => void;
  autoTradeEnabled: boolean;
  onToggleAutoTrade: (enabled: boolean) => void;
  autoTradeMinScore: number;
  onChangeMinScore: (v: number) => void;
  autoTradeMaxConcurrent: number;
  onChangeMaxConcurrent: (v: number) => void;
  riskCapital: number;
  onChangeCapital: (v: number) => void;
  riskPercent: number;
  onChangeRiskPercent: (v: number) => void;
  telegramEnabled: boolean;
  onToggleTelegram: (v: boolean) => void;
  botToken: string;
  onChangeBotToken: (v: string) => void;
  chatId: string;
  onChangeChatId: (v: string) => void;
  onTestTelegram: () => void;
  telegramStatus: string;
  whatsappEnabled: boolean;
  onToggleWhatsapp: (v: boolean) => void;
  whatsappToken: string;
  onChangeWhatsappToken: (v: string) => void;
  phoneNumberId: string;
  onChangePhoneNumberId: (v: string) => void;
  whatsappRecipient: string;
  onChangeWhatsappRecipient: (v: string) => void;
  onTestWhatsapp: () => void;
  whatsappStatus: string;
}

export const SettingsView: React.FC<SettingsProps> = ({
  demoBalance,
  startingBalance,
  onResetDemo,
  autoTradeEnabled,
  onToggleAutoTrade,
  autoTradeMinScore,
  onChangeMinScore,
  autoTradeMaxConcurrent,
  onChangeMaxConcurrent,
  riskCapital,
  onChangeCapital,
  riskPercent,
  onChangeRiskPercent,
  telegramEnabled,
  onToggleTelegram,
  botToken,
  onChangeBotToken,
  chatId,
  onChangeChatId,
  onTestTelegram,
  telegramStatus,
  whatsappEnabled,
  onToggleWhatsapp,
  whatsappToken,
  onChangeWhatsappToken,
  phoneNumberId,
  onChangePhoneNumberId,
  whatsappRecipient,
  onChangeWhatsappRecipient,
  onTestWhatsapp,
  whatsappStatus
}) => {
  const [resetInput, setResetInput] = useState(startingBalance);

  return (
    <div className="space-y-4 pb-12">
      {/* Explicit Avertissement Simulation Non Réaliste Banner */}
      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1 shadow-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <h4 className="text-[12px] font-black uppercase tracking-wider text-amber-300">
            Avertissement : Simulation Non Réaliste
          </h4>
        </div>
        <p className="text-[10px] text-amber-200/80 leading-relaxed pl-7">
          Les résultats de simulation et d’auto-trade démo ne reproduisent pas fidèlement les conditions réelles d'exécution du marché (slippage de liquidité, latence d'acheminement des ordres, spreads variables pendant les annonces économiques et exécutions partielles).
        </p>
      </div>

      {/* 1. Compte Démo & Capital */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-cyan-400" />
            <h3 className="text-[12px] font-black uppercase tracking-wider text-white">
              Compte Démo Virtuel
            </h3>
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            Initial : ${startingBalance.toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[9px] text-slate-400 block uppercase">Solde Actuel</span>
            <span className="text-xl font-black text-cyan-300">
              ${demoBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[9px] text-slate-400 block uppercase">P/L Simulé</span>
            <span className={`text-xl font-black ${
              demoBalance >= startingBalance ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {demoBalance >= startingBalance ? '+' : ''}
              {(demoBalance - startingBalance).toFixed(2)}$
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="number"
            value={resetInput}
            onChange={e => setResetInput(Number(e.target.value) || 10000)}
            className="w-28 px-2.5 py-1.5 rounded-xl bg-black/50 border border-slate-700 text-cyan-300 font-mono text-[12px]"
          />
          <button
            onClick={() => onResetDemo(resetInput)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold active:scale-95 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Réinitialiser Solde</span>
          </button>
        </div>
      </div>

      {/* 2. Auto-Trade Bot */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            <h3 className="text-[12px] font-black uppercase tracking-wider text-white">
              Bot Auto-Trade
            </h3>
          </div>

          <button
            onClick={() => onToggleAutoTrade(!autoTradeEnabled)}
            className={`px-3 py-1 rounded-full text-[10.5px] font-black transition-all ${
              autoTradeEnabled
                ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(34,197,94,0.4)]'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {autoTradeEnabled ? 'ACTIF ●' : 'INACTIF ○'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <label className="text-[9px] text-slate-400 block font-bold uppercase">Score min.</label>
            <input
              type="number"
              min="50"
              max="99"
              value={autoTradeMinScore}
              onChange={e => onChangeMinScore(Number(e.target.value))}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-300 font-bold"
            />
          </div>

          <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <label className="text-[9px] text-slate-400 block font-bold uppercase">Max simultanés</label>
            <input
              type="number"
              min="1"
              max="10"
              value={autoTradeMaxConcurrent}
              onChange={e => onChangeMaxConcurrent(Number(e.target.value))}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-300 font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <label className="text-[9px] text-slate-400 block font-bold uppercase">Capital de calcul ($)</label>
            <input
              type="number"
              value={riskCapital}
              onChange={e => onChangeCapital(Number(e.target.value))}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-300 font-bold"
            />
          </div>

          <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <label className="text-[9px] text-slate-400 block font-bold uppercase">Risque par trade (%)</label>
            <input
              type="number"
              step="0.5"
              value={riskPercent}
              onChange={e => onChangeRiskPercent(Number(e.target.value))}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-300 font-bold"
            />
          </div>
        </div>
      </div>

      {/* 3. Alertes & Canaux Externes (Telegram & WhatsApp) */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center gap-1.5">
          <Send className="w-4 h-4 text-cyan-400" />
          <h3 className="text-[12px] font-black uppercase tracking-wider text-white">
            Alertes Telegram
          </h3>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-[11px] text-slate-300 font-medium">Activer diffusion automatique</label>
          <input
            type="checkbox"
            checked={telegramEnabled}
            onChange={e => onToggleTelegram(e.target.checked)}
            className="w-4 h-4 accent-cyan-400 cursor-pointer"
          />
        </div>

        {telegramEnabled && (
          <div className="space-y-2 pt-1 text-[11px]">
            <div>
              <label className="text-[9px] text-slate-400 uppercase font-mono block mb-1">Bot Token</label>
              <input
                type="password"
                value={botToken}
                onChange={e => onChangeBotToken(e.target.value)}
                placeholder="123456:ABC-DEF..."
                className="w-full px-2.5 py-1.5 rounded-xl bg-black/50 border border-slate-700 font-mono text-white text-[11px]"
              />
            </div>

            <div>
              <label className="text-[9px] text-slate-400 uppercase font-mono block mb-1">Chat ID</label>
              <input
                type="text"
                value={chatId}
                onChange={e => onChangeChatId(e.target.value)}
                placeholder="-100123456789 ou @nom_canal"
                className="w-full px-2.5 py-1.5 rounded-xl bg-black/50 border border-slate-700 font-mono text-white text-[11px]"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={onTestTelegram}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10.5px] font-bold active:scale-95"
              >
                Tester l'envoi
              </button>
              {telegramStatus && (
                <span className="text-[10px] text-slate-400 font-mono">{telegramStatus}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h3 className="text-[12px] font-black uppercase tracking-wider text-white">
            Alertes WhatsApp Business
          </h3>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-[11px] text-slate-300 font-medium">Activer notifications</label>
          <input
            type="checkbox"
            checked={whatsappEnabled}
            onChange={e => onToggleWhatsapp(e.target.checked)}
            className="w-4 h-4 accent-emerald-400 cursor-pointer"
          />
        </div>

        {whatsappEnabled && (
          <div className="space-y-2 pt-1 text-[11px]">
            <div>
              <label className="text-[9px] text-slate-400 uppercase font-mono block mb-1">Destinataire (E.164)</label>
              <input
                type="text"
                value={whatsappRecipient}
                onChange={e => onChangeWhatsappRecipient(e.target.value)}
                placeholder="+22890123456"
                className="w-full px-2.5 py-1.5 rounded-xl bg-black/50 border border-slate-700 font-mono text-white text-[11px]"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={onTestWhatsapp}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold active:scale-95"
              >
                Tester WhatsApp
              </button>
              {whatsappStatus && (
                <span className="text-[10px] text-slate-400 font-mono">{whatsappStatus}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
