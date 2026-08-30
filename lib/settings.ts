/* bitesite/lib/settings.ts */

import { supabase } from "@/lib/supabase";

export interface SiteSettings {
  site_title: string;
  site_description: string;
  contact_email: string;
  contact_phone: string;
  whatsapp_number: string;
  footer_text: string;
}

const defaultSettings: SiteSettings = {
  site_title: "BiteSite",
  site_description:
    "Discover the best local restaurants, cafes, and hidden gems in Kuala Lumpur. Browse menus, photos, and stories — every bite tells a story.",
  contact_email: "hello@bitesite.my",
  contact_phone: "+60 16-566 0239",
  whatsapp_number: "60165660239",
  footer_text: "Discover more restaurants on BiteSite",
};

export async function getSettings(): Promise<SiteSettings> {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("key, value");

    if (error || !data) {
      console.error("Failed to load settings:", error);
      return defaultSettings;
    }

    const settings = { ...defaultSettings };
    data.forEach((row) => {
      if (row.key in settings) {
        (settings as Record<string, string>)[row.key] = row.value;
      }
    });

    return settings;
  } catch (err) {
    console.error("Settings load error:", err);
    return defaultSettings;
  }
}

export async function getSetting(
  key: keyof SiteSettings
): Promise<string> {
  const settings = await getSettings();
  return settings[key];
}
