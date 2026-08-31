/* bitesite/app/admin/components/stories-chart.tsx */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { BookOpen, ArrowRight } from 'lucide-react';

interface StoryData {
  slug: string;
  title: string;
  periodViews: number;
  totalViews: number;
  conversions: number;
  conversionRate: string;
}

interface StoriesChartProps {
  range: string;
}

export default function StoriesChart({ range }: StoriesChartProps) {
  const { token } = useAuth();
  const [data, setData] = useState<StoryData[]>([]);
  const [totals, setTotals] = useState({ totalStoryViews: 0, totalAllTimeViews: 0, totalConversions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/stories-analytics?range=${range}`, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json.data || []);
          setTotals({
            totalStoryViews: json.totalStoryViews || 0,
            totalAllTimeViews: json.totalAllTimeViews || 0,
            totalConversions: json.totalConversions || 0,
          });
        }
      } catch (err) {
        console.error('StoriesChart fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range, token]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Stories Performance</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Period Story Views</p>
          <p className="text-2xl font-bold text-white">{totals.totalStoryViews.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">All-Time Story Views</p>
          <p className="text-2xl font-bold text-slate-300">{totals.totalAllTimeViews.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Story → Merchant Clicks</p>
          <p className="text-2xl font-bold text-emerald-400">{totals.totalConversions.toLocaleString()}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-medium text-slate-300">Stories Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Story</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Period Views</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Total Views</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Conversions</th>
                <th className="text-right px-6 py-3 text-slate-500 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No stories data for this period.
                  </td>
                </tr>
              ) : (
                data.map((story) => (
                  <tr
                    key={story.slug}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div>
                        <span className="text-slate-200 font-medium">
                          {story.title}
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          {story.slug === 'story-list' ? 'Stories List Page' : story.slug}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right text-slate-300 font-mono">
                      {story.periodViews.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-500 font-mono text-xs">
                      {story.totalViews.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
                        <ArrowRight className="w-3 h-3" />
                        {story.conversions.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-slate-400 font-mono">
                      {story.conversionRate}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
