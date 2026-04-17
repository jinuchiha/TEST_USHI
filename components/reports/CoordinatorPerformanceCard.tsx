import React from 'react';
import { formatCurrency } from '../../utils';
import Card from '../shared/Card';

interface PerformanceData {
    name: string;
    paid: number;
    projection: number;
    target: number;
    closure: number;
    doe: number;
    ptpInProgress: number;
    workable: number;
}

interface CoordinatorPerformanceCardProps {
    data: PerformanceData;
    rank: number;
}

const StatItem: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className }) => (
    <div className="bg-background/50/50 p-2 rounded-md text-center">
        <p className="text-xs text-text-secondary uppercase tracking-wider font-medium">{label}</p>
        <p className={`text-lg font-bold text-text-primary ${className}`}>{value}</p>
    </div>
);

const CoordinatorPerformanceCard: React.FC<CoordinatorPerformanceCardProps> = ({ data, rank }) => {
    const progress = Math.min(data.closure, 100);
    
    const getProgressBarColor = () => {
        if (progress < 40) return 'bg-danger';
        if (progress < 80) return 'bg-warning';
        return 'bg-accent';
    };

    const rankColor = () => {
        if (rank === 1) return 'bg-yellow-400 text-yellow-900';
        if (rank === 2) return 'bg-slate-400 text-slate-900';
        if (rank === 3) return 'bg-amber-600 text-white';
        return 'bg-slate-500 dark:bg-slate-600 text-white';
    }

    return (
        <Card className="!p-0 overflow-hidden relative flex flex-col" isHoverable>
            <div className={`absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${rankColor()} z-10 shadow`}>
                #{rank}
            </div>
            
            <div className="p-4 bg-surface">
                <h3 className="text-lg font-semibold text-text-primary truncate pr-10">{data.name}</h3>
                <p className="text-sm text-text-secondary">Monthly Performance</p>
                
                <div className="my-4">
                    <p className="text-sm text-text-secondary">Collections vs Target</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-accent">{formatCurrency(data.paid, 'AED')}</span>
                        <span className="text-sm text-text-secondary">/ {formatCurrency(data.target, 'AED')}</span>
                    </div>
                </div>
            </div>

            <div className="bg-surface-muted p-4 mt-auto border-t border-border">
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-base font-medium text-text-primary">{data.closure.toFixed(2)}%</span>
                        <span className="text-sm font-medium text-text-secondary">Closure Rate</span>
                    </div>
                    <div className="w-full bg-borderborder rounded-full h-2">
                        <div className={`h-2 rounded-full ${getProgressBarColor()}`} style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <StatItem label="Projection" value={formatCurrency(data.projection, 'AED').replace('AED ', '')} />
                    <StatItem label="PTP Cases" value={data.ptpInProgress.toString()} />
                    <StatItem label="Workable" value={data.workable.toString()} />
                    <StatItem label="DOE (Today)" value={data.doe.toString()} />
                </div>
            </div>
        </Card>
    );
};

export default CoordinatorPerformanceCard;