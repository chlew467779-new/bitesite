"use client";
import { useT } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { validateCredentials } from '@/lib/merchant-auth-validation.mjs';

type Mode = 'login' | 'register' | 'forgot';
export default function MerchantLoginPage() {
  const t = useT();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'register') setMode('register');
  }, []);
  function changeMode(next: Mode) { setMode(next); setPassword(''); setConfirm(''); setError(''); setMessage(''); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      if (mode === 'login') {
        const input = validateCredentials({ email, password });
        if (!input) throw new Error(t('owner.login.enterAValidEmailAndPassword'));
        const response = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t('owner.login.couldNotSignIn'));
        const { error } = await supabase.auth.setSession(data.session);
        if (error) throw new Error(t('owner.login.couldNotSignInPleaseTry'));
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- keep the full reload after authentication to reset client state
        window.location.href = '/merchant';
      } else if (mode === 'register') {
        const input = validateCredentials({ email, password }, true);
        if (!input) throw new Error(t('owner.login.useAValidEmailAndA'));
        if (password !== confirm) throw new Error(t('owner.login.passwordsDoNotMatch'));
        const { data, error } = await supabase.auth.signUp({ ...input, options: { emailRedirectTo: `${window.location.origin}/merchant` } });
        if (error) throw new Error(t('owner.login.couldNotRegisterPleaseTryAgain'));
        setPassword(''); setConfirm('');
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- keep the full reload after authentication to reset client state
        if (data.session) window.location.href = '/merchant';
        else setMessage(t('owner.login.checkYourInboxToConfirmYour'));
      } else {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/merchant/reset-password` });
        if (result.error && !['user_not_found', 'signup_disabled'].includes(result.error.code || '')) throw new Error(t('owner.login.couldNotSendAnEmailPlease'));
        setMessage(t('owner.login.ifThisEmailHasAnAccount'));
      }
    } catch (error) { setError(error instanceof Error ? error.message : t('owner.common.pleaseTryAgain')); }
    finally { setLoading(false); }
  }
  const title = { login: t('owner.login.merchantSignIn'), register: t('owner.login.createYourMerchantAccount'), forgot: t('owner.login.forgotPassword') }[mode];
  return <main className="min-h-screen bg-page px-4 py-12 sm:py-20"><div className="mx-auto max-w-md rounded-[20px] border border-line bg-white p-6 shadow-sm sm:p-8">
    <h1 className="font-extrabold tracking-[-0.02em] text-3xl text-ink">{title}</h1>
    <p className="mt-2 text-sm text-muted">{mode === 'register' ? t('owner.login.confirmYourEmailThenCreateA') : t('owner.login.manageYourRestaurantsWithYourMerchant')}</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label htmlFor="merchant-email" className="block text-sm font-medium text-ink">{t('owner.common.email')}<input id="merchant-email" required type="email" maxLength={254} value={email} disabled={loading} onChange={event => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 min-h-11 w-full rounded-lg border border-line-strong px-3 py-2.5 min-h-11 text-base" /></label>
      {(mode === 'login' || mode === 'register') && <label htmlFor="merchant-password" className="block text-sm font-medium text-ink">{t('owner.login.password')}<input id="merchant-password" required type="password" minLength={mode === 'register' ? 8 : 1} maxLength={1024} aria-describedby={mode === 'register' ? 'merchant-password-rules' : undefined} value={password} disabled={loading} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="mt-1.5 min-h-11 w-full rounded-lg border border-line-strong px-3 py-2.5 min-h-11 text-base" /></label>}
      {mode === 'register' && <><p id="merchant-password-rules" className="text-sm text-muted">{t('owner.login.use8To1024Characters')}</p><label htmlFor="merchant-confirm-password" className="block text-sm font-medium text-ink">{t('owner.common.confirmPassword')}<input id="merchant-confirm-password" required type="password" maxLength={1024} value={confirm} disabled={loading} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" className="mt-1.5 min-h-11 w-full rounded-lg border border-line-strong px-3 py-2.5 min-h-11 text-base" /></label></>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="break-words rounded-lg bg-brand-soft p-4 text-sm text-brand">{message}</p>}
      <button disabled={loading} className={cn(buttonClasses({ variant: 'primary', size: 'md' }), 'min-w-11 whitespace-normal', "min-h-11 w-full text-sm disabled:opacity-50")}>{loading ? t('owner.login.pleaseWait') : { login: t('owner.entry.signIn'), register: t('owner.login.register'), forgot: t('owner.login.sendPasswordResetLink') }[mode]}</button>
    </form>
    <nav aria-label={t('owner.login.accountOptions')} className="mt-5 flex flex-wrap gap-x-4 gap-y-3 text-sm text-brand">{(['login', 'register', 'forgot'] as Mode[]).filter(option => option !== mode).map(option => <button key={option} disabled={loading} type="button" onClick={() => changeMode(option)} className={cn(buttonClasses({ variant: 'ghost', size: 'md' }), 'min-w-11 whitespace-normal', "min-h-11 w-full text-left underline underline-offset-2 disabled:opacity-50 sm:w-auto")}>{{ login: t('owner.entry.signIn'), register: t('owner.login.createAnAccount'), forgot: t('owner.login.forgotPassword2') }[option]}</button>)}</nav>
    {mode === 'register' && <p className="mt-3 text-xs text-muted">{t('owner.login.howWeUseYourInformation')} <a href="/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-brand underline">{t('owner.common.privacyPolicy')}</a></p>}
  </div></main>;
}
