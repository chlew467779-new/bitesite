/* bitesite/app/admin/components/stat-cards.tsx */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { Eye, Users, MousePointerClick, Store } from 'lucide-react';

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

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/overview?range=${range}`, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('StatCards fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range, token]);

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const cards = [
    {
      label: 'Total Page Views',
      value: data?.totalViews ?? 0,
      icon: Eye,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Unique Visitors',
      value: data?.totalUnique ?? 0,
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Total Events',
      value: data?.totalEvents ?? 0,
      icon: MousePointerClick,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Active Merchants',
      value: data?.merchantCount ?? 0,
      icon: Store,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
  ];

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
              {range === 'today' && card.label === 'Total Page Views' && data?.todayViews !== undefined && (
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
            <p className="text-sm text-slate-400">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
