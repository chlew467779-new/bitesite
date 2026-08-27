/* bitesite/app/admin/components/device-chart.tsx */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'];

interface DeviceData {
  name: string;
  value: number;
}

interface DeviceChartProps {
  range: string;
}

export default function DeviceChart({ range }: DeviceChartProps) {
  const { token } = useAuth();
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/devices?range=${range}`, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) {
          const json = await res.json();
          setDevices(json.devices || []);
        }
      } catch (err) {
        console.error('DeviceChart fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range, token]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Device Distribution</h3>
        <div className="h-48 bg-slate-800/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h3 className="text-sm font-medium text-slate-300 mb-4">Device Distribution</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={devices}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {devices.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f1f5f9',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={24}
              iconType="circle"
              formatter={(value: string) => <span className="text-slate-400 text-xs">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
