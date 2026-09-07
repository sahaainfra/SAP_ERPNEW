import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import type { TileValue, RagStatus } from '../engine/types';

interface TileProps {
  title: string;
  subtitle?: string;
  value: TileValue;
  onClick?: () => void;
}

/* ===================== Count Tile ===================== */
export function CountTile({ title, subtitle, value, onClick }: TileProps) {
  const numValue = typeof value.value === 'number' ? value.value : 0;
  
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card p-4 text-left hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="lbl mb-1">{title}</div>
      <div className="font-disp font-black text-[32px] leading-none text-ink mb-1">
        {numValue}
      </div>
      {subtitle && (
        <div className="text-[11px] text-mute font-mono">{subtitle}</div>
      )}
      {value.trend !== undefined && (
        <div className="flex items-center gap-1 mt-2 text-[10px] font-mono">
          {value.trend > 0 ? (
            <TrendingUp size={12} className="text-ok" />
          ) : value.trend < 0 ? (
            <TrendingDown size={12} className="text-bad" />
          ) : (
            <Minus size={12} className="text-mute" />
          )}
          <span className={value.trend > 0 ? 'text-ok' : value.trend < 0 ? 'text-bad' : 'text-mute'}>
            {value.trend > 0 ? '+' : ''}{value.trend}%
          </span>
        </div>
      )}
      <div className="text-[9px] text-mute font-mono mt-2">
        as at {value.timestamp.slice(11, 16)}
      </div>
    </motion.button>
  );
}

/* ===================== KPI Tile ===================== */
export function KpiTile({ title, subtitle, value, onClick }: TileProps) {
  const displayValue = typeof value.value === 'number' 
    ? value.value >= 100000 
      ? `₹${(value.value / 100000).toFixed(1)}L`
      : `₹${value.value.toLocaleString('en-IN')}`
    : value.value;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card p-4 text-left hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="lbl mb-1">{title}</div>
      <div className="font-disp font-black text-[28px] leading-none text-ink mb-1">
        {displayValue}
      </div>
      {subtitle && (
        <div className="text-[11px] text-mute font-mono">{subtitle}</div>
      )}
      <div className="text-[9px] text-mute font-mono mt-2">
        as at {value.timestamp.slice(11, 16)}
      </div>
    </motion.button>
  );
}

/* ===================== Monitoring Tile ===================== */
export function MonitoringTile({ title, subtitle, value, onClick }: TileProps) {
  const statusColor = value.status === 'GREEN' ? 'bg-ok' : value.status === 'AMBER' ? 'bg-warn' : value.status === 'RED' ? 'bg-bad' : 'bg-mute';
  const StatusIcon = value.status === 'GREEN' ? CheckCircle : value.status === 'RED' ? AlertCircle : Clock;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card p-4 text-left hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="lbl">{title}</div>
        <StatusIcon size={16} className={value.status === 'GREEN' ? 'text-ok' : value.status === 'RED' ? 'text-bad' : 'text-warn'} />
      </div>
      <div className="font-disp font-bold text-[18px] leading-none text-ink mb-1">
        {value.value}
      </div>
      {subtitle && (
        <div className="text-[11px] text-mute font-mono">{subtitle}</div>
      )}
      <div className={`w-full h-1 ${statusColor} rounded-full mt-3`} />
      <div className="text-[9px] text-mute font-mono mt-2">
        as at {value.timestamp.slice(11, 16)}
      </div>
    </motion.button>
  );
}

/* ===================== Comparison Tile ===================== */
export function ComparisonTile({ title, subtitle, value, onClick }: TileProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card p-4 text-left hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="lbl mb-2">{title}</div>
      <div className="font-disp font-black text-[24px] leading-none text-ink mb-1">
        {value.value}
      </div>
      {subtitle && (
        <div className="text-[11px] text-mute font-mono">{subtitle}</div>
      )}
      <div className="text-[9px] text-mute font-mono mt-2">
        as at {value.timestamp.slice(11, 16)}
      </div>
    </motion.button>
  );
}

/* ===================== Action Tile ===================== */
export function ActionTile({ title, subtitle, value, onClick }: TileProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card p-4 text-left hover:shadow-lg transition-shadow cursor-pointer bg-side text-white"
    >
      <div className="lbl mb-2 text-white/70">{title}</div>
      <div className="font-disp font-bold text-[16px] leading-none mb-1">
        {subtitle || 'Click to create'}
      </div>
      <div className="text-[10px] text-white/50 font-mono mt-3">
        Quick action
      </div>
    </motion.button>
  );
}

/* ===================== Micro Chart Tile (placeholder) ===================== */
export function MicroChartTile({ title, subtitle, value, onClick }: TileProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card p-4 text-left hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="lbl mb-2">{title}</div>
      <div className="font-disp font-black text-[24px] leading-none text-ink mb-2">
        {value.value}
      </div>
      {/* Placeholder sparkline */}
      <div className="flex items-end gap-0.5 h-8">
        {[40, 60, 45, 70, 55, 80, 65].map((h, i) => (
          <div key={i} className="flex-1 bg-acc/30 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
      {subtitle && (
        <div className="text-[11px] text-mute font-mono mt-2">{subtitle}</div>
      )}
      <div className="text-[9px] text-mute font-mono mt-1">
        as at {value.timestamp.slice(11, 16)}
      </div>
    </motion.button>
  );
}

/* ===================== Tile Renderer ===================== */
export function Tile({ type, ...props }: TileProps & { type: string }) {
  switch (type) {
    case 'COUNT':
      return <CountTile {...props} />;
    case 'KPI':
      return <KpiTile {...props} />;
    case 'MONITORING':
      return <MonitoringTile {...props} />;
    case 'COMPARISON':
      return <ComparisonTile {...props} />;
    case 'ACTION':
      return <ActionTile {...props} />;
    case 'MICRO_CHART':
      return <MicroChartTile {...props} />;
    default:
      return <CountTile {...props} />;
  }
}
