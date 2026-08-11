export type MerchantStyle = "fresh" | "luxury" | "japanese";

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
  video_type: "youtube" | "self_hosted" | "none";
  video_caption: string | null;
  reference_website: string | null;
  custom_style: boolean;
  style: MerchantStyle;
  is_published: boolean;
  created_at: string;
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
