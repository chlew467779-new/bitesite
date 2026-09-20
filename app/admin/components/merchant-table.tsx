/* bitesite/app/admin/components/merchant-table.tsx */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { Eye, MessageCircle, CalendarCheck, RefreshCw } from 'lucide-react';

interface MerchantData {
  slug: string;
  views: number;
  unique_ips: number | null;
  whatsapp: number;
  bookings: number;
  grabfoodClicks: number;
  directionsClicks: number;
  phoneClicks: number;
  menuViews: number;
  websiteClicks: number;
  emailClicks: number;
  storyViews: number;
}

interface MerchantTableProps {
  range: string;
}

export default function MerchantTable({ range }: MerchantTableProps) {
  const { token } = useAuth();
  const [data, setData] = useState<MerchantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<keyof Pick<MerchantData, 'views' | 'unique_ips' | 'menuViews' | 'storyViews' | 'grabfoodClicks' | 'directionsClicks' | 'phoneClicks' | 'websiteClicks' | 'emailClicks' | 'whatsapp' | 'bookings'>>('views');
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [rawVisitorDataAvailable, setRawVisitorDataAvailable] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/merchants?range=${range}`, {
          headers: { 'x-admin-token': token },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Unable to load merchant analytics');
        setData(json.data || []);
        const rawAvailable = json.rawVisitorDataAvailable !== false;
        setRawVisitorDataAvailable(rawAvailable);
        if (!rawAvailable) setSortBy(current => current === 'unique_ips' ? 'views' : current);
      } catch (err) {
        console.error('MerchantTable fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unable to load merchant analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range, retryKey, token]);

  const sortedData = [...data].sort((a, b) => {
    return (b[sortBy] ?? -1) - (a[sortBy] ?? -1);
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

  if (error) {
    return (
      <div className="bg-slate-900 border border-red-500/20 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-slate-200">Merchant Performance</h3>
            <p className="text-sm text-red-400 mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div><h3 className="text-sm font-medium text-slate-300">Merchant Performance</h3>{!rawVisitorDataAvailable && <p className="mt-1 text-xs text-amber-300">Unique visitor ranking is available for up to 90 days of raw analytics.</p>}</div>
        <div className="flex items-center gap-2">
          <label htmlFor="merchant-sort" className="text-xs text-slate-500">Sort by:</label>
          <select
            id="merchant-sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-amber-500 focus:outline-none"
          >
            <option value="views">Views</option>
            <option value="unique_ips" disabled={!rawVisitorDataAvailable}>Unique visitors{!rawVisitorDataAvailable ? ' (90-day limit)' : ''}</option>
            <option value="menuViews">Menu views</option>
            <option value="storyViews">Story views</option>
            <option value="grabfoodClicks">GrabFood</option>
            <option value="directionsClicks">Directions</option>
            <option value="phoneClicks">Phone</option>
            <option value="websiteClicks">Website</option>
            <option value="emailClicks">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="bookings">Bookings</option>
          </select>
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
              <th className="text-right px-6 py-3 text-slate-500 font-medium">Menu Views</th>
              <th className="text-right px-6 py-3 text-slate-500 font-medium">Story Views</th>
              <th className="text-right px-6 py-3 text-slate-500 font-medium">GrabFood</th>
              <th className="text-right px-6 py-3 text-slate-500 font-medium">Directions</th>
              <th className="text-right px-6 py-3 text-slate-500 font-medium">Phone</th>
              <th className="text-right px-6 py-3 text-slate-500 font-medium">Website</th>
              <th className="text-right px-6 py-3 text-slate-500 font-medium">Email</th>
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
                <td colSpan={12} className="px-6 py-8 text-center text-slate-500">
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
                    {formatNumber(merchant.menuViews)}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-300 font-mono">
                    {formatNumber(merchant.storyViews)}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-300 font-mono">
                    {formatNumber(merchant.grabfoodClicks)}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-300 font-mono">
                    {formatNumber(merchant.directionsClicks)}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-300 font-mono">
                    {formatNumber(merchant.phoneClicks)}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-300 font-mono">
                    {formatNumber(merchant.websiteClicks)}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-300 font-mono">
                    {formatNumber(merchant.emailClicks)}
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
