"use client";
import { useT } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
export default function ResetPasswordPage() {
  const t = useT();
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
    if (password.length < 8 || password.length > 1024 || password !== confirm) { setError(t('owner.password.useAtLeast8CharactersAnd')); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(t('owner.password.couldNotUpdateYourPasswordRequest'));
      setPassword(''); setConfirm(''); setDone(true); await supabase.auth.signOut();
    } catch (error) { setError(error instanceof Error ? error.message : t('owner.common.pleaseTryAgain')); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-page px-4 py-12"><div className="mx-auto max-w-md rounded-[20px] border bg-white p-6 sm:p-8">
    <h1 className="font-extrabold tracking-[-0.02em] text-3xl text-ink">{t('owner.password.setYourPassword')}</h1>
    {done ? <p role="status" className="mt-4">{t('owner.password.yourPasswordHasBeenUpdatedSign')}</p> : !ready ? <p className="mt-4">{t('owner.password.openThePasswordResetLinkFrom')}</p> : <form onSubmit={submit} className="mt-6 space-y-4">
      <label htmlFor="reset-password" className="block">{t('owner.password.newPassword')}<input id="reset-password" required type="password" minLength={8} maxLength={1024} autoComplete="new-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2.5 min-h-11 text-base" /></label>
      <label htmlFor="reset-confirm-password" className="block">{t('owner.common.confirmPassword')}<input id="reset-confirm-password" required type="password" maxLength={1024} autoComplete="new-password" value={confirm} disabled={busy} onChange={event => setConfirm(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2.5 min-h-11 text-base" /></label>
      <button disabled={busy} className={cn(buttonClasses({ variant: 'primary', size: 'md' }), 'min-w-11 whitespace-normal', "min-h-11 w-full p-3 disabled:opacity-50")}>{busy ? t('owner.common.saving') : t('owner.password.savePassword')}</button>
    </form>}{error && <p role="alert" className="mt-4 text-red-700">{error}</p>}<Link href="/merchant/login" className="mt-5 inline-flex min-h-11 w-full items-center justify-center text-brand underline">{t('owner.password.backToSignIn')}</Link>
  </div></main>;
}
