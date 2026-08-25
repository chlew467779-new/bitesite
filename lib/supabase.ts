/* bitesite/lib/supabase.ts */

import { createClient } from "@supabase/supabase-js";
import { isCurrentlyOpen, getTodayKey } from "@/lib/hours";   // ← 新增
import type { Merchant, Category, Product, MerchantVideo, EventItem } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getPublishedMerchants(): Promise<Merchant[]> {
  const { data, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getMerchantBySlug(slug: string): Promise<Merchant | null> {
  const { data, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error) return null;
  return data;
}

export async function getCategoriesByMerchant(merchantId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getProductsByMerchant(merchantId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getVideosByMerchant(merchantId: string): Promise<MerchantVideo[]> {
  const { data, error } = await supabase
    .from("merchant_videos")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

// ── 相关商家推荐（按 营业中 → cuisine → tags → 地区 优先级匹配）──
export async function getRelatedMerchants(
  currentSlug: string,
  cuisineType: string | null,
  tags: string[] | null,
  area: string | null,
  limit: number = 3
): Promise<Merchant[]> {
  const { data: allMerchants, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("is_published", true)
    .neq("slug", currentSlug);

  if (error || !allMerchants) return [];
  const merchants = allMerchants as Merchant[];

  const todayKey = getTodayKey();

  const scored = merchants.map((m) => {
    let score = 0;

    // 第 0 层：正在营业（权重最高 +20）
    const todayHours = m.operating_hours?.[todayKey];
    if (todayHours && isCurrentlyOpen(todayHours)) {
      score += 20;
    }

    // 第 1 层：同 cuisine_type
    if (cuisineType && m.cuisine_type?.toLowerCase() === cuisineType.toLowerCase()) {
      score += 10;
    }

    // 第 2 层：tags 重叠
    if (tags && m.tags) {
      const overlap = m.tags.filter((t) =>
        tags.map((tag) => tag.toLowerCase()).includes(t.toLowerCase())
      ).length;
      score += overlap * 3;
    }

    // 第 3 层：同地区
    if (area && m.area?.toLowerCase() === area.toLowerCase()) {
      score += 5;
    }

    return { merchant: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.merchant);
}

export async function getMerchantsForMap(): Promise<Merchant[]> {
  const { data, error } = await supabase
    .from("merchants")
    .select("*")
    .eq("is_published", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error) throw error;
  return data || [];
}

export async function getEventsByMerchant(merchantId: string): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("date", { ascending: true });

  if (error) throw error;
  return (data || []) as EventItem[];
}
