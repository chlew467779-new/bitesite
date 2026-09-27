"use client";
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (active) setReady(Boolean(session)); });
    void supabase.auth.getSession().then(({ data }) => { if (active) setReady(Boolean(data.session)); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (password.length < 8 || password.length > 1024 || password !== confirm) { setError('Use at least 8 characters and make sure the passwords match.'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error('Could not update your password. Request a new reset link or try again.');
      setPassword(''); setConfirm(''); setDone(true); await supabase.auth.signOut();
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-12"><div className="mx-auto max-w-md rounded-2xl border bg-white p-6 sm:p-8">
    <h1 className="font-serif text-3xl text-[#2C3E2D]">Set your password</h1>
    {done ? <p role="status" className="mt-4">Your password has been updated. Sign in with your new password.</p> : !ready ? <p className="mt-4">Open the password reset link from your email. If it expired, request a new one.</p> : <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">New password<input required type="password" minLength={8} maxLength={1024} autoComplete="new-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2.5" /></label>
      <label className="block">Confirm password<input required type="password" maxLength={1024} autoComplete="new-password" value={confirm} disabled={busy} onChange={event => setConfirm(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2.5" /></label>
      <button disabled={busy} className="min-h-11 w-full rounded-lg bg-[#2C3E2D] p-3 text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save password'}</button>
    </form>}{error && <p role="alert" className="mt-4 text-red-700">{error}</p>}<Link href="/merchant/login" className="mt-5 inline-flex min-h-11 w-full items-center justify-center text-emerald-800 underline">Back to sign in</Link>
  </div></main>;
}
