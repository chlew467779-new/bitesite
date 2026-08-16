/* bitesite/lib/supabase.ts */

import { createClient } from "@supabase/supabase-js";
import type { Merchant, Category, Product, MerchantVideo } from "@/types";

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
