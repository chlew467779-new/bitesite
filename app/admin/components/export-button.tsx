/* bitesite/app/admin/components/export-button.tsx */
'use client';

import { useState } from 'react';
import { useAuth } from './auth-context';
import { Download, FileSpreadsheet, CheckCircle } from 'lucide-react';

interface ExportButtonProps {
  range: string;
}

export default function ExportButton({ range }: ExportButtonProps) {
  const { token } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    if (!token || downloading) return;
    setDownloading(true);
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/export?range=${range}&format=csv`, {
        headers: { 'x-admin-token': token },
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bitesite-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        alert('Export failed. Please try again.');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
        <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Export Analytics Data</h3>
      <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
        Download a CSV file containing all analytics data for the selected date range.
        Each row represents one merchant's daily aggregated metrics.
      </p>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleExport}
          disabled={downloading}
          className={`
            inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
            ${success
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {downloading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
              Downloading...
            </>
          ) : success ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Downloaded!
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download CSV
            </>
          )}
        </button>
      </div>

      <p className="text-slate-600 text-xs mt-4">
        File: bitesite-analytics-{new Date().toISOString().split('T')[0]}.csv
      </p>
    </div>
  );
}
