# BiteSite

Beautiful Menus for Local Restaurants — Kuala Lumpur, Malaysia.

> **Live URL**: https://bitesite-pied.vercel.app  
> **GitHub**: https://github.com/chlew467779-new/bitesite  
> **Owner**: CH (BiteSite)

---

## 📌 Code Convention — IMPORTANT

**Every new file MUST have a path comment at the very top:**

```tsx
/* bitesite/app/page.tsx */

"use client";
// ... rest of the code
```

```ts
/* bitesite/lib/supabase.ts */

import { createClient } from "@supabase/supabase-js";
// ... rest of the code
```

```css
/* bitesite/app/globals.css */

@import "tailwindcss";
// ... rest of the code
```

This makes it easy to identify which file is which when copying code or debugging.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel |
| Icons | Lucide React |
| Fonts | Inter, Playfair Display, Noto Sans JP |
| Markdown | react-markdown + remark-gfm |

---

## Project Structure

```
app/
├── page.tsx                    # Homepage — merchant grid + filters + dish search + Latest Stories
├── layout.tsx                  # Root layout (fonts + metadata + SEO + SiteHeader + Organization Schema)
├── globals.css                 # Tailwind v4 + CSS custom properties
├── sitemap.ts                  # Auto-generated sitemap.xml
├── robots.ts                   # robots.txt
├── loading.tsx                 # Global loading fallback
├── join-us/
│   └── page.tsx                # Join Us pricing page (FAQPage Schema)
├── stories/
│   ├── layout.tsx              # Stories list layout (SEO metadata)
│   ├── page.tsx                # Stories list page (articles grid + category filter)
│   └── [slug]/
│       └── page.tsx            # Story detail page (ISR 300s + Article Schema + Markdown render)
├── api/
│   ├── view/
│   │   └── route.ts            # POST /api/view — increment merchant view count
│   └── story-view/
│       └── route.ts            # POST /api/story-view — increment article view count
├── store/
│   └── [merchant]/
│       ├── page.tsx              # Merchant detail page (ISR + SSR + Restaurant/Menu/Breadcrumb Schema)
│       └── loading.tsx           # Merchant page skeleton
├── layouts/
│   ├── index.ts                  # Layout registry (classic/elegant/minimal/modern/rustic)
│   ├── classic-layout.tsx        # Warm amber cafe style (with map embed)
│   ├── elegant-layout.tsx        # Dark luxury fine-dining style (with map embed)
│   ├── minimal-layout.tsx        # Clean stone/zen style (with map embed)
│   ├── modern-layout.tsx         # White slate contemporary style (with map embed)
│   └── rustic-layout.tsx         # Orange earthy style (with map embed)
├── components/
│   ├── map-embed.tsx             # Google Maps iframe embed component
│   └── safe-image.tsx            # Next/Image wrapper with error fallback + loading shimmer + auto optimization
└── components/
    ├── ui/
    │   ├── cuisine-tag.tsx           # Pill-shaped cuisine label
    │   └── diamond-separator.tsx     # Decorative divider (◆)
    └── sections/
        ├── hero.tsx                  # Homepage hero with search bar (restaurants, cuisines, dishes)
        ├── category-filter.tsx       # 3-row sticky filter bar with smooth animations
        ├── merchant-card.tsx         # Card: Open Now badge + ShareMenu + ViewCount + tags + hours
        ├── merchant-card-skeleton.tsx # Loading skeleton with pulse animation
        ├── footer.tsx                # Site footer (Home / Stories / Join Us + copyright)
        ├── brand-intro.tsx           # Merchant brand intro
        ├── discover-bitesite.tsx     # "Discover more" CTA link to homepage
        ├── info-accordion.tsx        # Location / Hours / Dress Code / Social accordion
        ├── menu-section.tsx          # Category-based menu grid
        ├── product-card.tsx          # Individual dish card with image, price, discount
        ├── related-merchants.tsx     # "You May Also Like" recommendations
        ├── share-menu.tsx            # Floating share menu (WhatsApp/FB/Twitter/Copy/IG)
        ├── share-buttons.tsx         # Inline share buttons
        ├── view-tracker.tsx          # Client-side merchant view count tracker (2s delay)
        ├── view-count-inline.tsx     # Eye icon + formatted count badge
        ├── store-hero.tsx            # Full-bleed hero image
        ├── store-footer.tsx          # Merchant footer with WhatsApp CTA
        ├── text-image-block.tsx      # Alternating text/image section
        ├── video-section.tsx         # YouTube embed + self-hosted video player
        │
        ├── join-us-hero.tsx          # Join Us page hero
        ├── how-it-works.tsx          # 3-step process (Shoot → Build → Share)
        ├── pricing-card.tsx          # Pricing card (RM599 + RM149/mo)
        ├── faq-accordion.tsx         # FAQ accordion (6 questions)
        ├── join-us-cta.tsx           # Bottom WhatsApp CTA
        │
        ├── story-filter.tsx          # Stories category filter buttons
        ├── story-card.tsx            # Article card (featured + list variants)
        ├── story-list.tsx            # Article list with featured article on top
        ├── story-hero.tsx            # Story detail hero (title + meta + cover image)
        ├── story-content.tsx         # Markdown renderer for article body
        ├── story-related.tsx         # "More Stories" recommendations
        ├── story-view-tracker.tsx    # Client-side article view count tracker
        ├── latest-stories.tsx        # Homepage "Latest Stories" section (latest 3 articles)
        │
        └── site-header.tsx           # Global nav bar (Home / Stories / Join Us)

lib/
├── supabase.ts                 # Supabase client + all DB queries + related merchant scoring
├── hours.ts                    # Timezone-safe open/closed logic (Asia/Kuala_Lumpur)
├── utils.ts                    # cn() — clsx + tailwind-merge
├── styles.ts                   # OLD 3-style theme map (fresh/luxury/japanese) — DEPRECATED
├── image-utils.ts              # Auto image URL optimization (Unsplash / Supabase Storage compression)
├── whatsapp.ts                 # BiteSite WhatsApp link constant
└── markdown.ts                 # Markdown rendering utilities (reserved)

types/
└── index.ts                    # All TypeScript interfaces + defaultFeatures + mergeFeatures
```

---

## Database Schema

### `merchants` (main table)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| slug | TEXT | URL-friendly name, unique, indexed |
| name | TEXT | Restaurant name |
| description | TEXT | Long description, supports newlines |
| cuisine_type | TEXT | Comma-separated e.g. "Cafe, Western" |
| address | TEXT | Full address |
| phone | TEXT | Display phone number |
| whatsapp | TEXT | WhatsApp number (digits only for wa.me link) |
| email | TEXT | Contact email |
| website | TEXT | External website URL |
| instagram | TEXT | Instagram URL |
| facebook | TEXT | Facebook URL |
| cover_image | TEXT | Hero image URL (used for OG image) |
| logo_image | TEXT | Logo URL |
| operating_hours | JSONB | `{monday: "9:00 AM - 10:00 PM", ...}` |
| dress_code | TEXT | Optional dress code info |
| menu_pdf_url | TEXT | PDF menu link |
| video_url | TEXT | Single video URL (legacy field) |
| video_type | TEXT | "youtube" / "self_hosted" / "none" |
| video_caption | TEXT | Video caption |
| reference_website | TEXT | Reference/inspiration URL |
| custom_style | JSONB | Custom CSS overrides (reserved) |
| style | TEXT | **DEPRECATED** — old 3-style system (fresh/luxury/japanese) |
| layout | TEXT | **ACTIVE** — 5 layouts (classic/elegant/minimal/modern/rustic) |
| features | JSONB | Tier feature toggles |
| settings | JSONB | Misc merchant settings |
| status | TEXT | e.g. "active" |
| area | TEXT | District/area e.g. "Desa ParkCity", "Bangsar" |
| tags | TEXT[] | Array of tags e.g. ["Halal", "Pet Friendly", "WiFi"] |
| payment_methods | TEXT[] | ["Cash", "Cashless", "Cards"] |
| is_published | BOOLEAN | Only published merchants appear on site |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Used for sitemap lastModified |

### `categories`
| Column | Type |
|--------|------|
| id | UUID PK |
| merchant_id | UUID → merchants (ON DELETE CASCADE) |
| name | TEXT | Category name e.g. "Starters", "Mains" |
| sort_order | INT | Display order |
| created_at | TIMESTAMPTZ |

### `products`
| Column | Type |
|--------|------|
| id | UUID PK |
| category_id | UUID → categories |
| merchant_id | UUID → merchants |
| name | TEXT | Dish name |
| description | TEXT | Dish description |
| price | NUMERIC | Regular price |
| discount_price | NUMERIC | Sale price (shows strikethrough original) |
| image_url | TEXT | Product photo |
| is_featured | BOOLEAN | Appears in Seasonal tier |
| is_available | BOOLEAN | Shows "Unavailable" badge if false |
| show_prices | BOOLEAN | Whether to display price |
| sort_order | INT | Display order within category |
| created_at | TIMESTAMPTZ |

### `merchant_videos`
| Column | Type |
|--------|------|
| id | UUID PK |
| merchant_id | UUID → merchants (ON DELETE CASCADE) |
| video_url | TEXT | YouTube URL or direct video URL |
| video_type | TEXT | "youtube" / "self_hosted" |
| caption | TEXT | Video caption below player |
| sort_order | INT | Display order |
| created_at | TIMESTAMPTZ |

### `merchant_stats` (view count analytics)
| Column | Type |
|--------|------|
| slug | TEXT PK | Same as merchants.slug |
| view_count | INT DEFAULT 0 | Total lifetime views |
| last_viewed_at | TIMESTAMPTZ | Last view timestamp |

### `merchant_monthly_views` (monthly analytics — reserved)
| Column | Type |
|--------|------|
| id | SERIAL PK |
| slug | TEXT | Merchant slug |
| year_month | TEXT | Format "YYYY-MM" |
| view_count | INT DEFAULT 0 | Views for that month |
| UNIQUE(slug, year_month) | Composite unique constraint |

### `articles` (blog / stories)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, auto-generated |
| slug | TEXT | **Required.** URL-friendly identifier. |
| title | TEXT | **Required.** Article headline. |
| excerpt | TEXT | Short summary shown on the list page. |
| content | TEXT | **Required.** Full article body in **Markdown**. |
| cover_image | TEXT | URL to the featured image. **Recommended:** 16:9 ratio. |
| category | TEXT | **Required.** Used for filtering on `/stories`. |
| tags | TEXT[] | Array of tags. |
| merchant_slug | TEXT | **Optional.** Links to a merchant page. |
| author | TEXT | Defaults to `BiteSite Team`. |
| published | BOOLEAN | **Must be `true`** to appear on the website. |
| view_count | INT | Auto-incremented. Do NOT edit manually. |
| created_at | TIMESTAMPTZ | Auto-generated. |
| updated_at | TIMESTAMPTZ | Auto-generated. |

---

## 📝 How to Publish an Article (Zero Code)

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your BiteSite project
3. Navigate to **Table Editor** → `articles`

### Step 2: Click "Insert row"

### Step 3: Fill in the fields

#### Required fields:
| Field | What to enter | Example |
|-------|--------------|---------|
| **slug** | URL-friendly ID, no spaces | `the-hearth-bakery-opening` |
| **title** | Article headline | `The Hearth Bakery Opens in Desa ParkCity` |
| **content** | Full article in **Markdown** | See Markdown syntax below |
| **category** | Filter category | `New Opening` |
| **published** | Set to **true** | ✅ Check the box |

#### Optional but recommended:
| Field | What to enter | Example |
|-------|--------------|---------|
| **excerpt** | 1-2 sentence summary | `After months of anticipation...` |
| **cover_image** | Direct image URL | `https://images.unsplash.com/photo-xxx` |
| **tags** | Array of keywords | `{bakery, desaparkcity, sourdough}` |
| **merchant_slug** | Link to restaurant page | `the-hearth-bakery` |
| **author** | Author name | `BiteSite Team` |

#### Do NOT touch:
- `id` — auto-generated
- `view_count` — auto-incremented
- `created_at` / `updated_at` — auto-generated

### Step 4: Save
Click **Save** → The article immediately appears on:
- `/stories` (list page)
- `/stories/{slug}` (detail page)
- Homepage "Latest Stories" section (if among the 3 newest)

---

## 🖊️ Markdown Syntax for Articles

The `content` field supports full **GitHub Flavored Markdown**:

```markdown
# Main Heading (H1)

## Subheading (H2)

**Bold text** for emphasis.

Regular paragraph text.

- Bullet point 1
- Bullet point 2

1. Numbered item 1
2. Numbered item 2

[Link to merchant page](/store/the-hearth-bakery)

[External link](https://example.com)

![Image description](https://your-image-url.jpg)

> Blockquote: This is a highlighted quote.

| Item | Price |
|------|-------|
| Country Sourdough | RM 18 |

---

Emoji work too! 🍞☕🎉
```

**Important notes:**
- **Images**: Use direct image URLs.
- **Links to merchants**: Use `/store/{merchant-slug}` format.
- **External links**: Use full `https://` URLs. These open in a new tab.

---

## Supabase RPC Functions

```sql
-- Increment merchant view count (total + monthly)
increment_view_count(merchant_slug TEXT) RETURNS void

-- Increment article view count
increment_article_view(article_slug TEXT) RETURNS void
```

---

## Merchant Detail Page (`/store/[merchant]`)

### Rendering Strategy
- **ISR**: `export const revalidate = 300` — pages revalidate every 5 minutes
- **Static Generation**: `generateStaticParams()` fetches all published merchants at build time
- **SSR Fallback**: If merchant not in static params, renders on-demand

### Metadata Generation (`generateMetadata`)
- Dynamic title: `{name} | {cuisine} Menu | BiteSite`
- Dynamic description: truncated to 155 chars from `merchant.description`
- OG image: `merchant.cover_image` (absolute URL)
- Canonical URL: `https://bitesite-pied.vercel.app/store/{slug}`

### Schema.org JSON-LD (SEO)
Three structured data blocks injected via `<script type="application/ld+json">`:
1. **Restaurant Schema** (`@type: "Restaurant"`)
2. **Menu Schema** (`hasMenu` linked to `#menu-section`)
3. **BreadcrumbList Schema**

### Embedded Map
Each merchant page automatically displays a Google Maps embed in the Contact section if `address` is provided. Supports all 5 layout styles with matching border colors.

---

## Stories Page (`/stories`)

### Features
- **Dynamic category filters**: Categories are read from the database automatically
- **Featured article**: The newest article gets a large featured card
- **Article list**: Remaining articles shown in a responsive grid
- **SEO**: Dedicated layout with metadata + Article Schema on detail pages

### Story Detail Page (`/stories/[slug]`)
- **ISR 300s**: Revalidates every 5 minutes
- **Markdown rendering**: Full GFM support via `react-markdown` + `remark-gfm`
- **View tracking**: 2-second delay after page load, increments `view_count`
- **Related stories**: Shows up to 3 related articles from the same category
- **Merchant link**: If `merchant_slug` is set, shows a CTA button linking to the merchant page
- **SEO**: Dynamic title, description, OG image, **Article Schema** (datePublished, author, publisher)

---

## Homepage (`/`)

### Sections (top to bottom)
1. **Restaurant owner banner** — "Are you a restaurant owner? Join BiteSite"
2. **Hero** — Search bar (restaurants, cuisines, **dishes**)
3. **Category Filter** — Sticky filter bar with smooth expand/collapse animation
4. **Merchant Grid** — Filtered restaurant cards (supports dish-level search)
5. **Latest Stories** — Latest 3 published articles
6. **Footer** — Home / Stories / Join Us links + copyright

### Dish Search
The homepage search bar now searches across:
- Restaurant names
- Cuisine types
- Descriptions & tags
- **Individual dish names** (e.g. searching "burger" returns restaurants with burgers on their menu)

---

## 5 Merchant Layouts

Each merchant picks ONE layout via `merchants.layout` column.

| Layout | Vibe | Primary Colors |
|--------|------|----------------|
| **classic** | Warm cafe / bakery | Amber-50 bg, amber-900 text, green accents |
| **elegant** | Dark luxury fine-dining | Slate-950 bg, amber-300/gold accents, white text |
| **minimal** | Clean zen / Japanese | Stone-50 bg, stone-800 text, minimal borders |
| **modern** | Contemporary urban | White bg, slate-900 text, slate-100 accents |
| **rustic** | Earthy / farm-to-table | Orange-50 bg, orange-900 text, warm tones |

All layouts include:
- Google Maps embed in Contact section
- Payment method badges
- Share buttons (WhatsApp / Facebook / Twitter / Copy / Instagram)
- "Discover more restaurants on BiteSite" footer link

---

## 9 Tier Features (Optional Per Merchant)

Controlled via `merchants.features` JSONB.

```typescript
interface MerchantFeatures {
  hero: boolean;           // default true
  about: boolean;          // default true
  menu: boolean;           // default true
  contact: boolean;        // default true
  gallery: boolean;        // default false
  reviews: boolean;        // default false
  appointment: boolean;    // default false
  seasonal_popup: boolean; // default false
  events: boolean;         // default false
}
```

---

## View Count System

- **Merchant tracking**: `<ViewTracker>` fires `POST /api/view` after 2s delay
- **Article tracking**: `<StoryViewTracker>` fires `POST /api/story-view` after 2s delay
- **Database**: RPC functions upsert `merchant_stats` / `articles.view_count`
- **Display locations**:
  - Merchant page Hero: inline eye badge
  - Homepage cards: bottom-right eye badge
  - Stories list: eye icon + count per article
  - Story detail: eye icon + count in hero meta

---

## Image Optimization

All images served through `SafeImage` are automatically optimized via `lib/image-utils.ts`:

- **Unsplash**: Resized to 800px, quality 80, auto WebP format, crop fit
- **Supabase Storage**: Compressed with width/quality parameters
- **Fallback**: Local images and data URIs pass through unchanged

This significantly reduces page load time and mobile data usage without requiring a paid image CDN.

---

## SEO & Performance

### On-Page SEO
- **Meta tags**: Auto-generated per merchant and per article
- **Canonical URLs**: Every page has a canonical link
- **Open Graph**: Title, description, and image for social sharing
- **Twitter Cards**: Summary large image cards

### Structured Data (Schema.org)
- **Organization + WebSite Schema**: Injected on every page via root layout
- **Restaurant Schema**: On every merchant page (`@type: Restaurant`)
- **Menu Schema**: Linked to the menu section (`hasMenu`)
- **BreadcrumbList**: On every merchant page
- **Article Schema**: On every story detail page (datePublished, author, publisher)
- **FAQPage Schema**: On Join Us page (6 questions with accepted answers)

### Technical SEO
- **Sitemap**: Auto-generated from all published merchants (`sitemap.ts`)
- **Robots**: Allow all, sitemap linked (`robots.ts`)
- **Google Search Console**: Verified
- **ISR**: 5-minute revalidation for fresh content without full rebuild
- **Image optimization**: Automatic compression via URL parameters

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon/public key
```

---

## Key Business Rules

1. **No cart, no checkout, no auth** — pure showcase platform
2. **BiteSite branding is minimal** — only "Discover more restaurants on BiteSite" at bottom of merchant pages
3. **Each merchant has independent visual identity** — layout + colors are per-merchant
4. **WhatsApp is the primary CTA** — reservations route to merchant's WhatsApp; appointment form routes to BiteSite's WhatsApp (`60165660239`)
5. **cuisine_type supports comma-separated multi-values** — e.g. "Cafe, Western" (first value used as primary tag)
6. **Payment methods** stored as array: `["Cash", "Cashless", "Cards"]` — displayed with icons
7. **Operating hours** stored as JSONB — supports single and split hours (comma-separated)
8. **Tags** are free-text array — used for filtering (Halal, Pet Friendly, WiFi, etc.)
9. **Articles are published via Supabase Table Editor** — zero code required
10. **Article images use external URLs** — Google Drive, Unsplash, or any direct image link
11. **Dish search** — homepage search queries all available product names per merchant
12. **Embedded maps** — auto-rendered in Contact section if address exists

---

## Pages Summary

| Page | Path | Purpose |
|------|------|---------|
| Home | `/` | Browse all restaurants, search (including dishes), filter |
| Merchant | `/store/{slug}` | Individual restaurant menu, map, hours, SEO Schema |
| Stories | `/stories` | Blog list — all articles |
| Story | `/stories/{slug}` | Individual article (Markdown + Article Schema) |
| Join Us | `/join-us` | Pricing & signup for restaurant owners (FAQ Schema) |

---

## License

Private — BiteSite by CH.
