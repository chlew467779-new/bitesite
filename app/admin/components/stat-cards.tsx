/* bitesite/app/admin/components/stat-cards.tsx */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { Eye, Users, MousePointerClick, Store, RefreshCw } from 'lucide-react';

interface OverviewData {
  totalViews: number;
  totalUnique: number;
  totalEvents: number;
  merchantCount: number;
  todayViews: number;
  range: string;
}

interface StatCardsProps {
  range: string;
}

export default function StatCards({ range }: StatCardsProps) {
  const { token } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/overview?range=${range}`, {
          headers: { 'x-admin-token': token },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Unable to load dashboard metrics');
        setData(json);
      } catch (err) {
        console.error('StatCards fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unable to load dashboard metrics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range, retryKey, token]);

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const cards = [
    {
      label: 'All Page Views',
      description: 'Public pages in the selected period',
      value: data?.totalViews ?? 0,
      icon: Eye,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Unique Visitors',
      description: 'Distinct IPs; an approximate visitor count',
      value: data?.totalUnique ?? 0,
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Tracked Events',
      description: 'Clicks and interactions, not completed orders',
      value: data?.totalEvents ?? 0,
      icon: MousePointerClick,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Published Merchants',
      description: 'Merchants currently visible to the public',
      value: data?.merchantCount ?? 0,
      icon: Store,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
  ];

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-slate-900 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">Dashboard metrics unavailable</p>
            <p className="mt-1 text-sm text-red-400">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`bg-slate-900 border ${card.border} rounded-xl p-4 lg:p-5`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                <Icon className={`w-4.5 h-4.5 ${card.color}`} />
              </div>
              {range === 'today' && card.label === 'All Page Views' && data?.todayViews !== undefined && (
                <span className="text-xs text-slate-500">Today: {formatNumber(data.todayViews)}</span>
              )}
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-white mb-1">
              {loading ? (
                <span className="inline-block w-16 h-8 bg-slate-800 rounded animate-pulse" />
              ) : (
                formatNumber(card.value)
              )}
            </p>
            <p className="text-sm text-slate-300" title={card.description}>{card.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
}
