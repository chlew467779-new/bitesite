/* bitesite/lib/jobs-public.ts */

/**
 * Public job post reads (#23) for /jobs and the "We're hiring" block on store pages (ChatGPT G21).
 * Anon client: row level security returns only open, unhidden, unexpired posts of public
 * restaurants, with the restaurant's public columns. Every function returns [] / null when the
 * release SQL has not run yet (no table), so pages can render the "no jobs" state and stay up.
 * Apply links: jobWhatsappHref() in lib/merchant-jobs-core.mjs, or tel: with the phone.
 */

import { supabase } from '@/lib/supabase';
import type { JobType } from '@/lib/merchant-jobs-core.mjs';

export interface PublicJobRestaurant {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  whatsapp: string | null;
  phone: string | null;
}

export interface PublicJob {
  id: string;
  title: string;
  jobType: JobType;
  salary: string | null;
  hours: string;
  description: string;
  expiresAt: string;
  createdAt: string;
  restaurant: PublicJobRestaurant;
}

const JOB_SELECT = 'id, title, job_type, salary, hours, description, expires_at, created_at, merchants!inner(id, slug, name, area, whatsapp, phone)';

type JobRow = {
  id: string;
  title: string;
  job_type: JobType;
  salary: string | null;
  hours: string;
  description: string;
  expires_at: string;
  created_at: string;
  merchants: PublicJobRestaurant | PublicJobRestaurant[] | null;
};

function toJob(row: JobRow): PublicJob | null {
  const restaurant = Array.isArray(row.merchants) ? row.merchants[0] : row.merchants;
  if (!restaurant) return null;
  return {
    id: row.id, title: row.title, jobType: row.job_type, salary: row.salary, hours: row.hours,
    description: row.description, expiresAt: row.expires_at, createdAt: row.created_at, restaurant,
  };
}

function rows(data: unknown): PublicJob[] {
  return ((data as JobRow[] | null) ?? []).map(toJob).filter((job): job is PublicJob => job !== null);
}

/** Newest open posts across all public restaurants. */
export async function getOpenJobs(limit = 100): Promise<PublicJob[]> {
  const { data, error } = await supabase.from('merchant_jobs').select(JOB_SELECT)
    .order('created_at', { ascending: false }).limit(Math.min(Math.max(limit, 1), 200));
  if (error) return [];
  return rows(data);
}

/** Open posts of one restaurant (store page block). */
export async function getRestaurantJobs(merchantId: string): Promise<PublicJob[]> {
  const { data, error } = await supabase.from('merchant_jobs').select(JOB_SELECT)
    .eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(10);
  if (error) return [];
  return rows(data);
}

/** One open post, or null when it is closed, hidden, expired, unknown or the SQL has not run. */
export async function getOpenJob(id: string): Promise<PublicJob | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const { data, error } = await supabase.from('merchant_jobs').select(JOB_SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return toJob(data as unknown as JobRow);
}
