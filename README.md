# BiteSite

Beautiful Menus for Local Restaurants — Kuala Lumpur, Malaysia.

> **Live URL**: https://bitesite-pied.vercel.app  
> **GitHub**: https://github.com/chlew467779-new/bitesite  
> **Owner**: CH (BiteSite)

---

## 📌 Important — How We Edit Code

**We edit code directly on GitHub.com. No local terminal, no bash commands.**

Every change is done through the GitHub web interface:
1. Go to https://github.com/chlew467779-new/bitesite
2. Click on the file you want to edit
3. Click the **pencil icon** (Edit this file)
4. Paste the new code
5. Scroll down, write a commit message, click **Commit changes**
6. Vercel will auto-deploy within 30–60 seconds

> **Tip**: If you need to create a new file, click **"Add file" → "Create new file"** and type the full path.

> **Tip**: Don't edit too many files in one commit. Vercel queues deployments. Wait 30–60 seconds between commits.

> **Tip**: After changing database data, you need to **Redeploy Vercel** (without build cache) to see changes immediately, because pages are cached for 5 minutes (ISR).

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
| Markdown | react-markdown + remark-gfm + remark-breaks |
| Map | Leaflet + OpenStreetMap (free) |
| Charts | Recharts |

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
│       └── page.tsx            # Story detail page (ISR 300s + Article Schema + Markdown render + hashtags)
├── our-partner/
│   ├── layout.tsx              # Our Partner page SEO metadata
│   └── page.tsx                # Interactive map showing all merchant locations
├── api/
│   ├── view/
│   │   └── route.ts            # POST /api/view — legacy merchant view count (retained for compatibility)
│   ├── story-view/
│   │   └── route.ts            # POST /api/story-view — legacy article view count (retained)
│   ├── track/
│   │   └── route.ts            # POST /api/track — universal tracking API (all events, sendBeacon compatible)
│   └── admin/
│       ├── login/
│       │   └── route.ts        # POST /api/admin/login — password auth + 3-strike lockout
│       ├── overview/
│       │   └── route.ts        # GET /api/admin/overview?range=7d — dashboard KPI cards
│       ├── trends/
│       │   └── route.ts        # GET /api/admin/trends?range=7d — trend line chart data
│       ├── merchants/
│       │   └── route.ts        # GET /api/admin/merchants?range=7d — merchant ranking table
│       ├── merchants-list/
│       │   └── route.ts        # GET /api/admin/merchants-list — simple merchant list for dropdowns
│       ├── devices/
│       │   └── route.ts        # GET /api/admin/devices?range=7d — device/OS/browser breakdown
│       ├── locations/
│       │   └── route.ts        # GET /api/admin/locations?range=7d — country + city distribution
│       ├── referrers/
│       │   └── route.ts        # GET /api/admin/referrers?range=7d — traffic source pie chart
│       ├── search-keywords/
│       │   └── route.ts        # GET /api/admin/search-keywords?range=7d — search terms ranking
│       ├── events/
│       │   └── route.ts        # GET /api/admin/events?range=7d — WhatsApp/Booking/Share stats
│       ├── stories/
│       │   └── route.ts        # GET/POST/PUT/DELETE /api/admin/stories — Stories CRUD (supports Chinese slug)
│       ├── stories-analytics/
│       │   └── route.ts        # GET /api/admin/stories-analytics — Article views + conversion rate (shows titles)
│       ├── map/
│       │   └── route.ts        # GET /api/admin/map?range=7d — Map page analytics
│       ├── hourly/
│       │   └── route.ts        # GET /api/admin/hourly?range=7d — 24h peak hours
│       ├── realtime/
│       │   └── route.ts        # GET /api/admin/realtime — current online users (5-min window)
│       ├── export/
│       │   └── route.ts        # GET /api/admin/export?range=7d&format=csv — CSV download
│       └── settings/
│           └── route.ts        # GET/PUT /api/admin/settings — read/write site config (auth protected)
├── store/
│   └── [merchant]/
│       ├── page.tsx              # Merchant detail page (ISR + SSR + Restaurant/Menu/Breadcrumb Schema)
│       └── loading.tsx           # Merchant page skeleton
├── layouts/
│   ├── index.ts                  # Layout registry (classic/elegant/minimal/modern/rustic)
│   ├── classic-layout.tsx        # Warm amber cafe style
│   ├── elegant-layout.tsx        # Dark luxury fine-dining style
│   ├── minimal-layout.tsx        # Clean stone/zen style
│   ├── modern-layout.tsx         # White slate contemporary style
│   └── rustic-layout.tsx         # Orange earthy style
├── admin/                        # Admin Analytics Dashboard + CMS (dark theme)
│   ├── page.tsx                  # Admin entry: login form or dashboard shell
│   ├── layout.tsx                # Admin layout (dark mode, no SiteHeader)
│   ├── admin-globals.css         # Admin-specific dark theme styles
│   ├── login-form.tsx            # Password input component
│   └── components/
│       ├── auth-context.tsx      # Login state management (React Context + localStorage)
│       ├── admin-shell.tsx       # Sidebar + main content layout (collapsible on desktop)
│       ├── date-range-picker.tsx # Time range selector (today/7d/30d/90d/365d)
│       ├── realtime-badge.tsx    # Live online user counter (30s auto-refresh)
│       ├── stat-cards.tsx        # Top 4 KPI cards (views/unique/events/merchants)
│       ├── trend-chart.tsx       # Traffic trend line chart
│       ├── merchant-table.tsx    # Merchant ranking table (sortable)
│       ├── device-chart.tsx      # Device distribution donut chart
│       ├── location-chart.tsx    # Top cities bar chart
│       ├── referrer-chart.tsx    # Traffic source pie chart
│       ├── search-keywords-table.tsx # Search terms ranking
│       ├── events-chart.tsx      # WhatsApp/Booking/Share stacked bar chart
│       ├── stories-chart.tsx     # Stories views + conversion rate (shows article titles)
│       ├── map-stats.tsx         # Map page views + marker clicks
│       ├── hourly-chart.tsx      # 24-hour peak hours bar chart
│       ├── export-button.tsx     # CSV export trigger
│       ├── settings-panel.tsx    # Site settings editor (title, description, footer text)
│       ├── stories-manager.tsx   # Stories list with search, filter, delete, updated_at column
│       ├── story-editor.tsx      # Markdown editor + live preview + 6 background themes + auto-save + category dropdown + cover preview + word count + Markdown syntax hint
│       ├── merchant-manager.tsx  # ⏳ P2 — Merchant list with status/actions
│       ├── merchant-form.tsx     # ⏳ P2 — 5-tab merchant create/edit form
│       └── menu-manager.tsx      # ⏳ P2 — Category & product management
├── components/
│   ├── map-embed.tsx             # Google Maps iframe embed component
│   ├── safe-image.tsx            # Next/Image wrapper with error fallback + loading shimmer
│   ├── page-view-tracker.tsx     # Universal page view tracker (Client Component)
│   └── sections/
│       ├── hero.tsx                  # Homepage hero with search bar
│       ├── category-filter.tsx       # 3-row sticky filter bar with smooth animations
│       ├── merchant-card.tsx         # Card: Open Now badge + ShareMenu + ViewCount + tags + hours
│       ├── merchant-card-skeleton.tsx # Loading skeleton with pulse animation
│       ├── footer.tsx                # Site footer (Home / Stories / Join Us / Our Partner)
│       ├── site-header.tsx           # Global nav bar (Home / Our Partner / Stories / Join Us)
│       ├── map-container.tsx         # Map page wrapper: filter + search logic
│       ├── map-section.tsx           # Leaflet map: markers with photos, user location pulse, recenter
│       ├── map-filter.tsx            # Map top filter pills + search input
│       ├── brand-intro.tsx           # Merchant brand intro
│       ├── discover-bitesite.tsx     # "Discover more" CTA link to homepage
│       ├── info-accordion.tsx        # Location / Hours / Dress Code / Social accordion
│       ├── menu-section.tsx          # Category-based menu grid
│       ├── product-card.tsx          # Individual dish card with image, price, discount
│       ├── related-merchants.tsx     # "You May Also Like" recommendations
│       ├── share-menu.tsx            # Floating share menu (auto-close on outside click & scroll)
│       ├── share-buttons.tsx         # Inline share buttons (Share + Copy Link only)
│       ├── view-tracker.tsx          # Client-side merchant view count tracker (2s delay)
│       ├── view-count-inline.tsx     # Eye icon + formatted count badge
│       ├── store-hero.tsx            # Full-bleed hero image
│       ├── store-footer.tsx          # Merchant footer with WhatsApp CTA
│       ├── text-image-block.tsx      # Alternating text/image section
│       ├── video-section.tsx         # YouTube embed + self-hosted video player
│       ├── join-us-hero.tsx          # Join Us page hero
│       ├── how-it-works.tsx          # 3-step process (Shoot → Build → Share)
│       ├── pricing-card.tsx          # Pricing card (RM599 + RM149/mo)
│       ├── faq-accordion.tsx         # FAQ accordion (6 questions)
│       ├── join-us-cta.tsx           # Bottom WhatsApp CTA
│       ├── story-filter.tsx          # Stories category filter buttons
│       ├── story-card.tsx            # Article card (featured + list variants)
│       ├── story-list.tsx            # Article list with featured article on top
│       ├── story-hero.tsx            # Story detail hero (6 theme support)
│       ├── story-content.tsx         # Markdown renderer (6 theme support + /store/ link tracking + single-line-break support via remark-breaks)
│       ├── story-related.tsx         # "More Stories" recommendations
│       ├── story-view-tracker.tsx    # Client-side article view count tracker
│       └── latest-stories.tsx        # Homepage "Latest Stories" section (latest 3 articles)

lib/
├── supabase.ts                 # Supabase client + all DB queries + related merchant scoring + map query
├── hours.ts                    # Timezone-safe open/closed logic (Asia/Kuala_Lumpur)
├── utils.ts                    # cn() — clsx + tailwind-merge
├── styles.ts                   # OLD 3-style theme map (fresh/luxury/japanese) — DEPRECATED
├── map-colors.ts               # Cuisine type → marker color mapping for map
├── image-utils.ts              # Auto image URL optimization (Unsplash / Supabase Storage)
├── whatsapp.ts                 # BiteSite WhatsApp link constant
├── markdown.ts                 # Markdown rendering utilities (reserved)
├── analytics.ts                # EventTypes + classifyReferrer + trackEvent() (sendBeacon priority)
├── device-detect.ts            # User-Agent parser (device / OS / browser)
├── admin-auth.ts               # generateAdminToken() + verifyAdminToken() (HMAC-SHA256)
└── settings.ts                 # Read site config from Supabase settings table with fallback defaults

types/
└── index.ts                    # All TypeScript interfaces + defaultFeatures + mergeFeatures
```

> ⚠️ **File Path Trap**: The project has two parallel component directories — `components/sections/` (legacy, used by stories page) and `app/components/sections/` (actively used by tier-sections). Before modifying any component, check which directory it's actually imported from.

---

## Database Schema

### `settings` (site configuration)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL | PK |
| key | TEXT | Unique setting key |
| value | TEXT | Setting value |
| description | TEXT | Human-readable description |
| updated_at | TIMESTAMPTZ | Auto-updated |

**Active settings** (controlled via Admin Dashboard):
- `site_title` — Browser tab title, SEO, Schema.org
- `site_description` — Meta description, social sharing
- `footer_text` — Merchant page footer link text

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
| cover_image | TEXT | Hero image URL (used for OG image + map marker photo) |
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
| status | TEXT | `active` or `inactive` |
| area | TEXT | District/area e.g. "Desa ParkCity", "Bangsar" |
| tags | TEXT[] | Array of tags e.g. `["Halal", "Pet Friendly", "WiFi"]` |
| payment_methods | TEXT[] | `["Cash", "Cashless", "Cards"]` |
| latitude | FLOAT8 | Latitude for map marker |
| longitude | FLOAT8 | Longitude for map marker |
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

### `articles` (Stories)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, auto-generated |
| slug | TEXT | **Required.** URL-friendly identifier. Unique, indexed. Supports Chinese characters. |
| title | TEXT | **Required.** Article headline. |
| excerpt | TEXT | Short summary shown on the list page. |
| content | TEXT | **Required.** Full article body in **Markdown**. Single line breaks preserved. |
| cover_image | TEXT | URL to the featured image. **Recommended:** 16:9 ratio. |
| category | TEXT | **Required.** Used for filtering on `/stories`. |
| tags | TEXT[] | Array of tags. |
| merchant_slug | TEXT | **Optional.** Links to a merchant page. |
| author | TEXT | Defaults to `BiteSite Team`. |
| published | BOOLEAN | **Must be `true`** to appear on the website. |
| view_count | INT | Auto-incremented. Legacy total views. Do NOT edit manually. |
| background_style | TEXT | `default`/`warm`/`cool`/`dark`/`nature`/`minimal` |
| created_at | TIMESTAMPTZ | Auto-generated. |
| updated_at | TIMESTAMPTZ | Auto-generated. |

### `events`
| Column | Type |
|--------|------|
| id | UUID PK |
| merchant_id | UUID → merchants |
| title | TEXT | Event name |
| description | TEXT | Event details |
| event_date | DATE | Event date |
| event_time | TEXT | e.g. "7:00 PM - 10:00 PM" |
| image_url | TEXT | Event photo |
| created_at | TIMESTAMPTZ |

### `page_views` (raw analytics log — primary data source)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | gen_random_uuid() |
| slug | TEXT | Merchant slug (null for non-merchant pages) |
| path | TEXT NOT NULL | e.g. `/store/abc`, `/stories/xyz` |
| page_type | TEXT | merchant / story / home / join_us / our_partner / story_list / other |
| event_type | TEXT NOT NULL DEFAULT 'page_view' | page_view / whatsapp_click / booking_submit / share / search / map_marker_click / story_to_merchant |
| event_detail | TEXT | Search keyword, share platform, etc. |
| ip | TEXT | Visitor IP |
| country | TEXT | From Vercel `x-vercel-ip-country` |
| city | Text | From Vercel `x-vercel-ip-city` (URL decoded) |
| device_type | TEXT | mobile / desktop / tablet |
| os | TEXT | iOS / Android / Windows / macOS / Linux / Other |
| browser | TEXT | Chrome / Safari / Samsung Internet / Firefox / Edge / Other |
| user_agent | TEXT | Raw User-Agent string |
| referrer | TEXT | document.referrer |
| referrer_type | TEXT | google / instagram / facebook / whatsapp / direct / internal / other |
| metadata | JSONB DEFAULT '{}' | Reserved for future expansion |
| created_at | TIMESTAMPTZ DEFAULT now() | |

**Indexes**: `created_at`, `slug`, `event_type`, `path`, `device_type`, `country+city`, `page_type`, `referrer_type`

### `merchant_daily_views` (daily aggregated analytics — cron rollup)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| slug | TEXT | null = non-merchant pages |
| page_type | TEXT NOT NULL | |
| view_date | DATE NOT NULL | |
| device_type | TEXT | |
| country | TEXT | |
| city | TEXT | |
| os | TEXT | |
| browser | TEXT | |
| referrer_type | TEXT | |
| event_type | TEXT DEFAULT 'page_view' | |
| count | INT DEFAULT 0 | |
| unique_ips | INT DEFAULT 0 | |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |
| **UNIQUE** | | (slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type) |

**Indexes**: `view_date`, `slug`, `page_type`, `event_type`

### `merchant_stats` (legacy view count — retained for compatibility)
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

### `login_attempts` (brute-force protection)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| ip | TEXT NOT NULL | |
| attempt_count | INT DEFAULT 1 | |
| last_attempt_at | TIMESTAMPTZ DEFAULT now() | |
| locked_until | TIMESTAMPTZ | null = not locked |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| **UNIQUE** | | (ip) |

**Indexes**: `ip`, `locked_until`

---

## Supabase RPC Functions

```sql
-- Increment merchant view count (total + monthly)
increment_view_count(merchant_slug TEXT) RETURNS void

-- Increment article view count
increment_article_view(article_slug TEXT) RETURNS void

-- Aggregate daily views (run by cron hourly)
aggregate_daily_views() RETURNS void
```

### Aggregation Setup (One-time)
Run in Supabase SQL Editor:
```sql
CREATE OR REPLACE FUNCTION aggregate_daily_views()
RETURNS void AS $$
BEGIN
  INSERT INTO merchant_daily_views (
    slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type, count, unique_ips
  )
  SELECT 
    slug, page_type, DATE(created_at) as view_date,
    device_type, country, city, os, browser, referrer_type, event_type,
    COUNT(*) as count, COUNT(DISTINCT ip) as unique_ips
  FROM page_views
  WHERE created_at >= CURRENT_DATE - INTERVAL '2 days'
  GROUP BY slug, page_type, DATE(created_at), device_type, country, city, os, browser, referrer_type, event_type
  ON CONFLICT (slug, page_type, view_date, device_type, country, city, os, browser, referrer_type, event_type)
  DO UPDATE SET count = EXCLUDED.count, unique_ips = EXCLUDED.unique_ips, updated_at = now();
END;
$$ LANGUAGE plpgsql;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('aggregate-views-hourly', '0 * * * *', 'SELECT aggregate_daily_views()');
```

---

## Admin Dashboard

**URL**: `/admin`  
**Login**: Password-protected (HMAC-SHA256 token, stored in localStorage)  
**Theme**: Dark mode (slate-950 background, amber-500 accents)

### Authentication
- **Password**: Stored in Vercel Environment Variable `ADMIN_PASSWORD`
- **Brute-force protection**: 3 failed attempts → lock IP for 15 minutes
- **Session**: HMAC-SHA256 signed token, expires after 30 minutes
- **Token storage**: localStorage (`admin_session`)

### Security Features
| Feature | Implementation |
|---------|---------------|
| Password storage | Vercel Environment Variable (Secret type) |
| Brute-force lockout | `login_attempts` table — 3 strikes = 15 min lock |
| Session token | HMAC-SHA256 signed, tamper-proof |
| Token expiry | 30 minutes |
| API auth | Every admin API checks `x-admin-token` header |

### Dashboard Tabs

| Tab | What It Shows | Data Source | Status |
|-----|--------------|-------------|--------|
| **Overview** | Total Views, Unique Visitors, Total Events, Active Merchants + trend chart + device chart + merchant ranking | `page_views` raw table | ✅ |
| **Trends** | Daily traffic line chart (last 7/30/90/365 days) | `page_views` raw table | ✅ |
| **Merchants** | Merchant ranking table (total views, today views, avg time) | `merchant_daily_views` aggregate table | ✅ |
| **Devices** | Desktop / Mobile / Tablet donut chart + OS/browser breakdown | `page_views` raw table | ✅ |
| **Locations** | Top cities and countries bar chart | `page_views` raw table | ✅ |
| **Referrers** | Direct / Google / Bing / Social / Other pie chart | `page_views` raw table | ✅ |
| **Search Keywords** | What users searched on the homepage | `page_views` raw table (event_type='search') | ✅ |
| **Events** | WhatsApp clicks, bookings, shares, map clicks | `page_views` raw table | ✅ |
| **Stories Analytics** | Article views + conversion rate (story → merchant clicks) + article titles | `articles` + `page_views` | ✅ |
| **Stories Editor** | Create/edit/delete articles with Markdown editor + live preview + 6 background themes + auto-save + category dropdown + cover image preview + word count + Markdown syntax hint | `articles` table (CRUD API) | ✅ |
| **Map Stats** | Map page views + marker click counts | `page_views` raw table | ✅ |
| **Hourly** | 24-hour peak hours bar chart | `page_views` raw table | ✅ |
| **Export CSV** | Download all analytics data as CSV | `page_views` raw table | ✅ |
| **Settings** | Edit `site_title`, `site_description`, `footer_text` | `settings` table | ✅ |
| **Merchant Manager** | List all merchants with status/actions | `merchants` table | ⏳ P2 |
| **Menu Manager** | Manage categories and products per merchant | `categories` + `products` | ⏳ P2 |

### Admin API Endpoints

All admin APIs require `x-admin-token` header (HMAC-SHA256).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/login` | POST | Password auth, returns admin token |
| `/api/admin/overview` | GET | Dashboard KPI cards |
| `/api/admin/trends` | GET | Daily traffic trend |
| `/api/admin/merchants` | GET | Merchant ranking (analytics data) |
| `/api/admin/merchants-list` | GET | Simple merchant list `{slug, name}` for dropdowns |
| `/api/admin/devices` | GET | Device breakdown |
| `/api/admin/locations` | GET | Geo distribution |
| `/api/admin/referrers` | GET | Traffic sources |
| `/api/admin/search-keywords` | GET | Search terms |
| `/api/admin/events` | GET | Event stats |
| `/api/admin/stories` | GET/POST/PUT/DELETE | Stories CRUD — list, create, update, delete articles |
| `/api/admin/stories-analytics` | GET | Article views + conversion rate (shows article titles) |
| `/api/admin/map` | GET | Map page stats |
| `/api/admin/hourly` | GET | 24h peak hours |
| `/api/admin/realtime` | GET | Current online users |
| `/api/admin/export` | GET | CSV download |
| `/api/admin/settings` | GET/PUT | Site config (auth protected) |

---

## How to Publish an Article

### Method 1: Admin Editor (Recommended)

1. Go to `/admin` and log in
2. Click **"Stories Editor"** in the left sidebar
3. Click **"+ New Story"**
4. Fill in the form:
   - **Title** — Article headline (supports Chinese)
   - **Slug** — Auto-generated from title, editable (URL-friendly name, supports Chinese)
   - **Excerpt** — Short summary for list page and SEO
   - **Cover Image URL** — Full image URL (e.g. Unsplash). Preview appears below the input.
   - **Category** — Type or select from existing categories (prevents typos)
   - **Author** — Default "BiteSite Team"
   - **Tags** — Comma-separated, e.g. "cafe, coffee, brunch"
   - **Linked Merchant** — Optional: link to a merchant page
   - **Background Style** — Choose from 6 themes: Default / Warm / Cool / Dark / Nature / Minimal
   - **Published** — Toggle on to make visible on site
   - **Content** — Write in Markdown with toolbar (Bold, Italic, H1, H2, Link, Image, Emoji). **Single line breaks are preserved.** Word count shown below.
5. **Live Preview** updates in real-time on the right side
6. Click **"Publish"** to save and go live

> 💡 **Auto-save**: Content is auto-saved to browser storage every 30 seconds. If you accidentally refresh, a "Restore Draft" banner will appear.

### Method 2: Direct Database (Fallback)

If the editor has issues, insert directly in Supabase SQL Editor:

```sql
INSERT INTO articles (slug, title, excerpt, content, cover_image, category, tags, merchant_slug, author, published, background_style)
VALUES (
  'your-article-slug',
  'Your Article Title',
  'Short summary...',
  '# Heading

Your **markdown** content here.

Single line breaks
are preserved.',
  'https://images.unsplash.com/...',
  'Food',
  ARRAY['cafe', 'brunch'],
  NULL, -- or a merchant slug
  'BiteSite Team',
  true,
  'default' -- or warm/cool/dark/nature/minimal
);
```

### Method 3: Edit Existing Article

1. Go to `/admin` → **Stories Editor**
2. Find the article in the list (shows last updated time)
3. Click the **Edit** (pencil) icon
4. Make changes in the editor
5. Click **"Update"** to save

---

## 6 Story Background Themes

Each article can have its own visual theme. Set via Admin Editor or Supabase `background_style` column.

| Theme | Background | Text Color | Accent | Best For |
|-------|-----------|------------|--------|----------|
| **default** | `#FAFBF7` 米白 | `#2C3E2D` 深绿 | `#5A8F6E` 绿 | General purpose |
| **warm** | `#FDF8F3` 暖杏 | `#4A3728` 深棕 | `#B87333` 铜 | Bakery, cozy cafes |
| **cool** | `#F5F7FA` 冷灰蓝 | `#2D3748` 深蓝灰 | `#4A90A4` 蓝 | Modern, tech-forward |
| **dark** | `#1A1A1A` 深灰 | `#E8E8E8` 浅灰 | `#D4A853` 金 | Fine dining, bars |
| **nature** | `#F4F7F0` 浅绿 | `#2C3E2D` 深绿 | `#5A8F6E` 绿 | Healthy, vegetarian |
| **minimal** | `#FFFFFF` 纯白 | `#1A1A1A` 纯黑 | `#1A1A1A` 黑 | Clean, editorial |

> **Note**: After changing `background_style` in Supabase, **Redeploy Vercel** (without build cache) to see changes immediately.

---

## Merchant Layout System

Each merchant can choose from 5 visual layouts. Set via `layout` column in `merchants` table.

| Layout | Style | Primary Colors | Best For |
|--------|-------|----------------|----------|
| **classic** | Warm cafe / bakery | Amber-50 bg, amber-900 text, green accents | Traditional cafes, heritage restaurants |
| **elegant** | Dark luxury fine-dining | Slate-950 bg, amber-300/gold accents, white text | Fine dining, upscale bars |
| **minimal** | Clean zen / Japanese | Stone-50 bg, stone-800 text, minimal borders | Modern cafes, minimalist concepts |
| **modern** | Contemporary urban | White bg, slate-900 text, slate-100 accents | New openings, trendy spots |
| **rustic** | Earthy / farm-to-table | Orange-50 bg, orange-900 text, warm tones | Casual dining, neighborhood joints |

All layouts include:
- Google Maps embed in Contact section
- Payment method badges
- Share buttons (Share + Copy Link)
- Dynamic footer link (from Settings)

### Feature Tiers (per-merchant config)

Controlled via `merchants.features` JSONB column. Each layout shows/hides sections based on these toggles:

| Feature | Default | Description |
|---------|---------|-------------|
| `hero` | ✅ | Full-bleed cover image |
| `about` | ✅ | Brand story text |
| `menu` | ✅ | Menu section with categories |
| `contact` | ✅ | Contact info + WhatsApp CTA |
| `related` | ✅ | "You May Also Like" merchants |
| `events` | ❌ | Events/promotions carousel |
| `video` | ❌ | Video player section |
| `gallery` | ❌ | Photo gallery |
| `testimonials` | ❌ | Customer reviews |

---

## 🏪 Merchant Status

Merchants have a `status` field with two values:

| Status | Meaning | Website Behavior |
|--------|---------|------------------|
| `active` | Normal operation | Full merchant page displayed |
| `inactive` | Temporarily closed / ended partnership | Friendly "Unavailable" page with related merchant recommendations |

Inactive merchants:
- Return HTTP 200 (not 404) for SEO
- Include `<meta name="robots" content="noindex">`
- Still track page views for analytics
- Show 3 related active merchants as alternatives

---

## Analytics & Tracking

### Tracked Events

All events are sent to `/api/track` via `navigator.sendBeacon` (fires even if user navigates away).

| Event | When It Fires | Detail Field |
|-------|--------------|--------------|
| `page_view` | Any page load | — |
| `whatsapp_click` | User clicks WhatsApp button | — |
| `share` | User shares page | `"copy_link"` / `"facebook"` / `"twitter"` |
| `booking_submit` | Booking form submitted | Merchant name |
| `map_marker_click` | Map marker clicked | Merchant slug |
| `story_to_merchant` | Story → merchant link clicked | Article slug |
| `search` | Homepage search submitted | Search query |

### View Count System

- **Real-time**: `page_views` table records every visit with full metadata (device, location, referrer)
- **Aggregated**: `merchant_daily_views` table updated hourly via cron job
- **Dashboard**: Overview/Devices/Referrers/Events/Stories/Map/Hourly read from `page_views` (real-time)
- **Dashboard**: Trends/Merchants/Locations read from `merchant_daily_views` (cached, efficient)
- **Legacy**: `articles.view_count` — total accumulated views (shown in Stories Analytics as "Total Views")
- **Period**: `page_views` count within selected time range (shown in Stories Analytics as "Period Views")

### Legacy System (Retained)
- **Merchant tracking**: `<ViewTracker>` fires `POST /api/view` after 2s delay → `merchant_stats`
- **Article tracking**: `<StoryViewTracker>` fires `POST /api/story-view` after 2s delay → `articles.view_count`

### How to Test Tracking

1. Trigger an event (e.g. click WhatsApp on a merchant page)
2. Immediately go to Supabase → SQL Editor
3. Run: `SELECT * FROM page_views ORDER BY created_at DESC LIMIT 5;`
4. You should see the new record within seconds

### Tracking Best Practices
- **For page navigation after tracking**: Use regular `<a>` tags, NOT Next.js `<Link>`. Client-side navigation interrupts `sendBeacon`/`fetch` requests.
- **For WhatsApp/booking opens**: `trackEvent()` is fire-and-forget with `sendBeacon` — no need to `await` before `window.open()`.

---

## 🗺️ Our Partner Map Page (`/our-partner`)

### Features
- **Interactive Leaflet map** with OpenStreetMap (completely free)
- **Photo markers**: Each merchant shown as a circular photo with colored border
- **Color-coded by cuisine type**:
  - Cafe = Coffee `#8B4513`
  - Western = Yellow `#F59E0B`
  - Bakery = Orange `#F97316`
  - Japanese / Asian = Red `#EF4444`
  - Dessert = Pink `#EC4899`
  - Other = Gray `#6B7280`
- **User location**: Pulsing green dot with animation
- **Recenter button**: Top-right corner, click to fly back to your location
- **Type filters**: Top bar pills to show/hide cuisine types
- **Search box**: Search by restaurant name, area, or cuisine
- **Empty state**: "No restaurants found" message when filters return nothing
- **Merchant card popup**: Photo, name, Open/Closed badge, cuisine type
- **Two action buttons**:
  - **Go to Merchant Page** → Opens the restaurant's detail page
  - **Get Directions** → Opens Google Maps navigation directly

### How to Add Merchant Coordinates

The map requires `latitude` and `longitude`. Merchants without coordinates will NOT appear on the map.

**Step 1**: Add columns to Supabase (run once):
```sql
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS idx_merchants_lat_lng ON merchants(latitude, longitude);
```

**Step 2**: Find coordinates for each merchant:
1. Open [Google Maps](https://maps.google.com)
2. Search the restaurant address
3. **Right-click** on the exact location on the map
4. Select **"Copy coordinates"** (e.g. `3.1489, 101.7103`)
5. Go to **Supabase → Table Editor → merchants**
6. Paste the first number into `latitude`, the second into `longitude`

---

## SEO & Schema.org

### On-Page SEO
- **Meta tags**: Auto-generated per merchant and per article
- **Canonical URLs**: Every page has a canonical link
- **Open Graph**: Title, description, and image for social sharing
- **Twitter Cards**: Summary large image cards
- **Keywords**: Article pages include tags as meta keywords

### Structured Data (Schema.org)

| Page | Schema Type |
|------|-------------|
| Homepage | `WebSite` + `Organization` |
| Merchant | `Restaurant` + `Menu` + `BreadcrumbList` |
| Story | `Article` + `WebPage` |
| Stories List | `ItemList` |
| Join Us | `FAQPage` |
| Our Partner | `WebPage` |

### Technical SEO
- **Sitemap**: Auto-generated from all published merchants (`sitemap.ts`)
- **Robots**: Allow all, sitemap linked (`robots.ts`)
- **Google Search Console**: Verified
- **ISR**: 5-minute revalidation for fresh content without full rebuild
- **Image optimization**: Automatic compression via URL parameters

---

## Image Optimization

All images served through `SafeImage` are automatically optimized via `lib/image-utils.ts`:

- **Unsplash**: Resized to 800px, quality 80, auto WebP format, crop fit
- **Supabase Storage**: Compressed with width/quality parameters
- **Fallback**: Local images and data URIs pass through unchanged

This significantly reduces page load time and mobile data usage without requiring a paid image CDN.

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Admin Dashboard (server-side only, no NEXT_PUBLIC_ prefix)
ADMIN_PASSWORD=your-secure-password
```

> **Security**: `ADMIN_PASSWORD` must be set in **Vercel Dashboard → Environment Variables** with type **Secret**. Never commit it to Git.

---

## ⚙️ Site Settings (Admin Dashboard)

Go to `/admin` → **Settings** tab to modify:

| Setting | What It Controls | Example |
|---------|-----------------|---------|
| **Site Title** | Browser tab title, SEO meta, Schema.org, social sharing | `BiteSite` |
| **Site Description** | Meta description, Open Graph, Twitter Cards | `Discover the best restaurants in KL` |
| **Footer Text** | Bottom link text on every merchant page | `Discover more restaurants on BiteSite` |

Changes are saved instantly to the database and take effect within 5 minutes (ISR cache).

---

## 📝 Markdown Syntax for Articles

The `content` field supports full **GitHub Flavored Markdown** with **single line breaks preserved**:

```markdown
# Main Heading (H1)

## Subheading (H2)

**Bold text** for emphasis.
*Italic text* for lighter emphasis.

Regular paragraph text.
Single line breaks
are preserved automatically.

- Bullet point 1
- Bullet point 2

1. Numbered item 1
2. Numbered item 2

[Link to merchant page](/store/the-hearth-bakery)

[External link](https://example.com)

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
- **Hashtags**: Article `tags` are automatically displayed as `#hashtag` at the bottom of each story.
- **Line breaks**: Press Enter once for a new line, twice for a new paragraph.
- **Bold**: Use `**text**` (双星号). Use `*text*` for italic.
- **Horizontal rule**: Use `---` for a divider line.

---

## Key Business Rules

1. **No cart, no checkout, no auth** — pure showcase platform
2. **BiteSite branding is minimal** — only dynamic footer link at bottom of merchant pages
3. **Each merchant has independent visual identity** — layout + colors are per-merchant
4. **WhatsApp is the primary CTA** — reservations route to **merchant's own WhatsApp** (`merchant.whatsapp`)
5. **Booking form sends to merchant's WhatsApp** — not BiteSite's number
6. **cuisine_type supports comma-separated multi-values** — e.g. "Cafe, Western" (first value used as primary tag)
7. **Payment methods** stored as array: `["Cash", "Cashless", "Cards"]` — displayed with icons
8. **Operating hours** stored as JSONB — supports single and split hours (comma-separated)
9. **Tags** are free-text array — used for filtering (Halal, Pet Friendly, WiFi, etc.)
10. **Articles are published via Admin Editor or Supabase** — zero code required
11. **Article images use external URLs** — Google Drive, Unsplash, or any direct image link
12. **Dish search** — homepage search queries all available product names per merchant
13. **Embedded maps** — auto-rendered in Contact section if address exists
14. **Map page requires coordinates** — merchants without `latitude`/`longitude` are hidden from the map
15. **Admin Dashboard is password-only** — no user accounts, no registration
16. **Analytics are self-hosted** — no Google Analytics, all data stays in Supabase
17. **Legacy APIs are preserved** — `api/view` and `api/story-view` continue working alongside new `api/track`
18. **Inactive merchants show friendly page** — not 404, with related recommendations

---

## ⚠️ Known Issues

### Current
1. **Vercel deploy time increasing** — Build is getting slower. Likely causes: duplicate files between `components/` and `app/components/`, unused dependencies, or ISR static page generation overhead.

### Recently Fixed (2026-08-30)
- ✅ Site title, description, and footer text now editable via Admin Settings
- ✅ Inactive merchants display friendly "Unavailable" page instead of 404
- ✅ Booking form correctly routes to merchant's own WhatsApp
- ✅ Stories display hashtags and meta keywords from article tags
- ✅ Admin nav renamed "Stories" → "Stories Analytics"
- ✅ Settings panel only shows relevant fields (removed contact/phone/whatsapp)
- ✅ Stories Editor with Markdown toolbar + live preview + 6 background themes
- ✅ Stories CRUD API (GET/POST/PUT/DELETE) with Chinese slug support
- ✅ Sidebar is collapsible on desktop
- ✅ Single line breaks preserved in story content (remark-breaks)
- ✅ Stories Analytics shows article titles instead of slugs
- ✅ Stories Analytics displays both Total Views (legacy) and Period Views
- ✅ Category input has datalist dropdown to prevent typos
- ✅ Cover Image URL shows live preview
- ✅ Auto-save to localStorage every 30 seconds with restore prompt
- ✅ Word count displayed below content editor
- ✅ Markdown syntax hint banner in editor
- ✅ Stories Manager shows last updated time
- ✅ Merchants dropdown uses dedicated `/api/admin/merchants-list` API
- ✅ Save button refreshes stories list automatically

---

## Common Issues & Solutions

### "Build failed" email from Vercel
- Check the error in Vercel dashboard → Deployments → click the failed deployment
- Common causes: missing import, TypeScript type error, syntax error
- Fix the file and commit again

### Changes not showing after database edit
- Pages are cached for 5 minutes (ISR)
- **Solution**: Go to Vercel dashboard → Deployments → click latest → ⋮ → Redeploy → **uncheck "Use existing Build Cache"**
- Wait 30 seconds, then refresh

### Admin token expired
- Token expires after 30 minutes
- **Solution**: Log out and log back in at `/admin`

### Sidebar won't close on mobile
- Click the **X** button at the top of the sidebar
- Or click outside the sidebar area

### Story preview doesn't match real page
- Make sure you've **Redeployed Vercel** after saving
- Check that `background_style` is set correctly in Supabase

---

## How to Debug

```sql
-- Check if events are being recorded
SELECT event_type, COUNT(*) FROM page_views GROUP BY event_type;

-- Check recent raw data
SELECT * FROM page_views ORDER BY created_at DESC LIMIT 20;

-- Check aggregated data
SELECT * FROM merchant_daily_views ORDER BY view_date DESC LIMIT 20;

-- Manually trigger aggregation
SELECT aggregate_daily_views();

-- Check cron jobs
SELECT * FROM cron.job;

-- Check settings
SELECT * FROM settings;

-- Check merchant status
SELECT slug, name, status, is_published FROM merchants;

-- Check articles
SELECT slug, title, published, view_count, updated_at FROM articles ORDER BY updated_at DESC;

-- Check stories analytics data
SELECT slug, title, view_count FROM articles WHERE published = true ORDER BY view_count DESC;
```

### Supabase Timezone
All `created_at` timestamps are UTC. For Malaysia Time queries, append `+08:00`:
```sql
SELECT * FROM page_views 
WHERE created_at >= '2026-08-30T00:00:00+08:00';
```

---

## Project History

### Phase 0 — Foundation (Completed)
- ✅ Homepage with merchant grid, category filters, dish search
- ✅ 5 merchant layouts (classic/elegant/minimal/modern/rustic)
- ✅ Merchant detail pages with menu, events, videos, contact
- ✅ Stories system with Markdown rendering
- ✅ Interactive map with Leaflet
- ✅ Join Us pricing page
- ✅ Admin analytics dashboard (dark theme)
- ✅ Real-time tracking + view counts
- ✅ SEO + Schema.org structured data
- ✅ Settings system (site title, description, footer text)

### Phase 1 — Stories CMS (Completed 2026-08-30)
- ✅ **Stories Analytics API** moved to `/api/admin/stories-analytics` (shows article titles, legacy + period views)
- ✅ **Stories CRUD API** — full REST API (GET/POST/PUT/DELETE) at `/api/admin/stories` with Chinese slug support
- ✅ **Merchants List API** — `/api/admin/merchants-list` for dropdowns
- ✅ **6 background themes** for articles (default/warm/cool/dark/nature/minimal)
- ✅ **Admin Stories Editor** — Markdown editor with toolbar + live preview + auto-save + category dropdown + cover preview + word count + syntax hint
- ✅ **Admin Stories Manager** — list page with search, filter, delete, updated_at column
- ✅ **Settings API** now requires admin authentication
- ✅ **Sidebar** is collapsible on desktop
- ✅ **Single line breaks** preserved via remark-breaks
- ✅ **Save refreshes** stories list automatically

### Phase 2 — Merchant CMS (Planned)
- ⏳ Merchant Manager — list all merchants with status/actions
- ⏳ Merchant Form (5 tabs) — create/edit merchant info, contact, hours, layout, images
- ⏳ Menu Manager — manage categories and products per merchant
- ⏳ Category CRUD API
- ⏳ Product CRUD API

### Phase 3 — Polish (Planned)
- ⏳ Image upload (Supabase Storage) instead of URL pasting
- ⏳ Rich text editor (replace Markdown with WYSIWYG)
- ⏳ Multi-language support (EN / 中文 / BM)
- ⏳ Email notifications for new bookings
- ⏳ Social media auto-sharing

---

## Pages Summary

| Page | Path | Purpose |
|------|------|---------|
| Home | `/` | Browse all restaurants, search (including dishes), filter |
| Merchant | `/store/{slug}` | Individual restaurant menu, map, hours, SEO Schema |
| Our Partner | `/our-partner` | Interactive map showing all merchant locations |
| Stories | `/stories` | Blog list — all articles |
| Story | `/stories/{slug}` | Individual article (Markdown + Article Schema + hashtags) |
| Join Us | `/join-us` | Pricing & signup for restaurant owners (FAQ Schema) |
| **Admin** | **`/admin`** | **Analytics Dashboard + CMS — password protected** |

---

## Contact

**BiteSite** — Beautiful Menus for Local Restaurants  
Kuala Lumpur, Malaysia

> Built with Next.js + Tailwind + Supabase + Vercel
