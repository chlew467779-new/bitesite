/* bitesite/app/admin/components/search-keywords-table.tsx */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { Search } from 'lucide-react';

interface KeywordData {
  keyword: string;
  count: number;
}

interface SearchKeywordsTableProps {
  range: string;
}

export default function SearchKeywordsTable({ range }: SearchKeywordsTableProps) {
  const { token } = useAuth();
  const [data, setData] = useState<KeywordData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search-keywords?range=${range}`, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json.data || []);
        }
      } catch (err) {
        console.error('SearchKeywordsTable fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [range, token]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Top Search Keywords</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-medium text-slate-300">Top Search Keywords</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-6 py-3 text-slate-500 font-medium">#</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Keyword</th>
              <th className="text-right px-6 py-3 text-slate-500 font-medium">Searches</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                  No search data for this period.
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={item.keyword}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-6 py-3 text-slate-500">{index + 1}</td>
                  <td className="px-6 py-3 text-slate-200">{item.keyword}</td>
                  <td className="px-6 py-3 text-right text-slate-300 font-mono">
                    {item.count.toLocaleString()}
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
