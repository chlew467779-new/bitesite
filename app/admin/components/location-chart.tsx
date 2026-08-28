/* bitesite/app/admin/components/location-chart.tsx */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CityData {
  city: string;
  country: string;
  value: number;
}

interface LocationChartProps {
  range: string;
}

export default function LocationChart({ range }: LocationChartProps) {
  const { token } = useAuth();
  const [cities, setCities] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/locations?range=${range}`, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) {
          const json = await res.json();
          setCities(json.cities?.slice(0, 10) || []);
        }
      } catch (err) {
        console.error('LocationChart fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range, token]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Top Cities</h3>
        <div className="h-64 bg-slate-800/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h3 className="text-sm font-medium text-slate-300 mb-4">Top Cities</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={cities} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis
              dataKey="city"
              type="category"
              width={100}
              stroke="#475569"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f1f5f9',
              }}
              itemStyle={{ color: '#f1f5f9' }}
              formatter={(value: number) => [value.toLocaleString(), 'Views']}
            />
            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
