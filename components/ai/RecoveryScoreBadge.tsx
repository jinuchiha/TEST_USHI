import React from 'react';

interface RecoveryScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const RecoveryScoreBadge: React.FC<RecoveryScoreBadgeProps> = ({
  score,
  size = 'md',
  showLabel = true,
}) => {
  const getColor = (s: number) => {
    if (s >= 80) return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-500', stroke: '#10b981' };
    if (s >= 60) return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', ring: 'ring-blue-500', stroke: '#3b82f6' };
    if (s >= 40) return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-500', stroke: '#f59e0b' };
    if (s >= 20) return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', ring: 'ring-orange-500', stroke: '#f97316' };
    return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', ring: 'ring-red-500', stroke: '#ef4444' };
  };

  const getLabel = (s: number) => {
    if (s >= 80) return 'Very High';
    if (s >= 60) return 'High';
    if (s >= 40) return 'Medium';
    if (s >= 20) return 'Low';
    return 'Very Low';
  };

  const color = getColor(score);
  const label = getLabel(score);

  const dims = {
    sm: { w: 36, h: 36, strokeWidth: 3, fontSize: 'text-xs', r: 14 },
    md: { w: 48, h: 48, strokeWidth: 4, fontSize: 'text-sm', r: 18 },
    lg: { w: 64, h: 64, strokeWidth: 5, fontSize: 'text-base', r: 24 },
  }[size];

  const circumference = 2 * Math.PI * dims.r;
  const progress = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: dims.w, height: dims.h }}>
        <svg width={dims.w} height={dims.h} className="-rotate-90">
          <circle
            cx={dims.w / 2}
            cy={dims.h / 2}
            r={dims.r}
            fill="none"
            stroke="currentColor"
            strokeWidth={dims.strokeWidth}
            className="text-[var(--color-border)]"
          />
          <circle
            cx={dims.w / 2}
            cy={dims.h / 2}
            r={dims.r}
            fill="none"
            stroke={color.stroke}
            strokeWidth={dims.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center font-bold ${dims.fontSize} ${color.text}`}>
          {score}
        </span>
      </div>
      {showLabel && (
        <div className="flex flex-col">
          <span className={`text-xs font-semibold ${color.text}`}>{label}</span>
          <span className="text-[10px] text-text-tertiary">Recovery</span>
        </div>
      )}
    </div>
  );
};

export default RecoveryScoreBadge;
