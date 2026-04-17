import React from 'react';
import { EnrichedCase, User } from '../../types';
import PerformanceLeaderboard from '../reports/PerformanceLeaderboard';

interface OfficerSummaryDashboardProps {
  coordinators: User[];
  cases: EnrichedCase[];
}

const OfficerSummaryDashboard: React.FC<OfficerSummaryDashboardProps> = ({ coordinators, cases }) => {
  return (
    <div className="p-4 md:p-6 min-h-full bg-background">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-secondary">Officer Performance Summary</h1>
        <p className="text-subtle-text">Leaderboard of all active coordinators.</p>
      </div>
      <PerformanceLeaderboard coordinators={coordinators} cases={cases} />
    </div>
  );
};

export default OfficerSummaryDashboard;
