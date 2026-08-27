/* bitesite/app/admin/components/map-stats.tsx */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { Map, MapPin, Eye } from 'lucide-react';

interface MapStatsProps {
  range: string;
}

export default function MapStats({ range }: MapStatsProps) {
  const { token } = useAuth();
  const [data, setData] = useState({ totalViews: 0, totalMarkers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/map?range=${range}`, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) {
          const json = await res.json();
          setData({
            totalViews: json.totalViews || 0,
            totalMarkers: json.totalMarkers || 0,
          });
        }
      } catch (err) {
        console.error('MapStats fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range, token]);

  const cards = [
    {
      label: 'Map Page Views',
      value: data.totalViews,
      icon: Map,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Marker Clicks',
      value: data.totalMarkers,
      icon: MapPin,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`bg-slate-900 border ${card.border} rounded-xl p-6`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-sm text-slate-400">{card.label}</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {loading ? (
                <span className="inline-block w-20 h-9 bg-slate-800 rounded animate-pulse" />
              ) : (
                card.value.toLocaleString()
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
