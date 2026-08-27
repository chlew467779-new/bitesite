/* bitesite/app/admin/components/date-range-picker.tsx */
'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

const ranges = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '365d', label: 'Last Year' },
];

interface DateRangePickerProps {
  value: string;
  onChange: (range: string) => void;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = ranges.find(r => r.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 transition-colors"
      >
        <Calendar className="w-4 h-4 text-slate-400" />
        <span>{selected?.label || 'Last 7 Days'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
            {ranges.map((range) => (
              <button
                key={range.value}
                onClick={() => {
                  onChange(range.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  value === range.value
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
