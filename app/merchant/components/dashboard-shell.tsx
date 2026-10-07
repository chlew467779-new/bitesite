'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { ArrowLeft, BookOpen, Briefcase, Camera, ChartColumn, ChevronRight, Clock, MessageSquare, Palette, Store, UtensilsCrossed } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { useT, type MessageKey } from '@/lib/i18n';

/**
 * Owner dashboard shell (R9): a home screen of tiles, and one part of the dashboard at a time.
 *
 * Every section stays mounted while hidden, so unsaved typing survives moving between views and
 * the existing save / leave checks keep working unchanged. The open view lives in the address
 * hash (#menu, #hours…), so the phone's back gesture returns to the home screen.
 */

export type DashboardView = 'menu' | 'hours' | 'photos' | 'info' | 'style' | 'stats' | 'jobs' | 'stories' | 'feedback';

export const DASHBOARD_TILES: { id: DashboardView; title: MessageKey; hint: MessageKey; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'menu', title: 'owner.tile.menu', hint: 'owner.tile.menuHint', icon: UtensilsCrossed },
  { id: 'hours', title: 'owner.tile.hours', hint: 'owner.tile.hoursHint', icon: Clock },
  { id: 'photos', title: 'owner.tile.photos', hint: 'owner.tile.photosHint', icon: Camera },
  { id: 'info', title: 'owner.tile.info', hint: 'owner.tile.infoHint', icon: Store },
  { id: 'style', title: 'owner.tile.style', hint: 'owner.tile.styleHint', icon: Palette },
  { id: 'stats', title: 'owner.tile.stats', hint: 'owner.tile.statsHint', icon: ChartColumn },
  { id: 'jobs', title: 'owner.tile.jobs', hint: 'owner.tile.jobsHint', icon: Briefcase },
  { id: 'stories', title: 'owner.tile.stories', hint: 'owner.tile.storiesHint', icon: BookOpen },
  { id: 'feedback', title: 'owner.tile.feedback', hint: 'owner.tile.feedbackHint', icon: MessageSquare },
];

// Older links and the checklist point at a section (#about); each belongs to one view.
const SECTION_VIEW: Record<string, DashboardView> = { basics: 'info', about: 'info', contact: 'info' };
const VIEWS = new Set<string>(DASHBOARD_TILES.map((tile) => tile.id));

function fromHash(hash: string): { view: DashboardView | null; section: string | null } {
  const id = hash.replace(/^#/, '');
  if (VIEWS.has(id)) return { view: id as DashboardView, section: null };
  if (SECTION_VIEW[id]) return { view: SECTION_VIEW[id], section: id };
  return { view: null, section: null };
}

type Shown = { view: DashboardView | null; section: string | null; at: number };

export function useDashboardView() {
  const [shown, setShown] = useState<Shown>({ view: null, section: null, at: 0 });
  const view = shown.view;
  // True while the open view was reached from the home screen in this visit (one history entry).
  const pushed = useRef(false);
  const show = useCallback((hash: string) => setShown({ ...fromHash(hash), at: Date.now() }), []);

  // After the view is drawn: a later section of a view (#contact) scrolls into place, anything else starts at the top.
  useEffect(() => {
    if (!shown.at) return;
    if (shown.section) document.getElementById(shown.section)?.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0 });
  }, [shown]);

  useEffect(() => {
    const sync = () => {
      if (!window.location.hash) pushed.current = false;
      show(window.location.hash);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [show]);

  // From home, a view adds one history entry so the phone's back gesture comes home; moving
  // between views (desktop side list) replaces it, so back never walks through every view.
  const home = useCallback(() => {
    if (pushed.current) { pushed.current = false; window.history.back(); return; }
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    show('');
  }, [show]);
  const open = useCallback((target: string) => {
    if (!target) { home(); return; }
    if (window.location.hash) window.location.replace(`#${target}`);
    else { pushed.current = true; window.location.hash = target; }
  }, [home]);

  return { view, open, home };
}

export function viewOfSection(section: string): string {
  return SECTION_VIEW[section] ?? section;
}

export function DashboardTiles({ tiles, attention, onOpen }: { tiles: typeof DASHBOARD_TILES; attention: Set<DashboardView>; onOpen: (id: DashboardView) => void }) {
  const t = useT();
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const needs = attention.has(tile.id);
        return (
          <li key={tile.id}>
            <button
              type="button"
              onClick={() => onOpen(tile.id)}
              className={`flex h-full min-h-[96px] w-full flex-col items-start gap-1 rounded-[20px] border p-4 text-left transition-colors [-webkit-tap-highlight-color:transparent] hover:bg-surface ${needs ? 'border-kaya bg-[#FFF8EC]' : 'border-line bg-page'}`}
            >
              <span className="flex w-full items-center justify-between">
                <Icon className="size-5 text-brand" />
                {needs && <span className="rounded-full bg-kaya px-2 py-0.5 text-[11px] font-bold text-kaya-ink">{t('owner.home.todo')}</span>}
              </span>
              <span className="mt-1 text-[15px] font-bold text-ink">{t(tile.title)}</span>
              <span className="text-xs leading-snug text-muted">{t(tile.hint)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Desktop side list of the same views. */
export function DashboardSideNav({ tiles, view, onOpen }: { tiles: typeof DASHBOARD_TILES; view: DashboardView | null; onOpen: (id: DashboardView | '') => void }) {
  const t = useT();
  const item = (active: boolean) => `flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 text-left text-sm font-semibold transition-colors ${active ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-surface hover:text-ink'}`;
  return (
    <nav aria-label={t('owner.home.sections')} className="hidden lg:block">
      <ul className="space-y-1">
        <li><button type="button" onClick={() => onOpen('')} aria-current={view === null ? 'page' : undefined} className={item(view === null)}>{t('owner.home.title')}</button></li>
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <li key={tile.id}>
              <button type="button" onClick={() => onOpen(tile.id)} aria-current={view === tile.id ? 'page' : undefined} className={item(view === tile.id)}>
                <Icon className="size-4" />{t(tile.title)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Top of an open view: back to the home screen and the view's name. */
export function ViewBar({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useT();
  return (
    <div className="sticky top-[60px] z-30 -mx-4 flex items-center gap-2 border-b border-line bg-page/95 px-2 py-1 backdrop-blur-sm sm:-mx-6 sm:px-4 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
      <IconButton label={t('owner.home.back')} variant="soft" onClick={onBack} className="lg:hidden"><ArrowLeft className="size-5" /></IconButton>
      <h1 className="min-w-0 truncate text-lg font-extrabold tracking-[-0.02em] text-ink lg:text-[28px]">{title}</h1>
    </div>
  );
}

export function ChecklistLink({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-semibold text-ink">
      <span className="flex items-center gap-2"><span aria-hidden="true" className="size-4 rounded-full border-2 border-brand" />{label}</span>
      <ChevronRight className="size-4 text-muted" />
    </button>
  );
}
