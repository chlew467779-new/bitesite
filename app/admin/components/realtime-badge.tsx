/* bitesite/app/admin/components/realtime-badge.tsx */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { Users } from 'lucide-react';

export default function RealtimeBadge() {
  const { token } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRealtime = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/realtime', {
        headers: { 'x-admin-token': token },
      });
      if (res.ok) {
        const data = await res.json();
        setCount(data.onlineCount);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealtime();
    const interval = setInterval(fetchRealtime, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
      <div className="relative">
        <Users className="w-4 h-4 text-emerald-400" />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
      </div>
      <span className="text-sm text-emerald-400 font-medium">
        {loading ? '...' : `${count ?? 0} online`}
      </span>
    </div>
  );
}
