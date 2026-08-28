/* bitesite/app/admin/components/events-chart.tsx */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DailyEvent {
  date: string;
  [key: string]: string | number;
}

interface EventsChartProps {
  range: string;
}

const EVENT_LABELS: Record<string, string> = {
  whatsapp_click: 'WhatsApp',
  booking_submit: 'Bookings',
  share: 'Shares',
  search: 'Searches',
  map_marker_click: 'Map Clicks',
  story_to_merchant: 'Story Clicks',
};

const EVENT_COLORS: Record<string, string> = {
  whatsapp_click: '#10b981',
  booking_submit: '#3b82f6',
  share: '#f59e0b',
  search: '#8b5cf6',
  map_marker_click: '#ec4899',
  story_to_merchant: '#ef4444',
};

export default function EventsChart({ range }: EventsChartProps) {
  const { token } = useAuth();
  const [daily, setDaily] = useState<DailyEvent[]>([]);
  const [summary, setSummary] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/events?range=${range}`, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) {
          const json = await res.json();
          setDaily(json.daily || []);
          setSummary(json.summary || []);
        }
      } catch (err) {
        console.error('EventsChart fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range, token]);

  const eventTypes = Object.keys(EVENT_LABELS).filter(t =>
    daily.some(d => (d[t] as number) > 0)
  );

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Event Analytics</h3>
        <div className="h-64 bg-slate-800/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.map((item) => (
          <div
            key={item.name}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4"
          >
            <p className="text-xs text-slate-500 mb-1">{EVENT_LABELS[item.name] || item.name}</p>
            <p className="text-xl font-bold text-white">{item.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Daily Trend */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Daily Events</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                stroke="#475569"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                }}
                itemStyle={{ color: '#f1f5f9' }}
              />
              <Legend
                formatter={(value: string) => (
                  <span className="text-slate-400 text-xs">{EVENT_LABELS[value] || value}</span>
                )}
              />
              {eventTypes.map((type) => (
                <Bar
                  key={type}
                  dataKey={type}
                  stackId="events"
                  fill={EVENT_COLORS[type] || '#64748b'}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
