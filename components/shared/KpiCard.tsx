import React from 'react';
import Card from './Card';
import { ICONS } from '../../constants';

interface KpiCardProps { 
    title: string; 
    value: React.ReactNode; 
    icon: React.ReactNode; 
    iconBg?: string;
    valueColor?: string;
    trendValue?: string;
    trendDirection?: 'up' | 'down' | 'neutral';
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, iconBg, valueColor, trendValue, trendDirection }) => {
    
    const trendColor = trendDirection === 'up' 
        ? 'text-success' 
        : trendDirection === 'down' 
        ? 'text-danger' 
        : 'text-text-secondary';
        
    const TrendIcon = () => {
        if (trendDirection === 'up') return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>;
        if (trendDirection === 'down') return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>;
        return null;
    };

    return (
        <Card className="p-5 flex flex-col h-full">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg || 'bg-primary/10'}`}>
                {icon}
            </div>
            <div className="mt-4 flex-grow">
                 <p className="text-sm text-text-secondary">{title}</p>
                 <p className={`text-3xl font-bold mt-1 ${valueColor || 'text-text-primary'}`}>{value}</p>
            </div>
             {trendValue && (
                <div className={`flex items-center text-sm font-semibold ${trendColor} mt-4`}>
                    <TrendIcon />
                    <span className="ml-1">{trendValue} vs yesterday</span>
                </div>
            )}
        </Card>
    );
};

export default KpiCard;