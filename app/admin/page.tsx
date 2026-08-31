/* bitesite/app/admin/page.tsx */

'use client';

import { useState } from 'react';
import { useAuth } from './components/auth-context';
import AdminShell from './components/admin-shell';
import StatCards from './components/stat-cards';
import TrendChart from './components/trend-chart';
import DeviceChart from './components/device-chart';
import ReferrerChart from './components/referrer-chart';
import EventsChart from './components/events-chart';
import LocationChart from './components/location-chart';
import HourlyChart from './components/hourly-chart';
import StoriesChart from './components/stories-chart';
import MapStats from './components/map-stats';
import SearchKeywordsTable from './components/search-keywords-table';
import MerchantTable from './components/merchant-table';
import ExportButton from './components/export-button';
import RealtimeBadge from './components/realtime-badge';
import DateRangePicker from './components/date-range-picker';
import { SettingsPanel } from './components/settings-panel';
import StoriesManager from './components/stories-manager';
import StoryEditor from './components/story-editor';
import MerchantManager from './components/merchant-manager';
import { Lock, Loader2 } from 'lucide-react';

export default function AdminPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('7d');
  const [showEditor, setShowEditor] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Login form state
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoggingIn(true);
    setLoginError('');
    const result = await login(password);
    setLoggingIn(false);
    if (!result.success) {
      setLoginError(result.error || 'Login failed');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-slate-950" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Admin Access</h1>
            <p className="text-slate-400 text-sm">Enter your password to access the dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-400 text-center">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loggingIn || !password.trim()}
              className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingIn ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleEditStory = (slug: string) => {
    setEditingSlug(slug);
    setShowEditor(true);
  };

  const handleNewStory = () => {
    setEditingSlug(null);
    setShowEditor(true);
  };

  const handleBackToList = () => {
    setShowEditor(false);
    setEditingSlug(null);
  };

  const handleSaved = () => {
    setShowEditor(false);
    setEditingSlug(null);
    setRefreshKey(k => k + 1);
  };

  return (
    <AdminShell activeTab={activeTab} onTabChange={setActiveTab}>
      {/* Overview - Full Dashboard */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
              <p className="text-slate-400 text-sm mt-1">Track your site performance and visitor behavior</p>
            </div>
            <div className="flex items-center gap-3">
              <RealtimeBadge />
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <ExportButton range={dateRange} />
            </div>
          </div>

          <StatCards range={dateRange} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TrendChart range={dateRange} />
            </div>
            <div>
              <DeviceChart range={dateRange} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReferrerChart range={dateRange} />
            <EventsChart range={dateRange} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LocationChart range={dateRange} />
            <HourlyChart range={dateRange} />
          </div>

          <StoriesChart range={dateRange} />
          <MapStats range={dateRange} />
          <SearchKeywordsTable range={dateRange} />
          <MerchantTable range={dateRange} />
        </div>
      )}

      {/* Trends */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Traffic Trends</h1>
              <p className="text-slate-400 text-sm mt-1">Daily page view trends over time</p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <TrendChart range={dateRange} />
        </div>
      )}

      {/* Merchants */}
      {activeTab === 'merchants' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Merchant Performance</h1>
              <p className="text-slate-400 text-sm mt-1">Views, WhatsApp clicks, and bookings by merchant</p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <MerchantTable range={dateRange} />
        </div>
      )}

      {/* Devices */}
      {activeTab === 'devices' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Device Distribution</h1>
              <p className="text-slate-400 text-sm mt-1">Breakdown of visitors by device type</p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <DeviceChart range={dateRange} />
        </div>
      )}

      {/* Locations */}
      {activeTab === 'locations' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Location Analytics</h1>
              <p className="text-slate-400 text-sm mt-1">Top cities and countries by visitor count</p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <LocationChart range={dateRange} />
        </div>
      )}

      {/* Referrers */}
      {activeTab === 'referrers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Traffic Sources</h1>
              <p className="text-slate-400 text-sm mt-1">Where your visitors are coming from</p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <ReferrerChart range={dateRange} />
        </div>
      )}

      {/* Search Keywords */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Search Keywords</h1>
              <p className="text-slate-400 text-sm mt-1">Most popular search terms on your site</p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <SearchKeywordsTable range={dateRange} />
        </div>
      )}

      {/* Events */}
      {activeTab === 'events' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Event Analytics</h1>
              <p className="text-slate-400 text-sm mt-1">User interactions and conversions</p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <EventsChart range={dateRange} />
        </div>
      )}

      {/* Map Stats */}
      {activeTab === 'map' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Map Statistics</h1>
              <p className="text-slate-400 text-sm mt-1">Map page views and marker interactions</p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <MapStats range={dateRange} />
        </div>
      )}

      {/* Hourly */}
      {activeTab === 'hourly' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Peak Hours</h1>
              <p className="text-slate-400 text-sm mt-1">Visitor activity by hour of day (Malaysia Time)</p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <HourlyChart range={dateRange} />
        </div>
      )}

      {/* Stories Analytics */}
      {activeTab === 'stories-analytics' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Stories Analytics</h1>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <StoriesChart range={dateRange} />
        </div>
      )}

      {/* Stories Editor */}
      {activeTab === 'stories-editor' && (
        <div className="space-y-6">
          {showEditor ? (
            <StoryEditor
              slug={editingSlug}
              onBack={handleBackToList}
              onSaved={handleSaved}
            />
          ) : (
            <StoriesManager
              key={refreshKey}
              onEdit={handleEditStory}
              onNew={handleNewStory}
            />
          )}
        </div>
      )}

      {/* Merchant Manager */}
      {activeTab === 'merchant-manager' && (
        <div className="space-y-6">
          <MerchantManager />
        </div>
      )}

      {/* Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <SettingsPanel />
        </div>
      )}

      {/* Export CSV */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Export Data</h1>
              <p className="text-slate-400 text-sm mt-1">Download analytics data as CSV</p>
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ExportButton range={dateRange} />
            </div>
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-2">What&apos;s included?</h3>
                <ul className="text-slate-400 text-sm space-y-1.5">
                  <li>• Page views by merchant</li>
                  <li>• Unique visitor counts</li>
                  <li>• Event conversions</li>
                  <li>• Device and location data</li>
                </ul>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Date Range</h3>
                <p className="text-slate-400 text-sm">
                  Select a range above to filter the exported data. The CSV will contain all metrics for the selected period.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
