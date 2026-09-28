"use client";
import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { validateCredentials } from '@/lib/merchant-auth-validation.mjs';
import { safeMerchantNext } from '@/lib/merchant-claim-core.mjs';

// Where to go after sign-in: a same-site /merchant path from ?next= (e.g. the claim page), else the dashboard.
const afterSignIn = () => safeMerchantNext(new URLSearchParams(window.location.search).get('next'));

type Mode = 'login' | 'register' | 'forgot' | 'magic';
export default function MerchantLoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  function changeMode(next: Mode) { setMode(next); setPassword(''); setConfirm(''); setError(''); setMessage(''); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      if (mode === 'login') {
        const input = validateCredentials({ email, password });
        if (!input) throw new Error('Enter a valid email and password.');
        const response = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not sign in.');
        const { error } = await supabase.auth.setSession(data.session);
        if (error) throw new Error('Could not sign in. Please try again.');
        window.location.href = afterSignIn();
      } else if (mode === 'register') {
        const input = validateCredentials({ email, password }, true);
        if (!input) throw new Error('Use a valid email and a password of at least 8 characters.');
        if (password !== confirm) throw new Error('Passwords do not match.');
        const { data, error } = await supabase.auth.signUp({ ...input, options: { emailRedirectTo: `${window.location.origin}${afterSignIn()}` } });
        if (error) throw new Error('Could not register. Please try again or sign in to your existing account.');
        setPassword(''); setConfirm('');
        if (data.session) window.location.href = afterSignIn();
        else setMessage('Check your inbox to confirm your email, then sign in to create your restaurant draft. If you already have an account, sign in or reset your password.');
      } else {
        const result = mode === 'forgot'
          ? await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/merchant/reset-password` })
          : await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/merchant` } });
        if (result.error && !['user_not_found', 'signup_disabled'].includes(result.error.code || '')) throw new Error('Could not send an email. Please wait a minute and try again.');
        setMessage('If this email has an account, check your inbox and spam folder for the link.');
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setLoading(false); }
  }
  const title = { login: 'Merchant sign in', register: 'Create your merchant account', forgot: 'Forgot password', magic: 'Email me a magic link' }[mode];
  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-12 sm:py-20"><div className="mx-auto max-w-md rounded-2xl border border-[#DDE5DC] bg-white p-6 shadow-sm sm:p-8">
    <h1 className="font-serif text-3xl text-[#2C3E2D]">{title}</h1>
    <p className="mt-2 text-sm text-[#6B6560]">{mode === 'register' ? 'Confirm your email, then create a private restaurant draft.' : 'Manage your restaurants with your merchant account.'}</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-medium text-[#2C3E2D]">Email<input required type="email" maxLength={254} value={email} disabled={loading} onChange={event => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-lg border border-[#C9D6C7] px-3 py-2.5" /></label>
      {(mode === 'login' || mode === 'register') && <label className="block text-sm font-medium text-[#2C3E2D]">Password<input required type="password" minLength={mode === 'register' ? 8 : 1} maxLength={1024} value={password} disabled={loading} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="mt-1.5 w-full rounded-lg border border-[#C9D6C7] px-3 py-2.5" /></label>}
      {mode === 'register' && <><p className="text-sm text-[#6B6560]">At least 8 characters. A long passphrase is welcome.</p><label className="block text-sm font-medium text-[#2C3E2D]">Confirm password<input required type="password" maxLength={1024} value={confirm} disabled={loading} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" className="mt-1.5 w-full rounded-lg border border-[#C9D6C7] px-3 py-2.5" /></label></>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="break-words rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
      <button disabled={loading} className="min-h-11 w-full rounded-lg bg-[#2C3E2D] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{loading ? 'Please wait…' : { login: 'Sign in', register: 'Register', forgot: 'Send password reset link', magic: 'Send magic link' }[mode]}</button>
    </form>
    <nav aria-label="Account options" className="mt-5 flex flex-wrap gap-x-4 gap-y-3 text-sm text-emerald-800">{(['login', 'register', 'forgot', 'magic'] as Mode[]).filter(option => option !== mode).map(option => <button key={option} disabled={loading} type="button" onClick={() => changeMode(option)} className="min-h-11 w-full text-left underline underline-offset-2 disabled:opacity-50 sm:w-auto">{{ login: 'Sign in', register: 'Create an account', forgot: 'Forgot password?', magic: 'Use a magic link' }[option]}</button>)}</nav>
  </div></main>;
}
