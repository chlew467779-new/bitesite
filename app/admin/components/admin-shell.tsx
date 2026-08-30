/* bitesite/app/admin/components/admin-shell.tsx */

'use client';

import { useState } from 'react';
import { useAuth } from './auth-context';
import {
  LayoutDashboard,
  TrendingUp,
  Store,
  Smartphone,
  MapPin,
  Link2,
  Search,
  MousePointer,
  BookOpen,
  Map,
  Clock,
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
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'merchants', label: 'Merchants', icon: Store },
  { id: 'devices', label: 'Devices', icon: Smartphone },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'referrers', label: 'Referrers', icon: Link2 },
  { id: 'search', label: 'Search Keywords', icon: Search },
  { id: 'events', label: 'Events', icon: MousePointer },
  { id: 'stories-analytics', label: 'Stories Analytics', icon: BookOpen },
  { id: 'map', label: 'Map Stats', icon: Map },
  { id: 'hourly', label: 'Hourly', icon: Clock },
];

interface AdminShellProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export default function AdminShell({ activeTab, onTabChange, children }: AdminShellProps) {
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
          transform transition-all duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${sidebarCollapsed ? 'lg:w-16' : 'w-64'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                  <span className="text-slate-950 font-bold text-sm">B</span>
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm leading-tight">BiteSite</h2>
                  <p className="text-slate-500 text-xs leading-tight">Admin</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center mx-auto">
                <span className="text-slate-950 font-bold text-sm">B</span>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:block text-slate-500 hover:text-slate-300 transition-colors"
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
          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                    ${isActive
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }
                    ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
                  `}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {isActive && <ChevronRight className="w-3.5 h-3.5" />}
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className={`p-3 border-t border-slate-800 space-y-2 ${sidebarCollapsed ? 'lg:px-2' : ''}`}>
            <button
              onClick={() => onTabChange('settings')}
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
              <Settings className="w-4 h-4" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">Settings</span>
                  {activeTab === 'settings' && <ChevronRight className="w-3.5 h-3.5" />}
                </>
              )}
            </button>
            <button
              onClick={() => onTabChange('export')}
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
              <Download className="w-4 h-4" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">Export CSV</span>
                  {activeTab === 'export' && <ChevronRight className="w-3.5 h-3.5" />}
                </>
              )}
            </button>
            <button
              onClick={logout}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all
                ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
              `}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="w-4 h-4" />
              {!sidebarCollapsed && <span className="flex-1 text-left">Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-b border-slate-800 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white"
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
