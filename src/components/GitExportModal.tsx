import React, { useState } from 'react';
import { X, Copy, Check, GitBranch, Download, Terminal, FolderArchive, ExternalLink } from 'lucide-react';

interface GitExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitExportModal: React.FC<GitExportModalProps> = ({ isOpen, onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const gitSnippet = `# 1. Cloner ou initialiser votre dépôt local
git init
git add -A
git commit -m "feat: Blackzeldon Oscar v10.1 Pro - SMC & Quantum Engine"

# 2. Lier à votre dépôt GitHub distant
git remote add origin https://github.com/VOTRE_COMPTE/VOTRE_REPO.git
git branch -M main

# 3. Pousser vers GitHub
git push -u origin main`;

  const installSnippet = `# Installation et lancement local
npm install
npm run dev   # Lance le serveur Express + Vite sur http://localhost:3000`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-500/30 bg-[#0a0f1d] p-4 text-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.8)] space-y-3.5 no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                Code Source &amp; Git Push GitHub
              </h3>
              <p className="text-[10px] text-slate-400">
                Exporter ou synchroniser l'ensemble du projet
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Git Push Instructions */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              Commandes Git pour pousser sur votre GitHub :
            </span>
            <button
              onClick={() => copyToClipboard(gitSnippet, 1)}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300"
            >
              {copiedIndex === 1 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedIndex === 1 ? 'Copié !' : 'Copier'}
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-black/70 border border-slate-800 font-mono text-[10px] text-cyan-200/90 leading-relaxed overflow-x-auto">
            <pre>{gitSnippet}</pre>
          </div>
        </div>

        {/* Step 2: How to run locally */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400">
            <span className="flex items-center gap-1.5">
              <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
              Lancement local (Full-Stack) :
            </span>
            <button
              onClick={() => copyToClipboard(installSnippet, 2)}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-300"
            >
              {copiedIndex === 2 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedIndex === 2 ? 'Copié !' : 'Copier'}
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-black/70 border border-slate-800 font-mono text-[10px] text-emerald-200/90 leading-relaxed overflow-x-auto">
            <pre>{installSnippet}</pre>
          </div>
        </div>

        {/* Project Structure Highlights */}
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[10.5px] space-y-1 text-slate-300">
          <div className="font-bold text-white mb-1">Architecture Complète du Projet :</div>
          <div>• <code className="text-cyan-300">src/lib/smc/</code> : Structure, Order Blocks, FVG, Sweeps, Judas &amp; AMD</div>
          <div>• <code className="text-cyan-300">src/lib/quantum/</code> : Hurst, Kalman, Markov, Hawkes, Monte Carlo</div>
          <div>• <code className="text-cyan-300">server.ts</code> : Serveur Express haute fréquence + API routes</div>
          <div>• <code className="text-cyan-300">legacy/</code> : anciennes versions autonomes (non servies, non connectées au moteur)</div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 text-black font-extrabold text-[12px] shadow-[0_0_15px_rgba(34,211,238,0.3)] active:scale-95 transition-all"
        >
          Fermer et Retourner au Scanner
        </button>
      </div>
    </div>
  );
};
