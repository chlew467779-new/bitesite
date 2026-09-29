'use client';

import { useEffect } from 'react';
import { PAYMENT_METHODS } from '@/lib/presets';
import { useSectionSave } from '@/app/components/section-save/use-section-save';
import { SectionSaveBar } from '@/app/components/section-save/section-save-bar';
import type { SectionProps } from '@/app/components/section-save/hours-section';

/** Payment methods (issue #8): the owner's choice appears on the page at once, without review. */

const paths = ['tags.payment'];
const labels = [{ path: 'tags.payment', label: 'Payment methods' }];
const HINTS: Record<string, string> = { Cash: 'Cash', Cashless: 'e-wallets and QR, e.g. DuitNow, Touch ’n Go', Cards: 'debit and credit cards' };

export function PaymentSection(props: SectionProps) {
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('payment', section.handle); return () => register('payment', null); }, [register, section.handle]);
  const value = section.state.draft['tags.payment'];
  const chosen = (Array.isArray(value) ? value : []) as string[];
  const toggle = (method: string) => section.edit('tags.payment', chosen.includes(method) ? chosen.filter((m) => m !== method) : [...chosen, method]);

  return (
    <div className="space-y-3">
      <fieldset disabled={props.readOnly}>
        <legend className="text-sm font-medium text-[#2C3E2D]">Payment methods</legend>
        <p className="mt-1 text-xs text-[#6B6560]">Changes show on your page right away.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((method) => (
            <button key={method} type="button" aria-pressed={chosen.includes(method)} title={HINTS[method]} onClick={() => toggle(method)}
              className={`min-h-11 rounded-full border px-4 text-sm disabled:opacity-50 ${chosen.includes(method) ? 'border-[#2C3E2D] bg-[#2C3E2D] text-white' : 'border-[#C9D6C7]'}`}>
              {method}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#6B6560]">Cashless means {HINTS.Cashless}.</p>
      </fieldset>
      {section.state.error?.fieldErrors?.['tags.payment'] && <p role="alert" className="text-sm text-red-700">{section.state.error.fieldErrors['tags.payment']}</p>}
      <SectionSaveBar state={section.state} labels={labels} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome} savedMessage="Saved." onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}
