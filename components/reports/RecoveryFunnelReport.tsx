import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { EnrichedCase, User } from '../../types';
import Card from '../shared/Card';
import { ICONS, banks } from '../../constants';
import { convertToAED, formatCurrency, getAge } from '../../utils';
import KpiCard from '../shared/KpiCard';

interface PortfolioAgingReportProps {
  allCases: EnrichedCase[];
  coordinators: User[];
}

const DEBTOR_AGE_BUCKETS = {
    '18-25': (age: number) => age >= 18 && age <= 25,
    '26-35': (age: number) => age > 25 && age <= 35,
    '36-45': (age: number) => age > 35 && age <= 45,
    '46-55': (age: number) => age > 45 && age <= 55,
    '56+': (age: number) => age > 55,
    'Unknown': (age: number) => isNaN(age) || age < 18,
};

const WOD_AGING_BUCKETS = {
    '0-90 Days': (age: number) => age <= 90,
    '91-180 Days': (age: number) => age > 90 && age <= 180,
    '181-365 Days': (age: number) => age > 180 && age <= 365,
    '1+ Year': (age: number) => age > 365,
};

const CustomTooltipContent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface/80/80 backdrop-blur-sm p-3 border border-border rounded-md shadow-lg text-sm">
          <p className="font-bold text-text-primary mb-2">{`Age: ${label}`}</p>
          <p style={{ color: payload[0].fill }}>
            {`O/S: ${formatCurrency(payload[0].value, 'AED')}`}
          </p>
           <p className="text-text-secondary mt-1">
            {`# Cases: ${payload[0].payload.cases.toLocaleString()}`}
          </p>
        </div>
      );
    }
    return null;
};

const PortfolioAgingReport: React.FC<PortfolioAgingReportProps> = ({ allCases, coordinators }) => {
    const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('all');
    const [selectedBank, setSelectedBank] = useState('all');
    const [analysisType, setAnalysisType] = useState<'debtorAge' | 'wodAge'>('debtorAge');

    const reportData = useMemo(() => {
        let filteredCases = allCases;
        if (selectedCoordinatorId !== 'all') {
            filteredCases = filteredCases.filter(c => c.assignedOfficerId === selectedCoordinatorId);
        }
        if (selectedBank !== 'all') {
            filteredCases = filteredCases.filter(c => c.loan.bank === selectedBank);
        }

        const today = new Date();
        let chartData: { name: string, cases: number, amount: number }[] = [];
        let totalCases = 0;
        let totalAmount = 0;
        let averageAgeNum = 0;
        let reportTitle = '';

        if (analysisType === 'debtorAge') {
            reportTitle = 'O/S Amount by Debtor Age';
            const buckets = Object.keys(DEBTOR_AGE_BUCKETS).reduce((acc, key) => {
                acc[key] = { name: key, cases: 0, amount: 0 };
                return acc;
            }, {} as Record<string, { name: string, cases: number, amount: number }>);
            
            let totalAgeSum = 0;
            let casesWithAge = 0;

            for (const c of filteredCases) {
                const age = getAge(c.debtor.dob);
                const ageNum = typeof age === 'number' ? age : NaN;
                
                const bucketKey = Object.keys(DEBTOR_AGE_BUCKETS).find(key => DEBTOR_AGE_BUCKETS[key as keyof typeof DEBTOR_AGE_BUCKETS](ageNum));
                if (bucketKey) {
                    buckets[bucketKey].cases += 1;
                    buckets[bucketKey].amount += convertToAED(c.loan.currentBalance, c.loan.currency);
                    if (!isNaN(ageNum) && ageNum > 0) {
                      totalAgeSum += ageNum;
                      casesWithAge++;
                    }
                }
            }
            chartData = Object.values(buckets);
            totalCases = filteredCases.length;
            totalAmount = chartData.reduce((sum, b) => sum + b.amount, 0);
            averageAgeNum = casesWithAge > 0 ? totalAgeSum / casesWithAge : 0;
        } else { // wodAge
            reportTitle = 'O/S Amount by Write-Off Age';
            const wodCases = filteredCases.filter(c => c.loan.wod);
            const buckets = Object.keys(WOD_AGING_BUCKETS).reduce((acc, key) => {
                acc[key] = { name: key, cases: 0, amount: 0 };
                return acc;
            }, {} as Record<string, { name: string, cases: number, amount: number }>);

            let totalWodAgeSum = 0;

            for (const c of wodCases) {
                const wodDate = new Date(c.loan.wod!);
                const ageInDays = (today.getTime() - wodDate.getTime()) / (1000 * 3600 * 24);
                
                const bucketKey = Object.keys(WOD_AGING_BUCKETS).find(key => WOD_AGING_BUCKETS[key as keyof typeof WOD_AGING_BUCKETS](ageInDays));
                if (bucketKey) {
                    buckets[bucketKey].cases += 1;
                    buckets[bucketKey].amount += convertToAED(c.loan.currentBalance, c.loan.currency);
                    totalWodAgeSum += ageInDays;
                }
            }
            chartData = Object.values(buckets);
            totalCases = wodCases.length;
            totalAmount = chartData.reduce((sum, b) => sum + b.amount, 0);
            averageAgeNum = totalCases > 0 ? totalWodAgeSum / totalCases : 0;
        }

        const wodFilteredCases = allCases.filter(c => c.loan.wod);
        const wodTotalAmount = wodFilteredCases.reduce((sum, c) => sum + convertToAED(c.loan.currentBalance, c.loan.currency), 0);

        return { 
            chartData,
            totalCases,
            totalAmount,
            wodCaseCount: wodFilteredCases.length,
            wodTotalAmount,
            averageAge: `${averageAgeNum.toFixed(0)} ${analysisType === 'debtorAge' ? 'years' : 'days'}`,
            reportTitle
        };

    }, [allCases, selectedCoordinatorId, selectedBank, analysisType]);

    const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted sticky top-0 z-10";
    const TD_CLASS = "px-4 py-4 whitespace-nowrap text-sm text-text-primary";

  return (
    <div className="p-4 sm:p-6 bg-background min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-text-primary">Portfolio Demographics</h1>
            <p className="text-text-secondary">Analysis of outstanding debt by debtor age and write-off status.</p>
        </div>
        <div className="flex items-center gap-4">
            <select value={selectedCoordinatorId} onChange={e => setSelectedCoordinatorId(e.target.value)} className="w-full sm:w-auto pl-3 pr-10 py-2 text-base border-border bg-surface text-text-primary sm:text-sm rounded-md shadow-sm">
                <option value="all">All Coordinators</option>
                {coordinators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="w-full sm:w-auto pl-3 pr-10 py-2 text-base border-border bg-surface text-text-primary sm:text-sm rounded-md shadow-sm">
                <option value="all">All Banks</option>
                {banks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
        </div>
      </div>
       <div className="flex items-center gap-2 p-1 bg-surface rounded-lg border border-border mb-6 w-fit">
            <button onClick={() => setAnalysisType('debtorAge')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${analysisType === 'debtorAge' ? 'bg-primary text-white shadow' : 'bg-transparent text-text-primary hover:bg-surface-muted'}`}>
                Debtor Age
            </button>
            <button onClick={() => setAnalysisType('wodAge')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${analysisType === 'wodAge' ? 'bg-primary text-white shadow' : 'bg-transparent text-text-primary hover:bg-surface-muted'}`}>
                Write-Off Aging
            </button>
        </div>


       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-6">
            <KpiCard title="Total O/S" value={formatCurrency(reportData.totalAmount, 'AED')} icon={ICONS.wallet('w-7 h-7 text-primary')} valueColor="text-primary" iconBg="bg-primary/10" />
            <KpiCard title="Total Cases" value={reportData.totalCases.toLocaleString()} icon={ICONS.case('w-7 h-7 text-sky-500')} valueColor="text-sky-500" iconBg="bg-sky-500/10" />
            <KpiCard title={analysisType === 'debtorAge' ? "Avg. Debtor Age" : "Avg. WOD Age"} value={reportData.averageAge} icon={ICONS.avgDpd('w-7 h-7 text-teal-500')} valueColor="text-teal-500" iconBg="bg-teal-500/10" />
            <KpiCard title="WOD Cases (Overall)" value={reportData.wodCaseCount.toLocaleString()} icon={ICONS.archive('w-7 h-7 text-danger')} valueColor="text-danger" iconBg="bg-danger/10" />
            <KpiCard title="WOD O/S (Overall)" value={formatCurrency(reportData.wodTotalAmount, 'AED')} icon={ICONS.money('w-7 h-7 text-danger')} valueColor="text-danger" iconBg="bg-danger/10" />
        </div>
      
       <Card className="p-4 mb-6">
        <h3 className="font-semibold text-text-primary mb-4">{reportData.reportTitle}</h3>
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <BarChart data={reportData.chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" stroke="currentColor" className="text-xs" />
                    <YAxis stroke="currentColor" className="text-xs" tickFormatter={val => `${val / 1000}k`} />
                    <Tooltip content={<CustomTooltipContent />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}/>
                    <Bar dataKey="amount" name="Outstanding Amount" fill="#3b82f6" barSize={40} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </Card>

      <Card className="!p-0 flex flex-col flex-grow">
         <div className="overflow-auto flex-grow">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-muted">
                <tr>
                    <th scope="col" className={TH_CLASS}>{analysisType === 'debtorAge' ? 'Debtor Age Bucket' : 'WOD Age Bucket'}</th>
                    <th scope="col" className={TH_CLASS}># of Cases</th>
                    <th scope="col" className={TH_CLASS}>% of Total Cases</th>
                    <th scope="col" className={TH_CLASS}>O/S Amount (AED)</th>
                    <th scope="col" className={TH_CLASS}>% of Total O/S</th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border">
                {reportData.chartData.map(bucket => (
                    <tr key={bucket.name}>
                        <td className={`${TD_CLASS} font-medium`}>{bucket.name}</td>
                        <td className={TD_CLASS}>{bucket.cases.toLocaleString()}</td>
                        <td className={TD_CLASS}>{reportData.totalCases > 0 ? ((bucket.cases / reportData.totalCases) * 100).toFixed(2) : 0}%</td>
                        <td className={`${TD_CLASS} font-semibold text-red-600`}>{formatCurrency(bucket.amount, 'AED')}</td>
                        <td className={TD_CLASS}>{reportData.totalAmount > 0 ? ((bucket.amount / reportData.totalAmount) * 100).toFixed(2) : 0}%</td>
                    </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-muted font-bold">
                  <tr>
                      <td className={TD_CLASS}>Total</td>
                      <td className={TD_CLASS}>{reportData.totalCases.toLocaleString()}</td>
                      <td className={TD_CLASS}>100.00%</td>
                      <td className={`${TD_CLASS} text-red-600`}>{formatCurrency(reportData.totalAmount, 'AED')}</td>
                      <td className={TD_CLASS}>100.00%</td>
                  </tr>
              </tfoot>
            </table>
          </div>
      </Card>
    </div>
  );
};

export default PortfolioAgingReport;