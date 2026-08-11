# BiteSite

Beautiful Menus for Local Restaurants — Kuala Lumpur, Malaysia.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## Getting Started

```bash
cd bitesite
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/
  page.tsx              # Homepage (merchant grid)
  layout.tsx            # Root layout (fonts + metadata)
  globals.css           # Tailwind v4 + color tokens
  store/[merchant]/     # Merchant detail page
components/
  ui/                   # Shared UI primitives
  sections/             # Page section components
lib/
  supabase.ts           # Supabase client + queries
  styles.ts             # 3-style theme system
  utils.ts              # cn() helper
types/
  index.ts              # TypeScript interfaces
```

## 3 Visual Styles

Each merchant can choose a style (`fresh`, `luxury`, `japanese`):

| Style | Vibe | Colors | Fonts |
|-------|------|--------|-------|
| `fresh` | Bright cafe | Forest green + warm white | Playfair + Inter |
| `luxury` | Dark fine dining | Black + champagne gold | Cormorant Garamond + Inter |
| `japanese` | Minimal zen | Cream + matcha green | Noto Serif/Sans JP |

## Database Schema (Required)

```sql
-- Add style column to merchants
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS style VARCHAR(20) DEFAULT 'fresh';

-- New table for multiple videos
CREATE TABLE IF NOT EXISTS merchant_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  video_type VARCHAR(20) DEFAULT 'self_hosted',
  caption TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## SEO

- Auto-generated meta tags per merchant page
- Schema.org JSON-LD (Restaurant)
- OG images from hero cover photo
- Canonical URLs

## License

Private — BiteSite by CH.
