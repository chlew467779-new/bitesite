/* bitesite/types/index.ts */

export type MerchantStyle = "fresh" | "luxury" | "japanese";

export interface MerchantFeatures {
  hero: boolean;
  about: boolean;
  menu: boolean;
  contact: boolean;
  gallery: boolean;
  reviews: boolean;
  appointment: boolean;
  seasonal_popup: boolean;
  events: boolean;
}

export interface Review {
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface Merchant {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cuisine_type: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  cover_image: string | null;
  logo_image: string | null;
  operating_hours: Record<string, string> | null;
  dress_code: string | null;
  menu_pdf_url: string | null;
  video_url: string | null;
  video_type: string | null;
  video_caption: string | null;
  reference_website: string | null;
  custom_style: Record<string, unknown> | null;
  style: string;
  is_published: boolean;
  created_at: string;
  layout: string;
  features: MerchantFeatures;
  settings: Record<string, unknown>;
  status: string;
  area: string | null;
  tags: string[];
  payment_methods: string[];
  latitude: number | null;
  longitude: number | null;
  reviews?: Review[] | null;
}

export interface Category {
  id: string;
  merchant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  is_available: boolean;
  discount_price: number | null;
  show_prices: boolean;
}

export interface MerchantVideo {
  id: string;
  merchant_id: string;
  video_url: string;
  video_type: "youtube" | "self_hosted";
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  category: string;
  tags: string[] | null;
  merchant_slug: string | null;
  author: string;
  published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface LayoutProps {
  merchant: Merchant;
  categories: Category[];
  products: Product[];
  videos?: MerchantVideo[];
  features?: MerchantFeatures;
  viewCount?: number;
}

export const defaultFeatures: MerchantFeatures = {
  hero: true,
  about: true,
  menu: true,
  contact: true,
  gallery: false,
  reviews: false,
  appointment: false,
  seasonal_popup: false,
  events: false,
};

export function mergeFeatures(partial?: Partial<MerchantFeatures>): MerchantFeatures {
  return { ...defaultFeatures, ...partial };
}
