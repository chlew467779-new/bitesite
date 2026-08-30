/* bitesite/app/admin/components/settings-panel.tsx */

'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from './auth-context';

interface Setting {
  id: number;
  key: string;
  value: string;
  description: string;
}

const settingLabels: Record<string, string> = {
  site_title: '网站标题',
  site_description: '网站描述（SEO）',
  footer_text: '商家页面底部文案',
};

const settingPlaceholders: Record<string, string> = {
  site_title: 'BiteSite',
  site_description: 'Discover the best restaurants in Kuala Lumpur',
  footer_text: 'Discover more restaurants on BiteSite',
};

export function SettingsPanel() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'x-admin-token': token || '' },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const filtered = (data.settings || []).filter((s: Setting) => 
        ['site_title', 'site_description', 'footer_text'].includes(s.key)
      );
      setSettings(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    setSaving(key);
    setSaved(null);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-token': token || '',
        },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error && settings.length === 0) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-400 text-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {settings.map((setting) => (
        <div key={setting.key} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-200">
              {settingLabels[setting.key] || setting.key}
            </label>
            <div className="flex items-center gap-2">
              {saved === setting.key && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 size={14} /> 已保存
                </span>
              )}
              {saving === setting.key && (
                <Loader2 size={14} className="text-amber-500 animate-spin" />
              )}
            </div>
          </div>
          {setting.description && (
            <p className="text-xs text-slate-500 mb-2">{setting.description}</p>
          )}
          <input
            type="text"
            defaultValue={setting.value}
            placeholder={settingPlaceholders[setting.key] || ''}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
            onBlur={(e) => {
              if (e.target.value !== setting.value) {
                updateSetting(setting.key, e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </div>
      ))}

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="rounded-xl border border-amber-900/30 bg-amber-950/20 p-4">
        <p className="text-xs text-amber-400/80 leading-relaxed">
          💡 提示：修改后按 Enter 或点击外部区域自动保存。site_title 控制网站标题，site_description 控制 SEO 和分享描述，footer_text 控制商家页面底部文案。
        </p>
      </div>
    </div>
  );
}
