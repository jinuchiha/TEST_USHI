import React from 'react';
import { formatCurrency } from '../../utils';
import Card from './Card';

interface TargetProgressBarProps {
  collected: number;
  target: number;
}

const TargetProgressBar: React.FC<TargetProgressBarProps> = ({ collected, target }) => {
  const progress = target > 0 ? Math.min((collected / target) * 100, 100) : 0;

  const getProgressBarColor = () => {
    if (progress < 40) return 'bg-value-red';
    if (progress < 80) return 'bg-value-gold';
    return 'bg-accent';
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end">
        <div>
          <p className="text-base font-medium text-subtle-text">Monthly Collection Progress</p>
          <p className="text-4xl font-bold text-secondary">{formatCurrency(collected, 'AED')}</p>
        </div>
        <p className="text-lg font-semibold text-subtle-text mt-1 sm:mt-0">
          Target: <span className="text-secondary">{formatCurrency(target, 'AED')}</span>
        </p>
      </div>
      <div className="mt-4">
        <div className="flex justify-between mb-1">
            <span className="text-base font-medium text-primary">{progress.toFixed(1)}%</span>
            <span className="text-sm font-medium text-subtle-text">Closure Rate</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className={`h-3 rounded-full transition-all duration-500 ${getProgressBarColor()}`} style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    </Card>
  );
};

export default TargetProgressBar;
