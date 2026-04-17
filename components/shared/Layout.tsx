import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, NavItem as NavItemType, Role, HelpRequest, Notification } from '../../types';
import { ICONS } from '../../constants';
import Avatar from './Avatar';
import ToggleSwitch from './ToggleSwitch';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  onLogout: () => void;
  navItems: NavItemType[];
  activeView: string;
  setActiveView: (view: string) => void;
  onHomeClick: () => void;
  helpRequests: HelpRequest[];
  onRequestHelp: (query: string) => void;
  onResolveHelpRequest: (userId: string) => void;
  onGlobalSearch: (term: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  notifications: Notification[];
  onMarkNotificationAsRead: (notificationId: string) => void;
  onUpdateTaskStatus: (notificationId: string, taskStatus: 'pending' | 'done') => void;
  onReplyToNotification: (notificationId: string, replyMessage: string) => void;
  isLive?: boolean;
  onCheckOut?: () => void;
}

const NavItem: React.FC<{
    item: NavItemType, 
    activeView: string, 
    setActiveView: (view: string) => void
}> = ({ item, activeView, setActiveView }) => {
    if (item.isHeading) {
        return <h3 className="px-4 pt-4 pb-2 text-xs font-bold uppercase text-text-secondary/60 tracking-wider">{item.label}</h3>
    }
    
    const hasChildren = useMemo(() => item.children && item.children.length > 0, [item.children]);
    const isChildActive = useMemo(() => {
        if (!hasChildren) return false;
        return item.children!.some(child => child.view === activeView);
    }, [hasChildren, item.children, activeView]);

    const [isOpen, setIsOpen] = useState(isChildActive);

    useEffect(() => {
        if (isChildActive) {
            setIsOpen(true);
        }
    }, [isChildActive]);

    const isDirectlyActive = activeView === item.view;
    const isActive = isDirectlyActive || isChildActive;

    const handleClick = () => {
        if (hasChildren) {
            setIsOpen(prev => !prev);
        } else if (item.view) {
            setActiveView(item.view);
        }
    };

    const iconClasses = `h-5 w-5 mr-3 shrink-0 ${isActive ? 'text-[var(--color-sidebar-active)]' : 'text-[var(--color-sidebar-text)] group-hover:text-white'}`;

    return (
        <li className="my-0.5 px-2">
            <button
                onClick={handleClick}
                className={`w-full flex items-center px-3 py-2 text-[13px] font-medium rounded-lg text-left transition-colors duration-150 group relative ${isActive ? 'text-white font-semibold bg-white/10' : 'text-[var(--color-sidebar-text)] hover:text-white hover:bg-white/5'}`}
            >
               {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--color-sidebar-active)]"></div>}
                {item.icon && item.icon(iconClasses)}
                <span className="flex-grow">{item.label}</span>
                {hasChildren && ICONS.chevronDown(`w-4 h-4 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`)}
            </button>
            {hasChildren && isOpen && (
                 <ul className="pl-6 py-1 ml-2 mt-1 space-y-0.5 border-l border-white/10">
                    {item.children!.map((child, index) => {
                         const isChildLinkActive = activeView === child.view;
                        return (
                             <li key={index}>
                                <button
                                    onClick={() => child.view && setActiveView(child.view)}
                                    className={`w-full text-left px-3 py-1.5 text-[12px] rounded-lg flex items-center transition-colors duration-150 ${
                                        isChildLinkActive
                                        ? 'text-[var(--color-sidebar-active)] font-semibold'
                                        : 'text-[var(--color-sidebar-text)] hover:text-white'
                                    }`}
                                >
                                {child.label}
                                </button>
                             </li>
                        );
                    })}
                </ul>
            )}
        </li>
    )
}

const Sidebar: React.FC<{
    navItems: NavItemType[], 
    activeView: string, 
    setActiveView: (view: string) => void,
    onHomeClick: () => void,
    currentUser: User,
    onRequestHelp: () => void,
}> = ({ navItems, activeView, setActiveView, onHomeClick, currentUser, onRequestHelp}) => {
    
    const filteredNavItems = useMemo(() => {
        const filterItems = (items: NavItemType[]): NavItemType[] => {
            return items
                .filter(item => !item.roles || item.roles.includes(currentUser.role))
                .map(item => {
                    if (item.children) {
                        return { ...item, children: filterItems(item.children) };
                    }
                    return item;
                })
                .filter(item => !item.children || item.children.length > 0);
        };
        return filterItems(navItems);
    }, [navItems, currentUser.role]);

    return (
        <>
             <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
                <button onClick={onHomeClick} className="flex items-center space-x-2.5">
                    <div className="p-1.5 rounded-lg bg-[var(--color-sidebar-active)]">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.85 0 3.58-.5 5.07-1.38" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M8 12l3 3 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    <span className="text-sm font-extrabold tracking-tight text-white">
                        Reco<span className="text-[var(--color-sidebar-active)]">V</span>antage
                    </span>
                </button>
              </div>
            <nav className="flex-1 py-2 overflow-y-auto">
                <ul>
                    {filteredNavItems.map((item, index) => (
                        <NavItem key={index} item={item} activeView={activeView} setActiveView={setActiveView} />
                    ))}
                </ul>
            </nav>
            <div className="p-3 border-t border-white/10">
              <button onClick={onRequestHelp} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-[var(--color-sidebar-text)] hover:text-white hover:bg-white/5 transition-colors duration-150">
                {ICONS.help('w-4 h-4')}
                <span>Request Assistance</span>
              </button>
            </div>
        </>
    );
}

const Header: React.FC<{
    currentUser: User,
    onLogout: () => void,
    onGlobalSearch: (term: string) => void;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    onToggleSidebar: () => void;
    notifications: Notification[];
    helpRequests: HelpRequest[];
    onResolveHelpRequest: (userId: string) => void;
    onMarkNotificationAsRead: (notificationId: string) => void;
    onUpdateTaskStatus: (notificationId: string, taskStatus: 'pending' | 'done') => void;
    onReplyToNotification: (notificationId: string, replyMessage: string) => void;
    isLive?: boolean;
    onCheckOut?: () => void;
}> = ({ currentUser, onLogout, onGlobalSearch, theme, setTheme, onToggleSidebar, notifications, helpRequests, onResolveHelpRequest, onMarkNotificationAsRead, onUpdateTaskStatus, onReplyToNotification, isLive, onCheckOut }) => {
    const [showHelpRequests, setShowHelpRequests] = useState(false);
    const [showOfficerNotifications, setShowOfficerNotifications] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [replyMessages, setReplyMessages] = useState<Record<string, string>>({});

    const profileRef = useRef<HTMLDivElement>(null);
    const helpRequestsRef = useRef<HTMLDivElement>(null);
    const officerNotificationsRef = useRef<HTMLDivElement>(null);
    
    const isAdmin = currentUser.role === Role.ADMIN;
    
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onGlobalSearch(globalSearchTerm);
        setGlobalSearchTerm('');
    };
    
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) setIsProfileOpen(false);
            if (helpRequestsRef.current && !helpRequestsRef.current.contains(event.target as Node)) setShowHelpRequests(false);
            if (officerNotificationsRef.current && !officerNotificationsRef.current.contains(event.target as Node)) setShowOfficerNotifications(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    const notificationStats = useMemo(() => {
        const pending = helpRequests.filter(r => r.status === 'pending');
        const today = new Date().toISOString().split('T')[0];
        const resolvedByMeToday = helpRequests.filter(r => 
            r.status === 'resolved' && 
            r.resolvedBy === currentUser.id && 
            r.resolvedAt?.startsWith(today)
        ).length;
        return { pending, resolvedByMeToday };
    }, [helpRequests, currentUser.id]);

    const officerNotifications = useMemo(() => {
        return notifications.filter(n => (n.recipientId === currentUser.id || n.recipientId === 'all')).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [notifications, currentUser]);

    const unreadCount = useMemo(() => officerNotifications.filter(n => n.status === 'unread').length, [officerNotifications]);

    const handleReplyChange = (notificationId: string, message: string) => setReplyMessages(prev => ({ ...prev, [notificationId]: message }));

    const handleSendReply = (notificationId: string) => {
        const message = replyMessages[notificationId];
        if (message?.trim()) {
            onReplyToNotification(notificationId, message.trim());
            setReplyMessages(prev => ({ ...prev, [notificationId]: '' }));
        }
    };

    const HeaderButton: React.FC<{onClick?: () => void, children: React.ReactNode, hasBadge?: boolean}> = ({ onClick, children, hasBadge }) => (
        <button onClick={onClick} className="p-2.5 rounded-full text-text-secondary hover:text-text-primary bg-[var(--color-bg-input)] border border-[var(--color-border)] relative">
            {children}
            {hasBadge && <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-danger border-2 border-[var(--color-bg-secondary)]"></span>}
        </button>
    );

    return (
        <header className="bg-transparent h-16 flex items-center justify-between px-6 flex-shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={onToggleSidebar} className="lg:hidden text-text-secondary p-2.5 rounded-full bg-[var(--color-bg-input)] border border-[var(--color-border)]">
                  {ICONS.menu('h-6 w-6')}
              </button>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="relative hidden sm:block">
                <form onSubmit={handleSearchSubmit}>
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        {ICONS.search('w-5 h-5 text-text-secondary')}
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search cases..." 
                        value={globalSearchTerm}
                        onChange={e => setGlobalSearchTerm(e.target.value)}
                        className="text-sm rounded-lg pl-12 pr-4 py-2.5 w-72"
                    />
                </form>
              </div>
              
              {/* Real-time sync indicator */}
              <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${isLive ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {isLive ? 'Live' : 'Offline'}
              </div>
              {/* Check-out button for officers */}
              {currentUser.role === Role.OFFICER && onCheckOut && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to check out? This will record your end time.')) {
                      onCheckOut();
                      onLogout();
                    }
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/30 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Check Out
                </button>
              )}
              <ToggleSwitch isOn={theme === 'dark'} handleToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
             
              {isAdmin && (
                  <div className="relative" ref={helpRequestsRef}>
                      <HeaderButton onClick={() => setShowHelpRequests(!showHelpRequests)} hasBadge={notificationStats.pending.length > 0}>
                         {ICONS.bell('h-6 w-6')}
                      </HeaderButton>
                      {showHelpRequests && (
                        <div className="absolute right-0 mt-3 w-80 panel z-50 overflow-hidden flex flex-col max-h-[60vh]">
                            <div className="p-4 border-b border-[var(--color-border)]">
                                <h3 className="font-semibold text-text-primary">Help Requests</h3>
                            </div>
                            <div className="overflow-y-auto">
                                {notificationStats.pending.length > 0 ? (
                                    notificationStats.pending.map(req => (
                                        <div key={req.timestamp} className="p-4 border-b border-[var(--color-border)]">
                                            <div className="flex items-start gap-3">
                                                <Avatar name={req.userName} size="sm" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold">{req.userName} <span className="font-normal text-xs text-text-secondary">({req.userRole})</span></p>
                                                    <p className="text-sm mt-1">{req.query}</p>
                                                    <button onClick={() => onResolveHelpRequest(req.userId)} className="mt-2 text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-md hover:bg-success/20">Mark Resolved</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="p-8 text-center text-sm text-text-secondary">No pending requests.</p>
                                )}
                            </div>
                            <div className="p-2 border-t border-[var(--color-border)] text-center bg-black/20">
                                <p className="text-xs text-text-secondary">Resolved today: {notificationStats.resolvedByMeToday}</p>
                            </div>
                        </div>
                      )}
                  </div>
              )}
              {currentUser.role === Role.OFFICER && (
                <div className="relative" ref={officerNotificationsRef}>
                    <HeaderButton onClick={() => setShowOfficerNotifications(prev => !prev)} hasBadge={unreadCount > 0}>
                        {ICONS.bell('h-6 w-6')}
                    </HeaderButton>
                    {showOfficerNotifications && (
                        <div className="absolute right-0 mt-3 w-96 panel z-50 flex flex-col max-h-[80vh]">
                            <div className="p-4 border-b border-[var(--color-border)]">
                                <h3 className="font-semibold text-text-primary">Notifications</h3>
                            </div>
                            <div className="overflow-y-auto">
                                {officerNotifications.length > 0 ? (
                                    officerNotifications.map(n => (
                                        <div key={n.id} className={`p-4 border-b border-[var(--color-border)] ${n.status === 'unread' ? 'bg-[var(--color-primary-glow)]' : ''}`}>
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-semibold">{n.senderName}</p>
                                                <div className="flex items-center gap-2">
                                                    {n.priority === 'Urgent' && <span className="text-xs font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full">URGENT</span>}
                                                    {n.isTask && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${n.taskStatus === 'done' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{n.taskStatus === 'done' ? 'Done' : 'Pending'}</span>}
                                                </div>
                                            </div>
                                            <p className="text-xs text-text-secondary">{new Date(n.timestamp).toLocaleString()}</p>
                                            <p className="text-sm mt-2">{n.message}</p>
                                            {n.replies && n.replies.map(reply => (
                                                <div key={reply.id} className="mt-2 pl-4 border-l-2 border-[var(--color-border)]">
                                                    <p className="text-xs font-semibold">{reply.senderName === currentUser.name ? "You" : reply.senderName}: <span className="font-normal">{reply.message}</span></p>
                                                </div>
                                            ))}
                                            <div className="mt-3 flex items-center gap-2">
                                                 {n.status === 'unread' && <button onClick={() => onMarkNotificationAsRead(n.id)} className="text-xs font-medium text-text-accent hover:underline">Mark as read</button>}
                                                 {n.isTask && n.taskStatus === 'pending' && <button onClick={() => onUpdateTaskStatus(n.id, 'done')} className="text-xs font-medium text-success hover:underline">Mark as done</button>}
                                            </div>
                                            <div className="mt-2 flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Reply..."
                                                    value={replyMessages[n.id] || ''}
                                                    onChange={(e) => handleReplyChange(n.id, e.target.value)}
                                                    className="flex-grow text-sm rounded-xl p-1.5"
                                                />
                                                <button onClick={() => handleSendReply(n.id)} className="px-3 py-1.5 text-xs btn-primary">Send</button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="p-8 text-center text-sm text-text-secondary">You have no new notifications.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
              )}
               <div className="relative" ref={profileRef}>
                  <button onClick={() => setIsProfileOpen(prev => !prev)} className="flex items-center gap-2 p-1 rounded-full bg-[var(--color-bg-input)] border border-[var(--color-border)]">
                     <Avatar name={currentUser.name} size="sm"/>
                     <div className="hidden sm:block text-left pr-2">
                        <p className="font-semibold text-sm text-text-primary leading-tight">{currentUser.name}</p>
                        <p className="text-xs text-text-secondary leading-tight">{currentUser.role}</p>
                     </div>
                  </button>
                  {isProfileOpen && (
                     <div className="absolute right-0 mt-3 w-64 panel z-50 overflow-hidden">
                        <div className="p-4 text-center border-b border-[var(--color-border)]">
                           <p className="font-bold text-lg text-text-primary">{currentTime.toLocaleTimeString()}</p>
                           <p className="text-xs text-text-secondary">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                        <div className="p-2">
                           <button onClick={onLogout} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-text-primary rounded-xl hover:bg-[var(--color-bg-input)]">
                              {ICONS.logout('w-5 h-5 text-danger')} Logout
                           </button>
                        </div>
                     </div>
                  )}
               </div>
            </div>
        </header>
    )
}


const Layout: React.FC<LayoutProps> = ({ children, currentUser, onLogout, navItems, activeView, setActiveView, onHomeClick, helpRequests, onRequestHelp, onResolveHelpRequest, onGlobalSearch, theme, setTheme, notifications, onMarkNotificationAsRead, onUpdateTaskStatus, onReplyToNotification, isLive, onCheckOut }) => {
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [helpQuery, setHelpQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleHelpSubmit = () => {
    if (helpQuery.trim()) {
        onRequestHelp(helpQuery.trim());
        setHelpQuery('');
        setIsHelpModalOpen(false);
    }
  }

  return (
    <>
    <div className="flex h-screen bg-background text-text-primary">
       <div 
            className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300 ease-in-out ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
        />
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[var(--color-sidebar-bg)] flex-shrink-0 flex flex-col transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-200 ease-out lg:relative lg:translate-x-0 shadow-lg`}>
        <Sidebar
          navItems={navItems} 
          activeView={activeView}
          setActiveView={setActiveView}
          onHomeClick={onHomeClick}
          currentUser={currentUser}
          onRequestHelp={() => setIsHelpModalOpen(true)}
        />
      </aside>
       <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <Header
                currentUser={currentUser}
                onLogout={onLogout}
                onGlobalSearch={onGlobalSearch}
                theme={theme}
                setTheme={setTheme}
                onToggleSidebar={() => setIsSidebarOpen(true)}
                notifications={notifications}
                helpRequests={helpRequests}
                onResolveHelpRequest={onResolveHelpRequest}
                onMarkNotificationAsRead={onMarkNotificationAsRead}
                onUpdateTaskStatus={onUpdateTaskStatus}
                onReplyToNotification={onReplyToNotification}
                isLive={isLive}
                onCheckOut={onCheckOut}
            />
            <main className="flex-1 overflow-y-auto px-4 pb-4">
                {children}
            </main>
       </div>
    </div>

    {isHelpModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="panel w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-[var(--color-border)]">
                    <h2 className="text-xl font-bold">Request Assistance</h2>
                    <button onClick={() => setIsHelpModalOpen(false)} className="opacity-80 hover:opacity-100">
                        {ICONS.close('h-6 w-6')}
                    </button>
                </div>
                <div className="p-6 space-y-4 bg-[var(--color-bg-secondary)]">
                    <div>
                        <label htmlFor="help-query" className="block text-sm font-medium text-text-secondary mb-2 ml-2">Please describe your issue</label>
                        <textarea 
                            id="help-query"
                            value={helpQuery} 
                            onChange={e => setHelpQuery(e.target.value)} 
                            placeholder="Example: I'm unable to find case MA12345..." 
                            rows={4} 
                            className="mt-1 block w-full shadow-sm sm:text-sm p-3" 
                            required>
                        </textarea>
                    </div>
                </div>
                 <div className="flex justify-end p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <button type="button" onClick={() => setIsHelpModalOpen(false)} className="px-4 py-2 text-sm font-medium btn-secondary mr-3">
                        Cancel
                    </button>
                    <button onClick={handleHelpSubmit} className="btn-primary px-4 py-2 text-sm">
                        Submit Request
                    </button>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default Layout;
