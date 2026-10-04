'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, ChevronDown, Copy, Loader2, ScanText } from 'lucide-react';
import { useAuth } from './auth-context';
import { formatPrice } from '@/lib/price-format.mjs';
import { compareWithMenu, MENU_IMPORT_PROMPT, parseMenuImport, type ParsedMenu } from '@/lib/menu-import-core.mjs';

/**
 * Admin menu import (CH 2026-09-30): paste what Gemini read from the restaurant's menu photos,
 * check the preview, add the new dishes. Dishes already on the menu are skipped, never changed.
 */

type Props = {
  merchantId: string;
  merchantName: string;
  categories: { id: string; name: string }[];
  products: { category_id: string | null; name: string }[];
  onImported: () => void;
  currency?: string;
};

export default function MenuImport({ merchantId, merchantName, categories, products, onImported, currency }: Props) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedMenu | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const preview = useMemo(() => {
    if (!parsed?.ok) return null;
    return compareWithMenu(parsed.categories, { categories, products: products.map((p) => ({ categoryId: p.category_id, name: p.name })) });
  }, [parsed, categories, products]);

  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(MENU_IMPORT_PROMPT); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    catch { setCopied(false); setResult({ ok: false, message: 'Could not copy. Open "Show the prompt" and copy it by hand.' }); }
  };

  const check = () => { setResult(null); setParsed(parseMenuImport(text)); };

  const importNow = async () => {
    if (!token || !parsed?.ok || !preview || busy) return;
    setBusy(true); setResult(null);
    try {
      const response = await fetch('/api/admin/menu-import', {
        method: 'POST',
        headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, categories: parsed.categories }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) throw new Error(body?.error?.message || 'The menu was not imported. Try again.');
      const { dishesCreated, categoriesCreated, skipped } = body.data as { dishesCreated: number; categoriesCreated: number; skipped: unknown[] };
      const unsure = preview.rows.flatMap((row) => row.dishes.filter((d) => d.unclear && !d.exists).map((d) => d.name));
      setResult({ ok: true, message: `Added ${dishesCreated} ${dishesCreated === 1 ? 'dish' : 'dishes'}${categoriesCreated ? ` in ${categoriesCreated} new ${categoriesCreated === 1 ? 'section' : 'sections'}` : ''}.${skipped.length ? ` ${skipped.length} already on the menu were left as they are.` : ''} ${unsure.length ? `Compare these with the photos: ${unsure.join(', ')}.` : 'Check the menu below against the photos.'}` });
      setText(''); setParsed(null);
      onImported();
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : 'The menu was not imported. Try again.' });
    } finally { setBusy(false); }
  };

  const blocked = !parsed?.ok || parsed.problems.length > 0 || !preview || preview.newDishes === 0;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left">
        <ScanText className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
        <span className="flex-1">
          <span className="block text-sm font-medium text-white">Import a menu from photos</span>
          <span className="block text-xs text-slate-400">For long menus: Gemini reads the photos, you check and add them here.</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-800 p-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
            <li>Ask the restaurant for clear photos of every page of the menu. Overlapping photos of a big menu are fine.</li>
            <li>In Gemini, upload all the photos and paste the prompt below.</li>
            <li>Copy Gemini&apos;s whole answer and paste it here, then check the preview.</li>
          </ol>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void copyPrompt()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-950 hover:bg-amber-400">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Prompt copied' : 'Copy the Gemini prompt'}
            </button>
            <details className="w-full text-sm text-slate-400">
              <summary className="min-h-11 cursor-pointer py-3">Show the prompt</summary>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{MENU_IMPORT_PROMPT}</pre>
            </details>
          </div>

          <div>
            <label htmlFor="menu-import-text" className="text-sm font-medium text-slate-200">Gemini&apos;s answer</label>
            <textarea id="menu-import-text" rows={8} value={text} onChange={(e) => { setText(e.target.value); setParsed(null); setResult(null); }}
              placeholder={'```json\n{ "categories": [ ... ] }\n```'}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none" />
            <button type="button" onClick={check} disabled={!text.trim()} className="mt-2 min-h-11 rounded-lg border border-slate-600 px-4 text-sm font-medium text-slate-200 disabled:opacity-50">Check</button>
          </div>

          {parsed && !parsed.ok && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{parsed.message}</p>
          )}

          {parsed?.ok && preview && (
            <div className="space-y-4">
              <p className="text-sm text-slate-200">
                <span className="font-semibold text-white">{preview.newDishes} new {preview.newDishes === 1 ? 'dish' : 'dishes'}</span>
                {preview.newCategories > 0 && <> in {preview.newCategories} new {preview.newCategories === 1 ? 'section' : 'sections'}</>}
                {parsed.total - preview.newDishes > 0 && <>; {parsed.total - preview.newDishes} already on the menu (skipped)</>}
                {parsed.merged > 0 && <>; {parsed.merged} repeated from overlapping photos (merged)</>}.
              </p>
              {parsed.problems.length > 0 && (
                <div role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
                  <p className="font-medium">Fix these in Gemini&apos;s answer (or ask Gemini again) before importing:</p>
                  <ul className="mt-1 list-disc pl-5">{parsed.problems.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              )}
              {(parsed.unclear > 0 || parsed.warnings.length > 0) && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
                  {parsed.unclear > 0 && <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{parsed.unclear} {parsed.unclear === 1 ? 'dish is' : 'dishes are'} marked &quot;Check&quot;: Gemini was not sure. Compare with the photo after importing.</p>}
                  {parsed.warnings.length > 0 && <ul className="mt-1 list-disc pl-5">{parsed.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
                </div>
              )}
              {parsed.notes.length > 0 && (
                <div className="rounded-lg bg-slate-950 p-3 text-sm text-slate-400">
                  <p className="font-medium text-slate-300">Gemini&apos;s notes</p>
                  <ul className="mt-1 list-disc pl-5">{parsed.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                </div>
              )}

              <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {preview.rows.map((row) => (
                  <div key={row.name} className="rounded-lg border border-slate-800">
                    <p className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950/50 px-3 py-2 text-sm font-medium text-white">
                      {row.name}
                      {row.isNew && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">New section</span>}
                    </p>
                    <ul className="divide-y divide-slate-800/60">
                      {row.dishes.map((dish) => (
                        <li key={dish.name} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm ${dish.exists ? 'text-slate-500' : 'text-slate-200'}`}>
                          <span className="min-w-0 flex-1 break-words">
                            {dish.name}
                            {dish.description && <span className="block text-xs text-slate-500">{dish.description}</span>}
                          </span>
                          {dish.unclear && !dish.exists && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">Check</span>}
                          {dish.exists && <span className="text-xs">already on the menu</span>}
                          <span className="tabular-nums">{dish.price === null ? 'No price' : formatPrice(dish.price, currency)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <button type="button" onClick={() => void importNow()} disabled={blocked || busy}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-50 sm:w-auto">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {preview.newDishes === 0 ? 'Nothing new to add' : `Add ${preview.newDishes} ${preview.newDishes === 1 ? 'dish' : 'dishes'} to ${merchantName}`}
              </button>
            </div>
          )}

          {result && <p role={result.ok ? 'status' : 'alert'} className={`rounded-lg p-3 text-sm ${result.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{result.message}</p>}
        </div>
      )}
    </section>
  );
}
