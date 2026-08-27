/* bitesite/app/admin/page.tsx */
'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from './components/auth-context';
import LoginForm from './login-form';
import AdminShell from './components/admin-shell';
import StatCards from './components/stat-cards';
import TrendChart from './components/trend-chart';
import MerchantTable from './components/merchant-table';
import DeviceChart from './components/device-chart';
import LocationChart from './components/location-chart';
import ReferrerChart from './components/referrer-chart';
import SearchKeywordsTable from './components/search-keywords-table';
import EventsChart from './components/events-chart';
import StoriesChart from './components/stories-chart';
import MapStats from './components/map-stats';
import HourlyChart from './components/hourly-chart';
import RealtimeBadge from './components/realtime-badge';
import ExportButton from './components/export-button';
import DateRangePicker from './components/date-range-picker';

function DashboardContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('7d');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-white">Dashboard Overview</h1>
              <div className="flex items-center gap-3">
                <RealtimeBadge />
                <DateRangePicker value={dateRange} onChange={setDateRange} />
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
            <MerchantTable range={dateRange} />
          </div>
        );
      case 'trends':
        return (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Traffic Trends</h1>
            <TrendChart range={dateRange} fullWidth />
          </div>
        );
      case 'merchants':
        return (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Merchant Performance</h1>
            <MerchantTable range={dateRange} />
          </div>
        );
      case 'devices':
        return (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Device Analytics</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DeviceChart range={dateRange} />
              {/* OS + Browser table would go here */}
            </div>
          </div>
        );
      case 'locations':
        return (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Location Analytics</h1>
            <LocationChart range={dateRange} />
          </div>
        );
      case 'referrers':
        return (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Traffic Sources</h1>
            <ReferrerChart range={dateRange} />
          </div>
        );
      case 'search':
        return (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Search Keywords</h1>
            <SearchKeywordsTable range={dateRange} />
          </div>
        );
      case 'events':
        return (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Event Analytics</h1>
            <EventsChart range={dateRange} />
          </div>
        );
      case 'stories':
        return (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Stories Performance</h1>
            <StoriesChart range={dateRange} />
          </div>
        );
      case 'map':
        return (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Map Page Stats</h1>
            <MapStats range={dateRange} />
          </div>
        );
      case 'hourly':
        return (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Peak Hours</h1>
            <HourlyChart range={dateRange} />
          </div>
        );
      case 'export':
        return (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Export Data</h1>
            <ExportButton range={dateRange} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AdminShell activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTabContent()}
    </AdminShell>
  );
}

export default function AdminPage() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
