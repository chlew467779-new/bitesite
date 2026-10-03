/* bitesite/app/admin/components/admin-shell.tsx */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { requestLeave } from '@/lib/unsaved-guard';
import { ADMIN_NAV_GROUPS, groupBadgeCount } from '@/lib/admin-nav-groups.mjs';
import {
  LayoutDashboard,
  Send,
  ListChecks,
  TrendingUp,
  Store,
  Smartphone,
  MapPin,
  MapPinned,
  Megaphone,
  Link2,
  Search,
  MousePointer,
  BookOpen,
  PenLine,
  Inbox,
  ShieldCheck,
  MessageSquare,
  Flag,
  Building2,
  Map,
  Clock,
  CalendarClock,
  Settings,
  Download,
  LogOut,
  Menu,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

const navItems = [
  { id: 'today', label: 'Today', icon: ListChecks },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'merchants', label: 'Merchants', icon: Store },
  { id: 'devices', label: 'Devices', icon: Smartphone },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'areas', label: 'Areas', icon: MapPinned },
  { id: 'popup', label: 'Homepage Pop-up', icon: Megaphone },
  { id: 'referrers', label: 'Referrers', icon: Link2 },
  { id: 'search', label: 'Search Keywords', icon: Search },
  { id: 'events', label: 'Events', icon: MousePointer },
  { id: 'stories-analytics', label: 'Stories Analytics', icon: BookOpen },
  { id: 'stories-editor', label: 'Stories Editor', icon: PenLine },
  { id: 'story-submissions', label: 'Story Submissions', icon: Inbox },
  { id: 'restaurant-reviews', label: 'Restaurant Reviews', icon: ShieldCheck },
  { id: 'link-reviews', label: 'Change Requests', icon: ShieldCheck },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'reports', label: 'Visitor Reports', icon: Flag },
  { id: 'content-service', label: 'Content Service', icon: CalendarClock },
  { id: 'monthly-summaries', label: 'Monthly Summaries', icon: Send },
  { id: 'merchant-manager', label: 'Merchant Manager', icon: Building2 },
  { id: 'map', label: 'Map Stats', icon: Map },
  { id: 'hourly', label: 'Hourly', icon: Clock },
];

interface AdminShellProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

const GROUP_STORAGE_KEY = 'bitesite.admin.nav-groups';
const DEFAULT_GROUPS: Record<string, boolean> = { Restaurants: true, Stories: true, Inbox: true, Performance: false, Visitors: false, Site: false };
function readGroups() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(GROUP_STORAGE_KEY) || '{}');
    return Object.fromEntries(Object.entries(DEFAULT_GROUPS).map(([name, fallback]) => [name, typeof saved?.[name] === 'boolean' ? saved[name] : fallback]));
  } catch { return { ...DEFAULT_GROUPS }; }
}

export default function AdminShell({ activeTab, onTabChange, children }: AdminShellProps) {
  const { logout, token } = useAuth();
  const [attention, setAttention] = useState<Record<string, number>>({});

  // Sidebar badges: what needs the team now. Refreshed on page change and every minute.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/admin/attention', { headers: { 'x-admin-token': token }, cache: 'no-store' });
        const body = await response.json().catch(() => null);
        if (!cancelled && response.ok && body?.data) {
          // Ideas wait for a batch (shown on Today), so they never become a badge.
          const { notifications, ideas, ...counts } = body.data as Record<string, number> & { notifications: unknown; ideas: unknown };
          void notifications; void ideas;
          setAttention(counts);
        }
      } catch { /* badges are a convenience; the pages themselves stay authoritative */ }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [token, activeTab]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(DEFAULT_GROUPS);
  useEffect(() => { setOpenGroups(readGroups()); }, []);
  const toggleGroup = (name: string) => {
    const next = { ...openGroups, [name]: !openGroups[name] };
    setOpenGroups(next);
    try { window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  const handleTabChange = (tab: string) => {
    // Keep the destination until the editor has saved or discarded its changes.
    requestLeave(() => {
      onTabChange(tab);
      setSidebarOpen(false);
    });
  };

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800
          transform transition-all duration-200 ease-in-out flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          w-64 ${sidebarCollapsed ? 'lg:w-16' : ''}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 shrink-0">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                <span className="text-slate-950 font-bold text-sm">B</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-white font-semibold text-sm leading-tight">BiteSite</h2>
                <p className="text-slate-500 text-xs leading-tight">Admin</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center mx-auto">
              <span className="text-slate-950 font-bold text-sm">B</span>
            </div>
          )}
          
          {/* Mobile close */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden inline-flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-white ml-auto"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Desktop collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:block text-slate-500 hover:text-slate-300 transition-colors ml-2 shrink-0"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 min-w-0">
          {ADMIN_NAV_GROUPS.map((group, groupIndex) => {
            const currentGroup = group.ids.includes(activeTab);
            const expanded = !group.name || currentGroup || openGroups[group.name];
            const total = groupBadgeCount(group.ids, attention);
            return <div key={group.name ?? 'today'}>
              {groupIndex > 0 && sidebarCollapsed && <div className="hidden lg:block my-2 border-t border-slate-800" />}
              {group.name && <button type="button" aria-expanded={!!expanded} onClick={() => { if (!currentGroup) toggleGroup(group.name!); }}
                className={`flex min-h-11 w-full items-center gap-2 px-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <span className="flex-1">{group.name}</span>
                {!expanded && total > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-slate-950" aria-label={`${total} waiting`}>{total}</span>}
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>}
              <div className={expanded ? '' : sidebarCollapsed ? 'hidden lg:block' : 'hidden'}>
              {group.ids.map((id) => {
            const item = navItems.find((entry) => entry.id === id)!;
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabChange(item.id)}
                className={`
                  relative min-h-11 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                  ${isActive
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }
                  ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
                `}
                title={sidebarCollapsed ? item.label : undefined}
                aria-label={item.label}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className={`flex min-w-0 flex-1 items-center gap-2 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                    <span className="flex-1 text-left whitespace-normal break-words">{item.label}</span>
                    {(attention[item.id] ?? 0) > 0 && (
                      <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-slate-950" aria-label={`${attention[item.id]} waiting`}>{attention[item.id]}</span>
                    )}
                    {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                </span>
                {sidebarCollapsed && (attention[item.id] ?? 0) > 0 && <span className="absolute right-1 top-1 hidden h-2 w-2 rounded-full bg-amber-500 lg:block" aria-label={`${attention[item.id]} waiting`} />}
              </button>
            );
          })}</div></div>;
          })}
        </nav>

        {/* Footer */}
        <div className={`p-3 border-t border-slate-800 space-y-2 shrink-0 ${sidebarCollapsed ? 'lg:px-2' : ''}`}>
          <button
            onClick={() => handleTabChange('settings')}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
              ${activeTab === 'settings'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }
              ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
            `}
            title={sidebarCollapsed ? 'Settings' : undefined}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left">Settings</span>
                {activeTab === 'settings' && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
              </>
            )}
          </button>
          <button
            onClick={() => handleTabChange('export')}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
              ${activeTab === 'export'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
              }
              ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
            `}
            title={sidebarCollapsed ? 'Export CSV' : undefined}
          >
            <Download className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left">Export CSV</span>
                {activeTab === 'export' && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
              </>
            )}
          </button>
          <button
            onClick={() => {
              requestLeave(() => {
                setSidebarOpen(false);
                logout();
              });
            }}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all
              ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
            `}
            title={sidebarCollapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span className="flex-1 text-left">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar - Mobile only */}
        <header className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-b border-slate-800 lg:hidden">
          <button
            type="button"
            aria-label="Open admin menu"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-white font-medium text-sm">BiteSite Admin</span>
          <div className="w-6" />
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
