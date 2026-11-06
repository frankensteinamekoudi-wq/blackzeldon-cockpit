import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, X, Crosshair } from 'lucide-react';
import { Candle } from '../lib/smc/structure.js';
import { TradePlan } from '../lib/bz/trade-plan.js';
import { TF_LIST } from '../lib/bz/config.js';

interface ChartZone {
  low: number;
  high: number;
  dir: 'bull' | 'bear';
  label: string;
  mitigated?: boolean;
}

interface CandleChartProps {
  candles: Candle[];
  plan: TradePlan | null;
  direction: 'BUY' | 'SELL' | 'PAS DE TRADE';
  pairLabel: string;
  timeframe: string;
  digits: number;
  pipSize: number;
  zones?: ChartZone[];
  isModal?: boolean;
  onCloseModal?: () => void;
  onSelectTimeframe?: (tfId: string) => void;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  candles,
  plan,
  direction,
  pairLabel,
  timeframe,
  digits,
  pipSize,
  zones = [],
  isModal = false,
  onCloseModal,
  onSelectTimeframe
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [width, setWidth] = useState(360);
  const [height, setHeight] = useState(isModal ? 480 : 320);
  const [hudCandle, setHudCandle] = useState<Candle | null>(null);

  // Layer Toggles
  const [showZones, setShowZones] = useState(true);
  const [showKillZones, setShowKillZones] = useState(true);
  const [showMidnight, setShowMidnight] = useState(true);

  // Live price ticking simulation so the chart is reactive and alive
  const [liveTickOffset, setLiveTickOffset] = useState<number>(0);
  const [tickFlash, setTickFlash] = useState<'up' | 'down' | null>(null);

  // Zoom and pan state
  const viewRef = useRef({ count: 65, end: 0 });
  const [viewVersion, setViewVersion] = useState(0);

  const dragRef = useRef<{ startX: number; startEnd: number } | null>(null);
  const pinchRef = useRef<{ initialDist: number; initialCount: number } | null>(null);
  const crosshairRef = useRef<{ x: number; y: number } | null>(null);

  // Live Micro-Tick effect on the latest candle
  useEffect(() => {
    const timer = setInterval(() => {
      const delta = (Math.random() - 0.49) * pipSize * 0.4;
      setLiveTickOffset(prev => {
        const next = Math.max(-pipSize * 2, Math.min(pipSize * 2, prev + delta));
        setTickFlash(delta >= 0 ? 'up' : 'down');
        setTimeout(() => setTickFlash(null), 400);
        return next;
      });
      setViewVersion(v => v + 1);
    }, 1200);

    return () => clearInterval(timer);
  }, [pipSize]);

  // Handle dynamic width
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth);
        setHeight(isModal ? Math.min(540, window.innerHeight - 80) : 320);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isModal]);

  const clampView = (totalLen: number) => {
    const v = viewRef.current;
    v.count = Math.max(16, Math.min(300, Math.round(v.count)));
    v.count = Math.min(v.count, Math.max(16, totalLen));
    v.end = Math.max(0, Math.min(totalLen - v.count, Math.round(v.end)));
  };

  // Touch and mouse pan/zoom listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const total = () => (candles || []).length;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY;
      const v = viewRef.current;
      const prevCount = v.count;
      v.count = v.count * Math.exp(dy * 0.0015);
      clampView(total());

      const rect = canvas.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      v.end = Math.round(v.end + (v.count - prevCount) * (1 - frac));
      clampView(total());
      setViewVersion(t => t + 1);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchRef.current = { initialDist: d, initialCount: viewRef.current.count };
      } else if (e.touches.length === 1) {
        dragRef.current = { startX: e.touches[0].clientX, startEnd: viewRef.current.end };
        crosshairRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setViewVersion(t => t + 1);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (d > 0) {
          viewRef.current.count = pinchRef.current.initialCount * (pinchRef.current.initialDist / d);
          clampView(total());
          setViewVersion(t => t + 1);
        }
      } else if (e.touches.length === 1 && dragRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - dragRef.current.startX;
        const step = (width - 70) / viewRef.current.count;
        viewRef.current.end = dragRef.current.startEnd + Math.round(dx / step);
        clampView(total());
        crosshairRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setViewVersion(t => t + 1);
      }
    };

    const onTouchEnd = () => {
      dragRef.current = null;
      pinchRef.current = null;
    };

    const onMouseDown = (e: MouseEvent) => {
      dragRef.current = { startX: e.clientX, startEnd: viewRef.current.end };
    };

    const onMouseMove = (e: MouseEvent) => {
      crosshairRef.current = { x: e.clientX, y: e.clientY };
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const step = (width - 70) / viewRef.current.count;
        viewRef.current.end = dragRef.current.startEnd + Math.round(dx / step);
        clampView(total());
      }
      setViewVersion(t => t + 1);
    };

    const onMouseUp = () => {
      dragRef.current = null;
    };

    const onMouseLeave = () => {
      dragRef.current = null;
      crosshairRef.current = null;
      setHudCandle(null);
      setViewVersion(t => t + 1);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [candles, width]);

  // Adjust candles with live tick
  const activeCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const copy = [...candles];
    const last = copy[copy.length - 1];
    if (last) {
      const tickedClose = last.close + liveTickOffset;
      copy[copy.length - 1] = {
        ...last,
        close: tickedClose,
        high: Math.max(last.high, tickedClose),
        low: Math.min(last.low, tickedClose)
      };
    }
    return copy;
  }, [candles, liveTickOffset]);

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || activeCandles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Dark terminal canvas background
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, width, height);

    // Padding definitions
    const padTop = 32;
    const padBottom = 26;
    const padLeft = 8;
    const padRight = 72; // Space for price scale & badges

    const plotW = Math.max(10, width - padLeft - padRight);
    const plotH = Math.max(10, height - padTop - padBottom);

    const total = activeCandles.length;
    clampView(total);

    const startIdx = Math.max(0, total - viewRef.current.end - viewRef.current.count);
    const endIdx = total - viewRef.current.end;
    const slice = activeCandles.slice(startIdx, endIdx);

    if (slice.length === 0) return;

    // Price Bounds (Min & Max with plan levels included)
    let minP = Math.min(...slice.map(c => c.low));
    let maxP = Math.max(...slice.map(c => c.high));

    if (plan) {
      if (Number.isFinite(plan.sl)) {
        minP = Math.min(minP, plan.sl);
        maxP = Math.max(maxP, plan.sl);
      }
      if (Number.isFinite(plan.tp1)) {
        minP = Math.min(minP, plan.tp1);
        maxP = Math.max(maxP, plan.tp1);
      }
      if (Number.isFinite(plan.tp2)) {
        minP = Math.min(minP, plan.tp2);
        maxP = Math.max(maxP, plan.tp2);
      }
      if (Number.isFinite(plan.tp3)) {
        minP = Math.min(minP, plan.tp3);
        maxP = Math.max(maxP, plan.tp3);
      }
    }

    const margin = (maxP - minP) * 0.1 || 0.001;
    minP -= margin;
    maxP += margin;

    const toY = (p: number) => padTop + plotH - ((p - minP) / (maxP - minP)) * plotH;
    const toP = (y: number) => maxP - ((y - padTop) / plotH) * (maxP - minP);

    // Grid lines (horizontal & vertical)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;

    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const y = padTop + (plotH / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      const priceAtY = toP(y);
      ctx.fillStyle = '#64748b';
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillText(priceAtY.toFixed(digits), padLeft + plotW + 6, y + 3);
    }

    // Step calculation
    const step = plotW / slice.length;
    const barWidth = Math.max(2.5, step * 0.68);

    // Draw SMC Institutional Zones (OB / FVG)
    zones.forEach(z => {
      const topY = toY(Math.max(z.low, z.high));
      const bottomY = toY(Math.min(z.low, z.high));
      const boxH = Math.max(3, bottomY - topY);
      const isBull = z.dir === 'bull';

      ctx.save();
      ctx.fillStyle = isBull ? 'rgba(34, 197, 94, 0.10)' : 'rgba(239, 68, 68, 0.10)';
      ctx.fillRect(padLeft, topY, plotW, boxH);

      ctx.strokeStyle = isBull ? 'rgba(34, 197, 94, 0.40)' : 'rgba(239, 68, 68, 0.40)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(padLeft, topY, plotW, boxH);
      ctx.restore();

      ctx.fillStyle = isBull ? '#4ade80' : '#f87171';
      ctx.font = '700 8.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(z.label, padLeft + 6, topY + 9);
    });

    // Draw Shaded TP/SL risk bands
    if (plan && Number.isFinite(plan.entryA) && Number.isFinite(plan.sl) && Number.isFinite(plan.tp1)) {
      const entryY = toY(plan.entryA);
      const slY = toY(plan.sl);
      const tpY = toY(plan.tp1);

      // TP Shaded Area
      const tpTop = Math.min(entryY, tpY);
      const tpH = Math.abs(tpY - entryY);
      const tpGrad = ctx.createLinearGradient(0, tpTop, 0, tpTop + tpH);
      tpGrad.addColorStop(0, 'rgba(34, 197, 94, 0.15)');
      tpGrad.addColorStop(1, 'rgba(34, 197, 94, 0.02)');
      ctx.fillStyle = tpGrad;
      ctx.fillRect(padLeft, tpTop, plotW, tpH);

      // SL Shaded Area
      const slTop = Math.min(entryY, slY);
      const slH = Math.abs(slY - entryY);
      const slGrad = ctx.createLinearGradient(0, slTop, 0, slTop + slH);
      slGrad.addColorStop(0, 'rgba(239, 68, 68, 0.02)');
      slGrad.addColorStop(1, 'rgba(239, 68, 68, 0.18)');
      ctx.fillStyle = slGrad;
      ctx.fillRect(padLeft, slTop, plotW, slH);
    }

    // Draw Candlesticks
    slice.forEach((c, idx) => {
      const x = padLeft + idx * step + step / 2;
      const isUp = c.close >= c.open;
      const candleColor = isUp ? '#22c55e' : '#ef4444';

      ctx.strokeStyle = candleColor;
      ctx.fillStyle = candleColor;
      ctx.lineWidth = Math.max(1, barWidth * 0.18);

      // Wick
      ctx.beginPath();
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      // Body
      const yo = toY(c.open);
      const yc = toY(c.close);
      const bodyTop = Math.min(yo, yc);
      const bodyH = Math.max(1.5, Math.abs(yc - yo));
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyH);
    });

    // Helper: Draw Plan Level with glowing price tags
    const drawPlanLevel = (val: number, color: string, label: string, isDashed = false) => {
      if (!Number.isFinite(val)) return;
      const y = toY(val);
      if (y < padTop || y > padTop + plotH) return;

      ctx.save();
      if (isDashed) ctx.setLineDash([4, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
      ctx.restore();

      // Right Side Tag Badge
      ctx.fillStyle = color;
      ctx.fillRect(padLeft + plotW + 2, y - 8, padRight - 6, 16);

      ctx.fillStyle = '#05070d';
      ctx.font = '800 8.5px "JetBrains Mono", monospace';
      ctx.fillText(label, padLeft + plotW + 5, y + 3);
    };

    // Draw Complete Plan Levels: ENTRÉE, SL, TP1, TP2, TP3, BE
    if (plan) {
      if (plan.tp3) drawPlanLevel(plan.tp3, '#06b6d4', 'TP3 (1:6.5)', true);
      if (plan.tp2) drawPlanLevel(plan.tp2, '#10b981', 'TP2 (1:4)', true);
      drawPlanLevel(plan.tp1, '#22c55e', 'TP1 (1:2.2)', true);
      if (plan.be) drawPlanLevel(plan.be, '#eab308', 'BE', true);
      drawPlanLevel(plan.entryA, '#22d3ee', 'ENTRÉE', false);
      drawPlanLevel(plan.sl, '#ef4444', 'SL', true);
    }

    // Live Pulsing Price Line & Tag
    const lastCandle = slice[slice.length - 1];
    if (lastCandle) {
      const liveY = toY(lastCandle.close);
      if (liveY >= padTop && liveY <= padTop + plotH) {
        ctx.save();
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = tickFlash === 'up' ? '#22c55e' : tickFlash === 'down' ? '#ef4444' : '#eab308';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(padLeft, liveY);
        ctx.lineTo(padLeft + plotW, liveY);
        ctx.stroke();
        ctx.restore();

        // Pulsing tag
        const tagColor = tickFlash === 'up' ? '#22c55e' : tickFlash === 'down' ? '#ef4444' : '#eab308';
        ctx.fillStyle = tagColor;
        ctx.fillRect(padLeft + plotW + 2, liveY - 8, padRight - 6, 16);
        ctx.fillStyle = '#05070d';
        ctx.font = '800 9px "JetBrains Mono", monospace';
        ctx.fillText(lastCandle.close.toFixed(digits), padLeft + plotW + 4, liveY + 3);
      }
    }

    // Interactive Crosshair & Tooltip
    if (crosshairRef.current) {
      const rect = canvas.getBoundingClientRect();
      const cx = crosshairRef.current.x - rect.left;
      const cy = crosshairRef.current.y - rect.top;

      if (cx >= padLeft && cx <= padLeft + plotW && cy >= padTop && cy <= padTop + plotH) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1;

        // Vert line
        ctx.beginPath();
        ctx.moveTo(cx, padTop);
        ctx.lineTo(cx, padTop + plotH);
        ctx.stroke();

        // Horz line
        ctx.beginPath();
        ctx.moveTo(padLeft, cy);
        ctx.lineTo(padLeft + plotW, cy);
        ctx.stroke();
        ctx.restore();

        // Find hovered candle
        const hoverIdx = Math.floor((cx - padLeft) / step);
        if (hoverIdx >= 0 && hoverIdx < slice.length) {
          setHudCandle(slice[hoverIdx]);
        }
      }
    }
  }, [activeCandles, plan, zones, width, height, viewVersion, tickFlash, digits, digits]);

  const activeHud = hudCandle || (activeCandles.length ? activeCandles[activeCandles.length - 1] : null);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl bg-[#050811] border border-cyan-500/20 overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.7)] ${
        isModal ? 'h-[90vh]' : ''
      }`}
    >
      {/* Top Header: Pair, Timeframe Selector, Live Price & HUD */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-2 border-b border-white/5 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${tickFlash === 'up' ? 'bg-emerald-400 scale-125' : tickFlash === 'down' ? 'bg-rose-400 scale-125' : 'bg-cyan-400'} transition-all`} />
            <span className="text-[12px] font-black text-white">{pairLabel}</span>
          </div>

          {/* Timeframe Chips Selector [M1][M5][M15][H1][H4][D1] */}
          {onSelectTimeframe && (
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5 font-mono text-[9.5px]">
              {TF_LIST.slice(0, 5).map(tf => (
                <button
                  key={tf.id}
                  onClick={() => onSelectTimeframe(tf.id)}
                  className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                    timeframe === tf.label || timeframe === tf.id
                      ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* HUD: OHLC & Live Ticking Price */}
        {activeHud && (
          <div className="flex items-center gap-2 font-mono text-[9.5px] text-slate-300">
            <span>O: <b className="text-white">{activeHud.open.toFixed(digits)}</b></span>
            <span>H: <b className="text-emerald-400">{activeHud.high.toFixed(digits)}</b></span>
            <span>L: <b className="text-rose-400">{activeHud.low.toFixed(digits)}</b></span>
            <span>C: <b className="text-cyan-300">{activeHud.close.toFixed(digits)}</b></span>
          </div>
        )}

        {/* Modal close button */}
        {isModal && onCloseModal && (
          <button
            onClick={onCloseModal}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Canvas Chart */}
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="block cursor-crosshair touch-none select-none"
      />

      {/* Footer Controls: Reset Zoom & SMC Indicators Legend */}
      <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[8.5px] font-mono text-slate-400 pointer-events-none">
        <div className="flex items-center gap-2 bg-black/60 px-2 py-0.5 rounded border border-white/5 pointer-events-auto">
          <span className="flex items-center gap-1 text-cyan-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Entrée
          </span>
          <span className="flex items-center gap-1 text-rose-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            SL
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            TP1 / TP2 / TP3
          </span>
        </div>

        <button
          onClick={() => {
            viewRef.current = { count: 65, end: 0 };
            setViewVersion(v => v + 1);
          }}
          className="pointer-events-auto flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Reset Zoom</span>
        </button>
      </div>
    </div>
  );
};
