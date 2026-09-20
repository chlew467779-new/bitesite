'use client';

import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { useAuth } from './auth-context';

type Props = { kind: 'merchant' | 'story' | 'menu'; value: string; onChange: (value: string) => void; label: string; help?: string };

export default function ImageUpload({ kind, value, onChange, label, help }: Props) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(file: File) {
    if (!token) return;
    setBusy(true); setError('');
    try {
      const maxWidth = kind === 'menu' ? 800 : 1200;
      const quality = kind === 'menu' ? 0.6 : 0.75;
      const compressed = await imageCompression(file, { maxWidthOrHeight: maxWidth, initialQuality: quality, useWebWorker: true, fileType: 'image/webp' });
      const response = await fetch('/api/admin/media/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify({ kind, contentType: compressed.type || 'image/webp', size: compressed.size }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not prepare upload');
      const { error: uploadError } = await supabase.storage.from(data.bucket).uploadToSignedUrl(data.path, data.token, compressed);
      if (uploadError) throw uploadError;
      onChange(supabase.storage.from(data.bucket).getPublicUrl(data.path).data.publicUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally { setBusy(false); }
  }
  return <div className="space-y-2"><label className="block text-sm font-medium text-slate-300">{label}</label><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ''; }} className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200" />{help && <p className="text-xs text-slate-500">{help}</p>}{busy && <p className="text-xs text-amber-400">Compressing and uploading…</p>}{error && <p role="alert" className="text-xs text-red-400">{error}</p>}{value && <img src={value} alt="Uploaded preview" className="h-24 w-36 rounded-lg border border-slate-700 object-cover" />}</div>;
}
