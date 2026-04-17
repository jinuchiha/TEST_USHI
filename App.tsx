


import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CASES, COORDINATORS, DEBTORS, LOANS, SIDEBAR_NAV_ITEMS, UNASSIGNED_USER, USERS, ICONS } from './constants';
import { User, EnrichedCase, Debtor, Loan, Case, Role, HelpRequest, Notification, Action, ActionType, CRMStatus, SubStatus, UpdateCaseResult, NotificationReply, LoginRecord, LogPaymentSubmitData, AllocationLogEntry } from './types';
import Login from './components/auth/Login';
import Layout from './components/shared/Layout';
import { OfficerDashboard } from './components/dashboard/OfficerDashboard';
import CaseDetailView from './components/cases/CaseDetailView';
import TeamAllocationView from './components/cases/TeamAllocationView';
import PlaceholderView from './components/placeholder/PlaceholderView';
import AgentDashboard from './components/dashboard/AgentDashboard';
import ManagerDashboard from './components/dashboard/ManagerDashboard';
import CEODashboard from './components/dashboard/CEODashboard';
import FinanceDashboard from './components/dashboard/FinanceDashboard';
import UserManagementView from './components/users/UserManagementView';
import DailySummaryReport from './components/reports/DailySummaryReport';
import InteractionsView from './components/interactions/InteractionsView';
import PaymentsView from './components/payments/PaymentsView';
import AddCaseModal from './components/cases/AddCaseModal';
import ImportCasesModal from './components/cases/ImportCasesModal';
import NewAllocationsView from './components/cases/NewAllocationsView';
import WithdrawnCasesView from './components/cases/WithdrawnCasesView';
import PendingWithdrawalsView from './components/cases/PendingWithdrawalsView';
import CaseSearchView from './components/cases/CaseSearchView';
import HelpRequestsView from './components/admin/HelpRequestsView';
import AdminAuditView from './components/admin/AdminAuditView';
import OfficerSummaryDashboard from './components/dashboard/OfficerSummaryDashboard';
import AnnualForecastReport from './components/reports/AnnualForecastReport';
import RecoveryFunnelReport from './components/reports/RecoveryFunnelReport';
import StatusMatrixReport from './components/reports/StatusMatrixReport';
import SendNotificationModal from './components/shared/SendNotificationModal';
import NotificationCenterView from './components/admin/NotificationCenterView';
import AllocationReportView from './components/reports/AllocationReportView';
import NipWorkflowModal from './components/cases/NipWorkflowModal';
import LogPaymentModal from './components/cases/LogPaymentModal';
import { getStatusPillClasses, getSubStatusPillClasses, formatCurrency } from './utils';
import { useAuth } from './src/contexts/AuthContext';
import { apiClient, casesApi, usersApi, notificationsApi, helpRequestsApi, allocationsApi, actionsApi, debtorsApi, loansApi } from './src/api';
import AiInsightsPanel from './components/ai/AiInsightsPanel';
import AiPortfolioDashboard from './components/ai/AiPortfolioDashboard';
import ForecastChart from './components/ai/ForecastChart';
import CEOAdvancedDashboard from './components/dashboard/advanced/CEOAdvancedDashboard';
import HRDashboard from './components/hr/HRDashboard';
import ProductivityDashboard from './components/productivity/ProductivityDashboard';
import PortfolioIntelligence from './components/dashboard/advanced/PortfolioIntelligence';
import PortfolioAgingDashboard from './components/dashboard/advanced/PortfolioAgingDashboard';
import AttendancePortal from './components/hr/AttendancePortal';
import TracingPanel from './components/cases/tracing/TracingPanel';
import SummaryWiseReport from './components/reports/SummaryWiseReport';
import KanbanBoard from './components/cases/KanbanBoard';
import PromiseDashboard from './components/reports/PromiseDashboard';
import CommissionCalculator from './components/reports/CommissionCalculator';
import AiCopilot from './components/ai/AiCopilot';
import PaymentPlanWizard from './components/cases/PaymentPlanWizard';
import BankDraftTracker from './components/gulf/BankDraftTracker';
import LiabilityEmail from './components/gulf/LiabilityEmail';
import WorkflowAutomation from './components/automation/WorkflowAutomation';
import AttendancePopup from './components/hr/AttendancePopup';
import WorkQueue from './components/cases/WorkQueue';
import DebtorPortal from './components/debtor-portal/DebtorPortal';
import CustomReportBuilder from './components/reports/CustomReportBuilder';
import { useRealtimeSync } from './hooks/useRealtimeSync';


const IDLE_TIMEOUT_MS = 600000; // 10 minutes — officers are on calls for 5-10 min
const IDLE_WARNING_MS = 480000; // 8 minutes — warn 2 minutes before logout

const App: React.FC = () => {
    const { currentUser, isLoading: authLoading, isAuthenticated, login: apiLogin, logout: authLogout, loginLocal, useApi } = useAuth();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [hasCheckedIn, setHasCheckedIn] = useState(false);
    const [checkingIn, setCheckingIn] = useState(false);
    const [showIdleWarning, setShowIdleWarning] = useState(false);

  const [activeView, setActiveView] = useState('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [navFilters, setNavFilters] = useState<any>({});
  
  // Data state — load from localStorage if demo mode has saved data
  const [users, setUsers] = useState<User[]>(() => {
    if (!useApi) { try { const s = localStorage.getItem('rv_users'); if (s) return JSON.parse(s); } catch {} } return USERS;
  });
  const [debtors, setDebtors] = useState<Debtor[]>(() => {
    if (!useApi) { try { const s = localStorage.getItem('rv_debtors'); if (s) return JSON.parse(s); } catch {} } return DEBTORS;
  });
  const [loans, setLoans] = useState<Loan[]>(() => {
    if (!useApi) { try { const s = localStorage.getItem('rv_loans'); if (s) return JSON.parse(s); } catch {} } return LOANS;
  });
  const [cases, setCases] = useState<Case[]>(() => {
    if (!useApi) { try { const s = localStorage.getItem('rv_cases'); if (s) return JSON.parse(s); } catch {} } return CASES;
  });

  // Persist demo data to localStorage on every change
  useEffect(() => {
    if (!useApi) {
      try {
        localStorage.setItem('rv_cases', JSON.stringify(cases));
        localStorage.setItem('rv_users', JSON.stringify(users));
      } catch {}
    }
  }, [cases, users, useApi]);
  
  // Global toast notification system
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const [isAddCaseModalOpen, setIsAddCaseModalOpen] = useState(false);
  const [isImportCasesModalOpen, setIsImportCasesModalOpen] = useState(false);
  const [isSendNotificationModalOpen, setIsSendNotificationModalOpen] = useState(false);
  const [isCaseDetailModalOpen, setIsCaseDetailModalOpen] = useState(false);

  // Admin/Help state
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [allocationLog, setAllocationLog] = useState<AllocationLogEntry[]>([]);
  
  const [modalState, setModalState] = useState<{
        type: 'NIP' | 'PAID' | null;
        caseData: EnrichedCase | null;
        initialNotes?: string;
        initialStatuses?: { crmStatus: CRMStatus, subStatus: SubStatus, contactStatus: 'Contact' | 'Non Contact', workStatus: 'Work' | 'Non Work' };
    }>({ type: null, caseData: null });

  // Real-time sync — BroadcastChannel (demo) or Socket.io (API)
  const { isConnected: isLive, broadcast } = useRealtimeSync({
    useApi,
    userId: currentUser?.id,
    onEvent: (event) => {
        if (event.type === 'case:updated') {
            setCases(prev => prev.map(c =>
                c.id === event.caseId
                    ? { ...c, crmStatus: event.crmStatus as CRMStatus, subStatus: event.subStatus as SubStatus }
                    : c
            ));
        } else if (event.type === 'notification:new') {
            const n: Notification = {
                id: event.id,
                senderId: event.senderId,
                senderName: event.senderName,
                recipientId: event.recipientId,
                message: event.message,
                timestamp: new Date().toISOString(),
                status: 'unread',
                priority: event.priority as 'Normal' | 'Urgent',
                isTask: false,
            };
            setNotifications(prev => {
                if (prev.some(x => x.id === n.id)) return prev;
                return [n, ...prev];
            });
        }
    },
  });


  const coordinators = useMemo(() => users.filter(u => u.role === Role.OFFICER && u.id !== UNASSIGNED_USER.id), [users]);
  
  const clearFilters = useCallback(() => setNavFilters({}), []);
  
  const enrichedCases: EnrichedCase[] = useMemo(() => {
    return cases
        .map(c => {
            const debtor = debtors.find(d => d.id === c.debtorId);
            const loan = loans.find(l => l.id === c.loanId);

            if (!debtor || !loan) {
                return null;
            }

            const officer = users.find(u => u.id === c.assignedOfficerId) || UNASSIGNED_USER;
            const sortedHistory = [...c.history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            return {
                ...c,
                debtor,
                loan,
                officer,
                history: sortedHistory,
                lastActionDate: sortedHistory.length > 0 ? sortedHistory[0].timestamp : c.creationDate,
            };
        })
        .filter((c): c is EnrichedCase => c !== null);
  }, [cases, debtors, loans, users]);

  const selectedCaseData = useMemo(() => {
    if (!selectedCaseId) return null;
    return enrichedCases.find(c => c.id === selectedCaseId) || null;
  }, [selectedCaseId, enrichedCases]);

  // Next/Previous case navigation
  const navigateCase = useCallback((direction: 'next' | 'prev') => {
    if (!selectedCaseId) return;
    const visibleCases = enrichedCases.filter(c => c.assignedOfficerId === currentUser?.id || currentUser?.role !== Role.OFFICER);
    const currentIndex = visibleCases.findIndex(c => c.id === selectedCaseId);
    if (currentIndex === -1) return;
    const newIndex = direction === 'next' ? Math.min(currentIndex + 1, visibleCases.length - 1) : Math.max(currentIndex - 1, 0);
    if (newIndex !== currentIndex) setSelectedCaseId(visibleCases[newIndex].id);
  }, [selectedCaseId, enrichedCases, currentUser]);
  

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // ── Idle timeout: warn at 8 min, auto-logout at 10 min ──
  useEffect(() => {
    if (!currentUser) return;
    let warningTimer: ReturnType<typeof setTimeout>;
    let logoutTimer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      setShowIdleWarning(false);

      warningTimer = setTimeout(() => {
        setShowIdleWarning(true);
      }, IDLE_WARNING_MS);

      logoutTimer = setTimeout(() => {
        if (useApi) {
          apiClient.post('/api/hr/sessions/end', { reason: 'idle_logout' }).catch(() => {});
        }
        setShowIdleWarning(false);
        handleLogout();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [currentUser?.id]);

  // ── Keyboard shortcuts for case modal ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isCaseDetailModalOpen) return;
      // Don't intercept when typing in input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        setIsCaseDetailModalOpen(false);
        setSelectedCaseId(null);
      } else if (e.key === 'ArrowLeft') {
        navigateCase('prev');
      } else if (e.key === 'ArrowRight') {
        navigateCase('next');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCaseDetailModalOpen, navigateCase]);

  // ── Check-in enforcement: on login ──
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    if (useApi) {
      // API mode: check server for attendance status
      apiClient.get<any>('/api/hr/attendance/check-in-status')
        .then(res => {
          if (res.data?.checkedIn) {
            setHasCheckedIn(true);
          }
          // If not checked in, leave hasCheckedIn=false so the gate shows
        })
        .catch(() => setHasCheckedIn(true)); // Don't block on error
      apiClient.post('/api/hr/sessions/start', {}).catch(() => {});
    } else {
      // Demo mode: officers must check in, other roles skip
      if (currentUser.role === Role.OFFICER) {
        const todayStr = new Date().toISOString().split('T')[0];
        try {
          const records = JSON.parse(localStorage.getItem('rv_attendance_v2') || '[]');
          const alreadyCheckedIn = records.some((r: any) => r.officerId === currentUser.id && r.date === todayStr);
          if (alreadyCheckedIn) {
            setHasCheckedIn(true);
          }
          // If not checked in, leave hasCheckedIn=false so AttendancePopup shows
        } catch {
          // On error, don't block
          setHasCheckedIn(true);
        }
      } else {
        // Non-officers (Manager, CEO, etc.) skip attendance gate
        setHasCheckedIn(true);
      }
    }
  }, [isAuthenticated, currentUser?.id, useApi]);

  // Load data from API when authenticated in API mode
  useEffect(() => {
    if (isAuthenticated && useApi && currentUser) {
      // Load users
      usersApi.getAll().then(res => setUsers(res.data)).catch(console.error);

      // Load cases with enriched data (the API returns joined data)
      casesApi.getAll({ limit: 100 }).then(res => {
        if (res.data) {
          // Map API cases to local format
          const apiCases: Case[] = res.data.map((c: any) => ({
            id: c.id,
            debtorId: c.debtorId,
            loanId: c.loanId,
            assignedOfficerId: c.assignedOfficerId,
            crmStatus: c.crmStatus,
            subStatus: c.subStatus || '',
            creationDate: c.creationDate,
            lastContactDate: c.lastContactDate || c.creationDate,
            contactStatus: c.contactStatus,
            workStatus: c.workStatus,
            tracingStatus: c.tracingStatus || '',
            statusCode: c.statusCode || '',
            cyber: c.cyber || 'No',
            history: (c.history || []).map((h: any) => ({
              ...h,
              timestamp: h.createdAt || h.timestamp,
            })),
            auditLog: (c.auditLog || []).map((a: any) => ({
              ...a,
              timestamp: a.createdAt || a.timestamp,
            })),
          }));
          setCases(apiCases);

          // Extract unique debtors and loans from enriched cases
          const debtorMap = new Map<string, Debtor>();
          const loanMap = new Map<string, Loan>();
          res.data.forEach((c: any) => {
            if (c.debtor && !debtorMap.has(c.debtor.id)) {
              debtorMap.set(c.debtor.id, {
                ...c.debtor,
                tracingHistory: c.debtor.tracingHistory || [],
              });
            }
            if (c.loan && !loanMap.has(c.loan.id)) {
              loanMap.set(c.loan.id, c.loan);
            }
          });
          setDebtors(Array.from(debtorMap.values()));
          setLoans(Array.from(loanMap.values()));
        }
      }).catch(console.error);

      // Load notifications
      notificationsApi.getAll().then(res => {
        if (res.data) setNotifications(res.data.map((n: any) => ({ ...n, timestamp: n.createdAt || n.timestamp })));
      }).catch(console.error);

      // Set initial view based on role
      let initialView = 'dashboard-officer';
      switch(currentUser.role) {
          case Role.MANAGER: initialView = 'dashboard-manager'; break;
          case Role.ADMIN: initialView = 'annual-forecast'; break;
          case Role.CEO: initialView = 'dashboard-ceo'; break;
          case Role.FINANCE: initialView = 'dashboard-accountant'; break;
      }
      setActiveView(initialView);
    }
  }, [isAuthenticated, useApi, currentUser?.id]);

  const handleLogin = (userName: string, password?: string): boolean => {
    const success = loginLocal(userName, password || '', users);
    if (success) {
      const user = users.find(u => u.name.toLowerCase() === userName.toLowerCase());
      if (user) {
        setLoginHistory(prev => [...prev, { userId: user.id, userName: user.name, timestamp: new Date().toISOString() }]);
        let initialView = 'dashboard-officer';
        switch(user.role) {
            case Role.MANAGER: initialView = 'dashboard-manager'; break;
            case Role.ADMIN: initialView = 'annual-forecast'; break;
            case Role.CEO: initialView = 'dashboard-ceo'; break;
            case Role.FINANCE: initialView = 'dashboard-accountant'; break;
        }
        setActiveView(initialView);
      }
    }
    return success;
  };

  const handleCheckOut = useCallback(() => {
    if (!currentUser) return;
    try {
      const records = JSON.parse(localStorage.getItem('rv_attendance_v2') || '[]');
      const todayStr = new Date().toISOString().split('T')[0];
      const idx = records.findIndex((r: any) => r.officerId === currentUser.id && r.date === todayStr);
      if (idx >= 0 && records[idx].sessions?.length > 0) {
        const lastSession = records[idx].sessions[records[idx].sessions.length - 1];
        if (!lastSession.checkOut) {
          lastSession.checkOut = new Date().toISOString();
          // Calculate total hours
          const totalMs = records[idx].sessions.reduce((sum: number, s: any) => {
            if (s.checkIn && s.checkOut) {
              return sum + (new Date(s.checkOut).getTime() - new Date(s.checkIn).getTime());
            }
            return sum;
          }, 0);
          records[idx].totalHours = Math.round((totalMs / 3600000) * 100) / 100;
          localStorage.setItem('rv_attendance_v2', JSON.stringify(records));
        }
      }
    } catch {}
  }, [currentUser]);

  const handleLogout = () => {
    // Auto check-out on logout for officers
    if (currentUser?.role === Role.OFFICER) {
      handleCheckOut();
    }
    setHasCheckedIn(false);
    authLogout();
    setActiveView('dashboard');
  };

  const handleUpdateCase = (caseId: string, newAction: Omit<Action, 'id'>): UpdateCaseResult => {
      let updatedCase: Case | undefined;
      setCases(prevCases => {
          const newCases = [...prevCases];
          const caseIndex = newCases.findIndex(c => c.id === caseId);
          if (caseIndex === -1) return prevCases;

          updatedCase = { ...newCases[caseIndex] };
          
          updatedCase.history.push({ ...newAction, id: `action-${Date.now()}` });
          updatedCase.lastContactDate = newAction.timestamp;
          if (newAction.type === ActionType.PAYMENT_RECEIVED && newAction.amountPaid) {
              const loanIndex = loans.findIndex(l => l.id === updatedCase!.loanId);
              if (loanIndex !== -1) {
                  const updatedLoans = [...loans];
                  updatedLoans[loanIndex] = { ...updatedLoans[loanIndex], currentBalance: updatedLoans[loanIndex].currentBalance - newAction.amountPaid };
                  setLoans(updatedLoans);
              }
          }
          
          newCases[caseIndex] = updatedCase;
          return newCases;
      });
      return { success: true };
  };

  const handleStatusChange = (caseId: string, statuses: { crmStatus: CRMStatus, subStatus: SubStatus, contactStatus: 'Contact' | 'Non Contact', workStatus: 'Work' | 'Non Work' }, notes: string, ptpDetails?: { promisedAmount?: number; promisedDate?: string }): UpdateCaseResult => {
    if (!currentUser) return { success: false };

    // This is now the handler for non-special statuses
    if (statuses.crmStatus === CRMStatus.NIP || statuses.crmStatus === CRMStatus.CLOSED || statuses.subStatus === SubStatus.PAID || statuses.subStatus === SubStatus.PAID_CLOSED || statuses.subStatus === SubStatus.PARTIAL_PAYMENT) {
        console.error("Special statuses should be handled by their dedicated workflows.");
        return { success: false };
    }

    // API mode: send status update to backend
    if (useApi) {
      casesApi.updateStatus(caseId, {
        crmStatus: statuses.crmStatus,
        subStatus: statuses.subStatus,
        contactStatus: statuses.contactStatus,
        workStatus: statuses.workStatus,
        notes,
        promisedAmount: ptpDetails?.promisedAmount,
        promisedDate: ptpDetails?.promisedDate,
      }).catch(console.error);
    }

    setCases(prevCases => {
        const newCases = [...prevCases];
        const caseIndex = newCases.findIndex(c => c.id === caseId);
        if (caseIndex === -1) return prevCases;
        
        const oldCase = newCases[caseIndex];
        const updatedCase = { ...oldCase };
        
        const hasStatusChanged = 
            updatedCase.crmStatus !== statuses.crmStatus || 
            updatedCase.subStatus !== statuses.subStatus ||
            updatedCase.contactStatus !== statuses.contactStatus ||
            updatedCase.workStatus !== statuses.workStatus;

        if (hasStatusChanged) {
            updatedCase.crmStatus = statuses.crmStatus;
            updatedCase.subStatus = statuses.subStatus;
            updatedCase.contactStatus = statuses.contactStatus;
            updatedCase.workStatus = statuses.workStatus;

            updatedCase.auditLog.push({
                id: `log-${Date.now()}`,
                caseId: caseId,
                timestamp: new Date().toISOString(),
                userId: currentUser.id,
                details: `Status changed to ${statuses.crmStatus}/${statuses.subStatus}. Contact: ${statuses.contactStatus}, Work: ${statuses.workStatus}. Note: ${notes}`
            });
        }
        
        if ((notes && notes.trim()) || ptpDetails) {
            const newActionType = hasStatusChanged ? ActionType.STATUS_UPDATE : ActionType.SOFT_CALL;
            const newAction: Action = {
                id: `action-${Date.now()}`,
                caseId: caseId,
                type: newActionType,
                timestamp: new Date().toISOString(),
                officerId: currentUser.id,
                notes: notes,
                nextFollowUp: null,
                ...ptpDetails
            };
            updatedCase.history.unshift(newAction);
            updatedCase.lastContactDate = new Date().toISOString();
        }

        newCases[caseIndex] = updatedCase;
        return newCases;
    });
    showToast(`Action saved: ${statuses.crmStatus}/${statuses.subStatus}`, 'success');
    // Broadcast to other tabs / connected clients
    broadcast({
      type: 'case:updated',
      caseId,
      crmStatus: statuses.crmStatus,
      subStatus: statuses.subStatus,
      officerId: currentUser.id,
      officerName: currentUser.name,
    });
    return { success: true };
  }
  
    const handleInitiateNip = (caseData: EnrichedCase, notes: string) => {
        setModalState({ type: 'NIP', caseData, initialNotes: notes });
        setIsCaseDetailModalOpen(false);
    };

    const handleInitiatePaid = (caseData: EnrichedCase, statuses: any, notes: string) => {
        setModalState({ type: 'PAID', caseData, initialStatuses: statuses, initialNotes: notes });
        setIsCaseDetailModalOpen(false);
    };

    const handleCloseWorkflowModals = () => {
        setModalState({ type: null, caseData: null });
    };

    const handleNipSubmit = (caseId: string, reason: 'not_in_portal' | 'paid_closed', notes: string) => {
        if (reason === 'not_in_portal') {
            setCases(prev => prev.map(c => {
                if (c.id === caseId) {
                    return {
                        ...c,
                        crmStatus: CRMStatus.WITHDRAWN,
                        subStatus: SubStatus.NOT_IN_PORTAL,
                        auditLog: [...c.auditLog, {
                            id: `log-${Date.now()}`,
                            caseId: c.id,
                            timestamp: new Date().toISOString(),
                            userId: currentUser!.id,
                            details: `Case marked as NIP (Not in Portal) by ${currentUser!.name}. Notes: ${notes}`
                        }]
                    };
                }
                return c;
            }));
            handleCloseWorkflowModals();
        } else { // 'paid_closed'
             handleInitiatePaid(modalState.caseData!, modalState.initialStatuses, notes);
        }
    };

    const handlePaymentSubmit = (caseId: string, data: LogPaymentSubmitData) => {
        if (!currentUser) return;

        setCases(prevCases => {
            const newCases = [...prevCases];
            const caseIndex = newCases.findIndex(c => c.id === caseId);
            if (caseIndex === -1) return prevCases;

            const oldCase = newCases[caseIndex];
            const oldLoan = loans.find(l => l.id === oldCase.loanId)!;

            const newAction: Action = {
                id: `action-${Date.now()}`,
                caseId: caseId,
                type: ActionType.PAYMENT_RECEIVED,
                timestamp: new Date().toISOString(),
                attributionDate: new Date().toISOString(),
                officerId: currentUser.id,
                notes: data.notes,
                nextFollowUp: null,
                amountPaid: data.amountPaid,
                outstandingBalanceBeforePayment: oldLoan.currentBalance,
                paymentType: data.paymentType,
                confirmationMethod: data.confirmationMethod,
                receipt: data.receipt,
                settlementLetter: data.settlementLetter,
            };

            const isPartialPayment = data.finalSubStatus === SubStatus.PARTIAL_PAYMENT;
            const isClosingPayment = !isPartialPayment;
            
            const updatedCase = {
                ...oldCase,
                crmStatus: isClosingPayment ? CRMStatus.CLOSED : modalState.initialStatuses!.crmStatus,
                subStatus: isClosingPayment ? data.finalSubStatus : SubStatus.FOLLOW_UP,
                history: [newAction, ...oldCase.history],
                auditLog: [...oldCase.auditLog, {
                    id: `log-${Date.now()}`,
                    caseId: caseId,
                    timestamp: new Date().toISOString(),
                    userId: currentUser.id,
                    details: isPartialPayment
                        ? `Partial payment of ${formatCurrency(data.amountPaid, oldLoan.currency)} logged. Case status set to ${modalState.initialStatuses!.crmStatus}/Follow Up.`
                        : `Payment of ${formatCurrency(data.amountPaid, oldLoan.currency)} logged. Case status set to CLOSED/${data.finalSubStatus}.`
                }]
            };

            newCases[caseIndex] = updatedCase;

            setLoans(prevLoans => prevLoans.map(l =>
                l.id === oldCase.loanId
                    ? { ...l, currentBalance: l.currentBalance - data.amountPaid }
                    : l
            ));

            return newCases;
        });

        handleCloseWorkflowModals();
    };

    const handleVerifyPayment = (caseId: string, actionId: string) => {
        if (!currentUser || currentUser.role !== Role.FINANCE) return;

        if (useApi) {
          actionsApi.verifyPayment(actionId).catch(console.error);
        }

        setCases(prevCases => {
            const newCases = [...prevCases];
            const caseIndex = newCases.findIndex(c => c.id === caseId);
            if (caseIndex === -1) return prevCases;

            const updatedCase = { ...newCases[caseIndex] };
            const historyIndex = updatedCase.history.findIndex(h => h.id === actionId);
            if (historyIndex === -1) return prevCases;

            const updatedHistory = [...updatedCase.history];
            const paymentAction = updatedHistory[historyIndex];

            updatedHistory[historyIndex] = {
                ...paymentAction,
                paymentVerifiedByFinanceAt: new Date().toISOString()
            };

            updatedCase.history = updatedHistory;
            updatedCase.auditLog.push({
                id: `log-verify-${Date.now()}`,
                caseId: caseId,
                timestamp: new Date().toISOString(),
                userId: currentUser.id,
                details: `Payment of ${formatCurrency(paymentAction.amountPaid, loans.find(l => l.id === updatedCase.loanId)?.currency)} (Action ID: ${actionId}) verified by ${currentUser.name}.`
            });
            
            newCases[caseIndex] = updatedCase;
            return newCases;
        });
    };

  const handleUpdateCaseDetails = (caseId: string, debtorDetails: Partial<Debtor>, loanDetails: Partial<Loan>) => {
    const caseToUpdate = cases.find(c => c.id === caseId);
    if (!caseToUpdate) return;

    if (useApi) {
      if (Object.keys(debtorDetails).length > 0) {
        debtorsApi.update(caseToUpdate.debtorId, debtorDetails).catch(console.error);
      }
      if (Object.keys(loanDetails).length > 0) {
        loansApi.update(caseToUpdate.loanId, loanDetails).catch(console.error);
      }
    }

    setDebtors(prev => prev.map(d => d.id === caseToUpdate.debtorId ? {...d, ...debtorDetails} : d));
    setLoans(prev => prev.map(l => l.id === caseToUpdate.loanId ? {...l, ...loanDetails} : l));
  };


  const handleReassign = (caseIds: string[], newOfficerId: string) => {
    if (!currentUser) return;
    const newOfficer = users.find(u => u.id === newOfficerId);
    if (!newOfficer) return;

    const firstCase = cases.find(c => c.id === caseIds[0]);
    const isInitialAssignment = firstCase && (firstCase.assignedOfficerId === UNASSIGNED_USER.id || firstCase.statusCode === 'UNASSIGNED');

    if (useApi) {
      // API mode: call backend
      casesApi.bulkReassign(caseIds, newOfficerId).catch(console.error);
      allocationsApi.allocate({
        recipientId: newOfficerId,
        caseIds,
        type: isInitialAssignment ? 'Initial Assignment' : 'Re-Assignment',
      }).catch(console.error);
    }

    // Update local state immediately (optimistic)
    setCases(prev => prev.map(c => {
        if (caseIds.includes(c.id)) {
            return {
                ...c,
                assignedOfficerId: newOfficerId,
                statusCode: 'RE-ASSIGN',
                auditLog: [...c.auditLog, {
                    id: `log-${Date.now()}`,
                    caseId: c.id,
                    timestamp: new Date().toISOString(),
                    userId: currentUser.id,
                    details: `Case reassigned to ${newOfficer.name} by ${currentUser.name}.`
                }]
            };
        }
        return c;
    }));
     const newLogEntry: AllocationLogEntry = {
        id: `alloc-${Date.now()}`,
        timestamp: new Date().toISOString(),
        allocatorId: currentUser.id,
        recipientId: newOfficerId,
        caseIds: caseIds,
        count: caseIds.length,
        type: isInitialAssignment ? 'Initial Assignment' : 'Re-Assignment'
    };
    setAllocationLog(prev => [newLogEntry, ...prev]);
  };

  const handleReactivateCase = (caseId: string, newOfficerId: string) => {
    if (!currentUser) return;
    setCases(prev => prev.map(c => {
        if (c.id === caseId) {
            return {
                ...c,
                crmStatus: CRMStatus.CB,
                subStatus: SubStatus.NONE,
                assignedOfficerId: newOfficerId,
                statusCode: 'Inactive to Active',
            }
        }
        return c;
    }));
    const newLogEntry: AllocationLogEntry = {
        id: `alloc-reactivate-${Date.now()}`,
        timestamp: new Date().toISOString(),
        allocatorId: currentUser.id,
        recipientId: newOfficerId,
        caseIds: [caseId],
        count: 1,
        type: 'Re-Activation',
    };
    setAllocationLog(prev => [newLogEntry, ...prev]);
  };

  const handleBulkReactivate = (caseIds: string[], newOfficerId: string) => {
    if (!currentUser) return;
    setCases(prev => prev.map(c => {
        if (caseIds.includes(c.id) && c.crmStatus === CRMStatus.WITHDRAWN) {
             return {
                ...c,
                crmStatus: CRMStatus.CB,
                subStatus: SubStatus.NONE,
                assignedOfficerId: newOfficerId,
                statusCode: 'Inactive to Active',
            }
        }
        return c;
    }));
    const newLogEntry: AllocationLogEntry = {
        id: `alloc-bulk-reactivate-${Date.now()}`,
        timestamp: new Date().toISOString(),
        allocatorId: currentUser.id,
        recipientId: newOfficerId,
        caseIds: caseIds,
        count: caseIds.length,
        type: 'Re-Activation',
    };
    setAllocationLog(prev => [newLogEntry, ...prev]);
  };

  const handleBulkInactive = (caseIds: string[]) => {
    setCases(prev => prev.map(c => {
        if (caseIds.includes(c.id)) {
            return { ...c, crmStatus: CRMStatus.WITHDRAWN, subStatus: SubStatus.BANK_RECALL };
        }
        return c;
    }));
  };

  const handleConfirmWithdrawal = (caseId: string) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, crmStatus: CRMStatus.WITHDRAWN, subStatus: SubStatus.BANK_RECALL } : c));
  }
  
  const handleAddCase = (data: { debtor: Omit<Debtor, 'id'>, loan: Omit<Loan, 'id' | 'debtorId'>, caseInfo: { assignedOfficerId: string } }): boolean => {
    const newDebtorId = `debtor-${Date.now()}`;
    const newLoanId = `loan-${Date.now()}`;
    const newCaseId = `case-${Date.now()}`;

    const newDebtor: Debtor = { ...data.debtor, id: newDebtorId };
    const newLoan: Loan = { ...data.loan, id: newLoanId, debtorId: newDebtorId };
    const newCase: Case = {
        id: newCaseId,
        debtorId: newDebtorId,
        loanId: newLoanId,
        assignedOfficerId: data.caseInfo.assignedOfficerId,
        crmStatus: CRMStatus.CB,
        subStatus: SubStatus.NONE,
        creationDate: new Date().toISOString(),
        lastContactDate: new Date().toISOString(),
        contactStatus: 'Non Contact',
        workStatus: 'Work',
        tracingStatus: 'Tracing Not Avail',
        statusCode: 'NEW',
        cyber: 'No',
        history: [{
            id: `act-${Date.now()}`,
            caseId: newCaseId,
            type: ActionType.CASE_CREATED,
            timestamp: new Date().toISOString(),
            officerId: currentUser!.id,
            notes: 'Case created manually.',
            nextFollowUp: null,
        }],
        auditLog: [],
    };

    setDebtors(prev => [...prev, newDebtor]);
    setLoans(prev => [...prev, newLoan]);
    setCases(prev => [...prev, newCase]);

    if (data.caseInfo.assignedOfficerId !== UNASSIGNED_USER.id) {
         const newLogEntry: AllocationLogEntry = {
            id: `alloc-create-${Date.now()}`,
            timestamp: new Date().toISOString(),
            allocatorId: currentUser!.id,
            recipientId: data.caseInfo.assignedOfficerId,
            caseIds: [newCaseId],
            count: 1,
            type: 'Initial Assignment',
        };
        setAllocationLog(prev => [newLogEntry, ...prev]);
    }

    setIsAddCaseModalOpen(false);
    alert('Case created successfully!');
    return true;
  };
  
  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setIsCaseDetailModalOpen(true);
  };

  const handleGlobalSearch = (term: string) => {
    setActiveView('cases');
    setNavFilters({ globalSearch: term });
  };

  const handleRequestHelp = (query: string) => {
    if (!currentUser) return;
    if (useApi) {
      helpRequestsApi.create(query).catch(console.error);
    }
    setHelpRequests(prev => [...prev, {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        timestamp: new Date().toISOString(),
        query,
        status: 'pending'
    }]);
    alert("Your help request has been sent to the administrators.");
  };

  const handleResolveHelpRequest = (userId: string) => {
    const request = helpRequests.find(req => req.userId === userId && req.status === 'pending');
    
    setHelpRequests(prev => prev.map(req => 
        req.userId === userId && req.status === 'pending'
        ? { ...req, status: 'resolved', resolvedBy: currentUser!.id, resolvedAt: new Date().toISOString() }
        : req
    ));

    if (request) {
        handleSendNotification(
            request.userId,
            `Your help request has been resolved by ${currentUser!.name}. Query: "${request.query.substring(0, 50)}..."`,
            'Normal',
            false
        );
    }
  };
  
  const handleAdminReply = (userId: string, message: string) => {
    setHelpRequests(prev => prev.map(req => {
        if (req.userId === userId) {
            const reply = {
                adminName: currentUser!.name,
                message,
                timestamp: new Date().toISOString()
            };
            return { ...req, adminReplies: [...(req.adminReplies || []), reply] };
        }
        return req;
    }));
  };
  
   const handleSendNotification = (recipientId: string, message: string, priority: 'Normal' | 'Urgent', isTask: boolean) => {
        if (useApi) {
          notificationsApi.create({ recipientId, message, priority, isTask }).catch(console.error);
        }
        const newNotification: Notification = {
            id: `notif-${Date.now()}`,
            senderId: currentUser!.id,
            senderName: currentUser!.name,
            recipientId,
            message,
            timestamp: new Date().toISOString(),
            status: 'unread',
            priority,
            isTask,
            taskStatus: isTask ? 'pending' : undefined,
        };
        setNotifications(prev => [...prev, newNotification]);
        broadcast({ type: 'notification:new', id: newNotification.id, senderId: newNotification.senderId, senderName: newNotification.senderName, recipientId, message, priority });
    };

    const handleMarkNotificationAsRead = (notificationId: string) => {
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, status: 'read' } : n));
    };

    const handleUpdateTaskStatus = (notificationId: string, taskStatus: 'pending' | 'done') => {
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, taskStatus, status: 'read' } : n));
    };

    const handleReplyToNotification = (notificationId: string, replyMessage: string) => {
        setNotifications(prev => prev.map(n => {
            if (n.id === notificationId) {
                const newReply: NotificationReply = {
                    id: `reply-${Date.now()}`,
                    senderId: currentUser!.id,
                    senderName: currentUser!.name,
                    message: replyMessage,
                    timestamp: new Date().toISOString(),
                };
                return { ...n, replies: [...(n.replies || []), newReply] };
            }
            return n;
        }));
    };
    
    // Add/Remove/Update User
    const handleAddUser = (name: string, role: Role, password: string, target?: number) => {
      if (useApi) {
        usersApi.create({ name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@crm.com`, password, role, target })
          .then(res => setUsers(prev => [...prev, { ...res.data, password }]))
          .catch(console.error);
        return;
      }
      const newUser: User = { id: `user-${Date.now()}`, name, role, password, target };
      setUsers(prev => [...prev, newUser]);
    };
    const handleRemoveUser = (userId: string) => {
      if (useApi) {
        usersApi.deactivate(userId).catch(console.error);
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
      setCases(prev => prev.map(c => c.assignedOfficerId === userId ? { ...c, assignedOfficerId: UNASSIGNED_USER.id, statusCode: 'UNASSIGNED' } : c));
    };
    const handleUpdateUser = (userId: string, updatedData: Partial<User>) => {
      if (useApi) {
        usersApi.update(userId, updatedData).catch(console.error);
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updatedData } : u));
    };
    
    const renderView = () => {
    switch (activeView) {
      case 'dashboard-officer': return <AgentDashboard currentUser={currentUser!} allCases={enrichedCases} onSelectCase={handleSelectCase} />;
      case 'dashboard-manager': return <ManagerDashboard allCases={enrichedCases} coordinators={coordinators} onOpenSendNotificationModal={() => setIsSendNotificationModalOpen(true)} />;
      case 'dashboard-ceo': return <CEODashboard allCases={enrichedCases} coordinators={coordinators} onOpenSendNotificationModal={() => setIsSendNotificationModalOpen(true)} />;
      case 'dashboard-accountant': return <FinanceDashboard allCases={enrichedCases} coordinators={coordinators} onVerifyPayment={handleVerifyPayment} currentUser={currentUser!} />;
      case 'cases': return <OfficerDashboard cases={enrichedCases} onSelectCase={handleSelectCase} currentUser={currentUser!} onAddCase={() => setIsAddCaseModalOpen(true)} onImportCases={() => setIsImportCasesModalOpen(true)} filters={navFilters} clearFilters={clearFilters} coordinators={coordinators} onBulkInactive={handleBulkInactive} onReassign={handleReassign} onQuickLog={(caseId, crm, sub, contact, work, note) => handleStatusChange(caseId, { crmStatus: crm, subStatus: sub, contactStatus: contact, workStatus: work }, note)} />;
      case 'team': return <TeamAllocationView cases={enrichedCases} coordinators={coordinators} onSelectCase={handleSelectCase} onReassign={handleReassign} />;
      case 'new-allocations': return <NewAllocationsView cases={enrichedCases.filter(c => c.assignedOfficerId === currentUser?.id && (c.statusCode === 'NEW' || c.statusCode === 'RE-ASSIGN'))} onSelectCase={handleSelectCase} />;
      case 'withdrawn-cases': return <WithdrawnCasesView cases={enrichedCases} coordinators={coordinators} onReactivate={handleReactivateCase} onSelectCase={handleSelectCase} currentUser={currentUser!} onBulkReactivate={handleBulkReactivate} />;
      case 'pending-withdrawals': return <PendingWithdrawalsView cases={enrichedCases} onConfirmWithdrawal={handleConfirmWithdrawal} />;
      case 'users': return <UserManagementView users={users} cases={enrichedCases} onAddUser={handleAddUser} onRemoveUser={handleRemoveUser} onUpdateUser={handleUpdateUser} currentUser={currentUser!} />;
      case 'daily-report': return <DailySummaryReport cases={enrichedCases} coordinators={currentUser!.role === Role.OFFICER ? [currentUser!] : coordinators} date={new Date().toISOString().split('T')[0]} setDate={() => {}} onSelectOfficer={() => {}} getDailySummaryAI={async () => "AI summary is a future feature."} onSelectCase={handleSelectCase} />;
      case 'payments': return <PaymentsView cases={enrichedCases} currentUser={currentUser!} onVerifyPayment={handleVerifyPayment} />;
      case 'system-audit': return <AdminAuditView loginHistory={loginHistory} users={users} />;
      case 'help-requests': return <HelpRequestsView helpRequests={helpRequests} onResolveHelpRequest={handleResolveHelpRequest} users={users} onAdminReply={handleAdminReply} />;
      case 'notification-center': return <NotificationCenterView notifications={notifications} users={users} currentUser={currentUser!} />;
      case 'dashboard-officer-summary': return <OfficerSummaryDashboard coordinators={coordinators} cases={enrichedCases} />;
      case 'annual-forecast': return <AnnualForecastReport cases={enrichedCases} coordinators={coordinators} />;
      case 'portfolio-aging': return <RecoveryFunnelReport allCases={enrichedCases} coordinators={coordinators} />;
      case 'status-matrix': return <StatusMatrixReport cases={enrichedCases} coordinators={coordinators} />;
      case 'allocation-report': return <AllocationReportView allocationLog={allocationLog} users={users} onOpenImportModal={() => setIsImportCasesModalOpen(true)} cases={enrichedCases} />;
      case 'ai-insights': return <AiPortfolioDashboard allCases={enrichedCases} onSelectCase={handleSelectCase} />;
      case 'ai-forecast': return <ForecastChart allCases={enrichedCases} />;
      case 'ceo-command': return <CEOAdvancedDashboard allCases={enrichedCases} coordinators={coordinators} onSelectCase={handleSelectCase} />;
      case 'hr-dashboard': return <HRDashboard users={users} currentUser={currentUser!} />;
      case 'attendance-portal': return <AttendancePortal currentUser={currentUser!} allUsers={users} />;
      case 'productivity': return <ProductivityDashboard currentUser={currentUser!} />;
      case 'portfolio-intelligence': return <PortfolioIntelligence allCases={enrichedCases} coordinators={coordinators} onSelectCase={handleSelectCase} />;
      case 'portfolio-aging-ai': return <PortfolioAgingDashboard allCases={enrichedCases} />;
      case 'summary-report': return <SummaryWiseReport allCases={enrichedCases} coordinators={coordinators} onSelectCase={handleSelectCase} />;
      case 'kanban': return <KanbanBoard cases={enrichedCases} onSelectCase={handleSelectCase} currentUser={currentUser!} />;
      case 'promise-dashboard': return <PromiseDashboard allCases={enrichedCases} coordinators={coordinators} onSelectCase={handleSelectCase} />;
      case 'commission': return <CommissionCalculator allCases={enrichedCases} coordinators={coordinators} />;
      case 'bank-drafts': return <BankDraftTracker cases={enrichedCases} currentUser={currentUser!} onSelectCase={handleSelectCase} />;
      case 'liability-emails': return <LiabilityEmail cases={enrichedCases} currentUser={currentUser!} onSelectCase={handleSelectCase} />;
      case 'workflow-automation': return <WorkflowAutomation currentUserRole={currentUser!.role} />;
      case 'work-queue': return <WorkQueue cases={enrichedCases} currentUser={currentUser!} onSelectCase={handleSelectCase} />;
      case 'debtor-portal': return <DebtorPortal cases={enrichedCases} currentUser={currentUser!} />;
      case 'custom-reports': return <CustomReportBuilder cases={enrichedCases} coordinators={coordinators} currentUser={currentUser!} />;
      case 'tracing-tools': return <OfficerDashboard cases={enrichedCases.filter(c => c.assignedOfficerId === currentUser!.id && (c.tracingStatus === 'Tracing Not Avail' || c.tracingStatus === 'Under Tracing'))} onSelectCase={handleSelectCase} currentUser={currentUser!} onAddCase={() => {}} onImportCases={() => {}} filters={{}} clearFilters={() => {}} coordinators={coordinators} onBulkInactive={() => {}} onReassign={() => {}} />;

      // Placeholder views
      case 'search': return <CaseSearchView allCases={enrichedCases} coordinators={coordinators} onSelectCase={handleSelectCase} currentUser={currentUser!} />;
      default: return <PlaceholderView title={activeView} />;
    }
  };

  if (authLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center p-4">
        <div className="text-text-secondary text-lg">Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  // Attendance enforcement gate — Officers must check in before accessing CRM
  if (!hasCheckedIn && currentUser.role === Role.OFFICER) {
    return <AttendancePopup currentUser={currentUser} onCheckIn={(wasLate?: boolean) => {
      setHasCheckedIn(true);
      // Auto-notify managers if officer was late
      if (wasLate) {
        const managers = users.filter(u => u.role === Role.MANAGER || u.role === Role.ADMIN);
        managers.forEach(mgr => {
          handleSendNotification(
            mgr.id,
            `Late check-in: ${currentUser.name} checked in at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
            'Urgent',
            false
          );
        });
      }
    }} />;
  }

  // Attendance enforcement gate (API mode only)
  if (useApi && !hasCheckedIn) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1B2A4A 0%, #2D4470 50%, #1B2A4A 100%)' }}>
        <div className="panel p-10 max-w-md text-center space-y-5 animate-fade-in-up" style={{ background: 'white' }}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full animate-float" style={{ background: '#F28C28' }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-extrabold" style={{ color: '#1B2A4A' }}>{checkingIn ? 'Marking Attendance...' : 'Good Morning!'}</h2>
            <p className="text-sm text-text-secondary mt-1">
              {checkingIn ? 'Please wait while we record your check-in' : `Welcome, ${currentUser.name}. Please check in to start your day.`}
            </p>
          </div>
          <div className="text-3xl font-bold font-mono" style={{ color: '#1B2A4A' }}>
            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </div>
          <p className="text-xs text-text-tertiary">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          {!checkingIn && (
            <button
              onClick={() => {
                setCheckingIn(true);
                apiClient.post('/api/hr/attendance/check-in')
                  .then(() => setHasCheckedIn(true))
                  .catch(() => setHasCheckedIn(true))
                  .finally(() => setCheckingIn(false));
              }}
              className="px-8 py-3 text-sm font-bold rounded-lg text-white transition-all hover:scale-105"
              style={{ background: '#F28C28' }}
            >
              Check In Now
            </button>
          )}
          <p className="text-xs text-text-tertiary">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' — '}
            {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AiCopilot allCases={enrichedCases} coordinators={coordinators} onSelectCase={handleSelectCase} currentUser={currentUser!} />
      <Layout
        currentUser={currentUser}
        onLogout={handleLogout}
        navItems={SIDEBAR_NAV_ITEMS}
        activeView={activeView}
        setActiveView={setActiveView}
        onHomeClick={() => {
            const firstView = SIDEBAR_NAV_ITEMS.find(i => i.view && i.roles?.includes(currentUser.role))?.view || 'dashboard';
            setActiveView(firstView);
        }}
        helpRequests={helpRequests}
        onRequestHelp={handleRequestHelp}
        onResolveHelpRequest={handleResolveHelpRequest}
        onGlobalSearch={handleGlobalSearch}
        theme={theme}
        setTheme={setTheme}
        notifications={notifications}
        onMarkNotificationAsRead={handleMarkNotificationAsRead}
        onUpdateTaskStatus={handleUpdateTaskStatus}
        onReplyToNotification={handleReplyToNotification}
        isLive={isLive}
        onCheckOut={handleCheckOut}
      >
        {renderView()}
      </Layout>
      {isAddCaseModalOpen && <AddCaseModal isOpen={isAddCaseModalOpen} onClose={() => setIsAddCaseModalOpen(false)} onSubmit={handleAddCase} coordinators={coordinators} allCases={enrichedCases} currentUser={currentUser} />}
      {isImportCasesModalOpen && <ImportCasesModal isOpen={isImportCasesModalOpen} onClose={() => setIsImportCasesModalOpen(false)} onImport={() => alert('Import logic not implemented yet.')} instructions="Please ensure your file has the following columns: Sr no, Account No, Case Name, Product, Sub-Product, Bank, Remaining OS, Case Status Code, BucketRecovery, Type" fileType=".csv, .txt" />}
      {isSendNotificationModalOpen && <SendNotificationModal isOpen={isSendNotificationModalOpen} onClose={() => setIsSendNotificationModalOpen(false)} onSend={handleSendNotification} coordinators={coordinators} />}
      
      {isCaseDetailModalOpen && selectedCaseData && selectedCaseData.debtor && selectedCaseData.loan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start p-3 pt-6 animate-fade-in-up" style={{ animationDuration: '0.15s' }} onClick={() => { setIsCaseDetailModalOpen(false); setSelectedCaseId(null); }}>
            <div className="bg-[var(--color-bg-secondary)] w-full max-w-7xl h-[92vh] flex flex-col rounded-2xl shadow-2xl border border-[var(--color-border)]" onClick={e => e.stopPropagation()}>
                {/* === HEADER: Name + Account + Status + Close === */}
                <div className="flex justify-between items-center px-5 py-3 flex-shrink-0 bg-[var(--color-sidebar-bg)] border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {selectedCaseData.debtor.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-white truncate">{selectedCaseData.debtor.name}</h2>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span>A/C: <strong className="text-gray-300">{selectedCaseData.loan.accountNumber}</strong></span>
                                <span>|</span>
                                <span>{selectedCaseData.loan.bank} - {selectedCaseData.loan.product}</span>
                                <span>|</span>
                                <span className="text-orange-400 font-bold">{formatCurrency(selectedCaseData.loan.currentBalance, selectedCaseData.loan.currency)}</span>
                                {currentUser.role !== Role.OFFICER && (
                                    <>
                                        <span>|</span>
                                        <span>Officer: <strong className="text-gray-300">{selectedCaseData.officer.name}</strong></span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${getStatusPillClasses(selectedCaseData.crmStatus)}`}>
                            {selectedCaseData.crmStatus}
                        </span>
                        {selectedCaseData.subStatus && (
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${getSubStatusPillClasses(selectedCaseData.subStatus)}`}>
                                {selectedCaseData.subStatus}
                            </span>
                        )}
                        <div className="w-px h-6 bg-white/10 mx-1" />
                        <button onClick={() => navigateCase('prev')} title="Previous case (←)" className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition text-xs">←</button>
                        <button onClick={() => navigateCase('next')} title="Next case (→)" className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition text-xs">→</button>
                        <div className="w-px h-6 bg-white/10 mx-1" />
                        <button onClick={() => { setIsCaseDetailModalOpen(false); setSelectedCaseId(null); }} title="Close (Esc)" className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition">
                            {ICONS.close('h-4 w-4')}
                        </button>
                    </div>
                </div>

                {/* === BODY: 3-panel layout === */}
                {/* Single scrollable content area */}
                <div className="flex-1 overflow-y-auto">
                    <CaseDetailView
                        caseData={selectedCaseData}
                        allCases={enrichedCases}
                        onClose={() => { setIsCaseDetailModalOpen(false); setSelectedCaseId(null); }}
                        onUpdateCase={handleUpdateCase}
                        onUpdateCaseDetails={handleUpdateCaseDetails}
                        currentUser={currentUser!}
                        onStatusChange={handleStatusChange}
                        coordinators={coordinators}
                        onReassign={handleReassign}
                        users={users}
                        onInitiateNip={handleInitiateNip}
                        onInitiatePaid={handleInitiatePaid}
                        onAutoAdvance={() => navigateCase('next')}
                    />
                    {/* Tracing + AI — below remarks in same scroll */}
                    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                            {currentUser!.role !== Role.CEO && currentUser!.role !== Role.FINANCE && (
                                <TracingPanel caseData={selectedCaseData} currentUser={currentUser!} allCases={enrichedCases} />
                            )}
                            <AiInsightsPanel caseData={selectedCaseData} currentUser={currentUser!} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
        {modalState.type === 'NIP' && modalState.caseData && (
            <NipWorkflowModal 
                isOpen={true}
                onClose={handleCloseWorkflowModals}
                onSubmit={handleNipSubmit}
                caseData={modalState.caseData}
                initialNotes={modalState.initialNotes || ''}
            />
        )}
         {modalState.type === 'PAID' && modalState.caseData && (
            <LogPaymentModal 
                isOpen={true}
                onClose={handleCloseWorkflowModals}
                onSubmit={handlePaymentSubmit}
                caseData={modalState.caseData}
                initialNotes={modalState.initialNotes}
                initialSubStatus={modalState.initialStatuses?.subStatus}
            />
        )}
    {/* === SESSION TIMEOUT WARNING === */}
    {showIdleWarning && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] flex items-center justify-center p-4 animate-fade-in">
        <div className="panel p-8 max-w-sm text-center space-y-4 animate-fade-in-up" style={{ background: 'var(--glass-bg)' }}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary">Session Expiring</h3>
            <p className="text-sm text-text-secondary mt-1">You will be logged out in <strong className="text-amber-600">2 minutes</strong> due to inactivity.</p>
          </div>
          <button
            onClick={() => setShowIdleWarning(false)}
            className="px-6 py-2.5 text-sm font-bold rounded-lg text-white transition-all hover:scale-105"
            style={{ background: 'var(--color-accent)' }}
          >
            I'm Still Here
          </button>
        </div>
      </div>
    )}
    {/* === GLOBAL TOAST NOTIFICATION === */}
    {toast && (
      <div className={`fixed bottom-5 right-5 z-[9999] px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white animate-fade-in-up flex items-center gap-2 ${
        toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
      }`} style={{ animationDuration: '0.2s' }}>
        {toast.type === 'success' && <span>✓</span>}
        {toast.type === 'error' && <span>✕</span>}
        {toast.type === 'info' && <span>ℹ</span>}
        {toast.message}
      </div>
    )}
    </>
  );
};

// Error Boundary wrapper
class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: string }, { hasError: boolean; error?: Error }> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <p className="text-red-500 font-bold">Something went wrong in {this.props.fallback || 'this section'}.</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-2">{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })} className="mt-3 btn-secondary px-4 py-2 text-sm">Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default App;