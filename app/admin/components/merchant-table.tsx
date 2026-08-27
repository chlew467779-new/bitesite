/* bitesite/app/admin/components/merchant-table.tsx */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { ArrowUpDown, Eye, MessageCircle, CalendarCheck } from 'lucide-react';

interface MerchantData {
  slug: string;
  views: number;
  unique_ips: number;
  whatsapp: number;
  bookings: number;
}

interface MerchantTableProps {
  range: string;
}

export default function MerchantTable({ range }: MerchantTableProps) {
  const { token } = useAuth();
  const [data, setData] = useState<MerchantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'views' | 'whatsapp' | 'bookings'>('views');

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/merchants?range=${range}`, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json.data || []);
        }
      } catch (err) {
        console.error('MerchantTable fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range, token]);

  const sortedData = [...data].sort((a, b) => {
    if (sortBy === 'views') return b.views - a.views;
    if (sortBy === 'whatsapp') return b.whatsapp - a.whatsapp;
    return b.bookings - a.bookings;
  });

  const formatNumber = (n: number) => n.toLocaleString();

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Merchant Performance</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">Merchant Performance</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sort by:</span>
          <button
            onClick={() => setSortBy('views')}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              sortBy === 'views' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Views
          </button>
          <button
            onClick={() => setSortBy('whatsapp')}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              sortBy === 'whatsapp' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            WhatsApp
          </button>
          <button
            onClick={() => setSortBy('bookings')}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              sortBy === 'bookings' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bookings
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-6 py-3 text-slate-500 font-medium">#</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Merchant</th>
              <th className="text-right px-6 py-3 text-slate-500 font-medium">
                <span className="flex items-center justify-end gap-1">
                  <Eye className="w-3.5 h-3.5" /> Views
                </span>
              </th>
              <th className="text-right px-6 py-3 text-slate-500 font-medium">
                <span className="flex items-center justify-end gap-1">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </span>
              </th>
              <th className="text-right px-6 py-3 text-slate-500 font-medium">
                <span className="flex items-center justify-end gap-1">
                  <CalendarCheck className="w-3.5 h-3.5" /> Bookings
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No data available for this period.
                </td>
              </tr>
            ) : (
              sortedData.map((merchant, index) => (
                <tr
                  key={merchant.slug}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-6 py-3 text-slate-500">{index + 1}</td>
                  <td className="px-6 py-3">
                    <span className="text-slate-200 font-medium capitalize">
                      {merchant.slug.replace(/-/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-slate-300 font-mono">
                    {formatNumber(merchant.views)}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-300 font-mono">
                    {formatNumber(merchant.whatsapp)}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-300 font-mono">
                    {formatNumber(merchant.bookings)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
