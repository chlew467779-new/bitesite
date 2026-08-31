# BiteSite 项目交接文档 — Phase 4 进行中 + 已知问题汇总
# 生成时间: 2026-08-31 11:45 MYT
# 项目: BiteSite — KL 餐厅展示平台
# GitHub: https://github.com/chlew467779-new/bitesite
# Live: https://bitesite-pied.vercel.app
# Owner: CH（不懂代码，所有技术操作需逐步指导）
# 代码编辑方式: GitHub 网页直接编辑（无本地终端）
# 部署: GitHub commit → Vercel 自动部署（30-60秒）

---

## ⚠️ 给新 Chat 的关键指令（必须遵守）

> **CH 不懂代码**。所有技术操作必须：
> 1. **给完整代码**，让他 copy-paste 到 GitHub
> 2. **一步一步来**，每次只改少量文件（2-3个）
> 3. **每次 commit 后等 Vercel 部署**（30-60秒），验证后再下一步
> 4. **每个新文件第一行必须写注释**：`/* bitesite/文件路径 */`
> 5. **文件路径陷阱**：`components/sections/` 和 `app/components/sections/` 下可能有同名文件，修改前务必确认 import 路径
> 6. **ISR 缓存已降到 60 秒**：改数据库后最多等 1 分钟就能看到效果（之前是 5 分钟）
> 7. **保存/删除已自动刷新缓存**：Admin 操作后页面会立即更新（revalidatePath 已接入）
> 8. **Import 导出方式陷阱**：admin components 大部分是 `export default`，只有 `SettingsPanel` 是命名导出 `{ SettingsPanel }`
> 9. **分阶段工作**：每次对话不要安排太多文件改动，避免超出上下文长度被强制结束
> 10. **Token 30 分钟过期**：Admin 操作超时后会 Unauthorized，需要刷新页面重新登录

---

## 一、项目上下文（快速背景）

- **业务**: 为 KL 独立咖啡馆/餐厅提供展示页面，纯展示无购物车
- **技术栈**: Next.js 16 + Tailwind v4 + Supabase + Vercel
- **关键决策**: 
  - 无购物车/无下单/无 auth（用户端）
  - 每个商家页有独立视觉风格（classic/elegant/minimal/modern/rustic）
  - BiteSite 品牌仅在底部低调显示 footer 链接
  - Booking 表单发给**商家自己的 WhatsApp**（`merchant.whatsapp`）
- **定价**: Setup RM599 + Monthly RM149

---

## 二、已完成工作汇总

### ✅ Phase 0-1: 基础架构（之前完成）
- 首页、商家列表、商家详情页、Stories 页面
- 5 种 layout 风格（classic/elegant/minimal/modern/rustic）
- Supabase 数据库 + Vercel 部署
- Analytics 埋点系统

### ✅ Phase 2: Admin Dashboard 修复（2026-08-31 完成）
- 14 个 tab 全部正常渲染
- `dynamic = 'force-dynamic'` 移到 layout.tsx

### ✅ Phase 3: Stories Analytics 优化（2026-08-31 完成）
- Stories Analytics 表格显示真实标题（不是 slug）
- 双 views 系统（Period Views + Total Views）
- Status 列（Published/Draft）
- event_detail fallback 修复

### ✅ Phase 4 步骤 1: Merchant Manager 列表（本次对话完成）
**文件**:
- `app/api/admin/merchants-crud/route.ts` — GET 接口，返回 enriched merchants（含 product_count, view_count）
- `app/admin/components/merchant-manager.tsx` — 卡片式列表，支持搜索、Published/Draft 筛选、Status 筛选
- `app/admin/components/admin-shell.tsx` — 添加 "Merchant Manager" tab
- `app/admin/page.tsx` — 添加 `merchant-manager` tab 渲染

**功能**:
- 显示商家 logo、名称、slug、layout、is_published 状态、views 数、products 数量
- 搜索框：按名称/slug 搜索
- 状态筛选：All / Published / Draft
- Status 筛选：All / Active / Inactive（右上角双标签：Live/Draft + Active/Inactive）
- 新建商家按钮
- 点击卡片进入编辑
- View 外链可打开商家页面

### ✅ Phase 4 步骤 2: Merchant Editor 表单（本次对话完成）
**文件**:
- `app/api/admin/merchants-crud/route.ts` — 已更新，支持 POST/PUT/DELETE + revalidatePath
- `app/admin/components/merchant-form.tsx` — 新建，5 个 tab 的完整表单
- `app/admin/components/merchant-manager.tsx` — 已更新，接入表单（新建/编辑/删除）

**5 个 Tab**:
1. **Basic Info**: name*, slug*（自动生成）, tagline, description, layout（5 种可选）, cuisine_type, area, tags
2. **Contact**: address, phone, whatsapp*, email, website, instagram, facebook, latitude, longitude
3. **Hours**: 周一到周日，每行一个文本输入框
4. **Settings**: is_published toggle, status（active/inactive）, 9 个 Features 勾选（Hero/About/Menu/Contact/Related/Events/Video/Gallery/Testimonials）
5. **Images**: logo_image URL, cover_image URL, menu_pdf_url URL（带预览图）

**表单验证**:
- name 必填
- slug 必填，唯一，只允许 a-z0-9-（自动从 name 生成）
- whatsapp 必填（Booking 表单需要）

**删除功能**:
- 点击 Delete 弹出确认对话框
- 删除前自动清理关联数据（products, categories, merchant_videos, events）

### ✅ 性能优化（本次对话完成）
- ISR 缓存从 300s 降到 60s（`app/store/[merchant]/page.tsx` 和 `app/stories/[slug]/page.tsx`）
- Admin API 保存/删除后立即调用 `revalidatePath()`
  - Merchants: POST/PUT/DELETE 后刷新 `/store/{slug}` 和 `/`
  - Stories: POST/PUT/DELETE 后刷新 `/stories/{slug}` 和 `/stories`

---

## 三、🟡 已知问题汇总（从 test restaurant 测试发现）

### 🔴 高优先级（影响现有商家体验，必须尽快修）

#### 问题 1: Operating Hours 输入不标准化
**现象**: 
- 输入 `9:00 am - 10:00 pm` → 显示正常
- 输入 `open` → 显示 `open`（小写，未格式化）
- 输入 `CLOSED` → 显示 `CLOSED`（大写，未统一）
- 输入 `OPEN CLOSED` → 显示 `OPEN CLOSED`（混乱）
- 输入 `9:00 am - 10:00 pm 9:00 am - 10:00 pm` → 文本重复
- 输入 `9:00 am - 10:00 pm CLOSED` → 时间和 Closed 混在一起

**根因**: 纯文本输入，前端没有标准化处理

**需求**:
- 支持多时间段：`9:00 AM - 12:00 PM, 3:00 PM - 7:00 PM`
- 统一大小写：不管输入 `am`/`AM`/`a.m.`，显示统一格式
- 识别 "Closed"：任何包含 `closed`（大小写不敏感）→ 显示 "Closed"
- 结构化输入：不用文本框，改用 Start Time + End Time 行，可添加多行
- 快捷按钮："Copy Monday to all days"、"Set as Closed"

**涉及文件**:
- `app/admin/components/merchant-form.tsx` — Hours tab 重构
- `app/store/[merchant]/page.tsx` 或相关组件 — 前端显示标准化

#### 问题 2: 空模块显示标题（没内容还显示区块）
**现象**: 
- Menu 区块：没有菜品，但显示 "Menu" 标题和空内容
- Gallery 区块：没有图片，显示 "No Image" 灰色块
- Events 区块：没有活动，显示 "Stay tuned..."
- Video 区块：没有视频，完全空白但标题还在
- Testimonials 区块：没有评论，完全空白但标题还在

**根因**: Features toggle 只控制"是否渲染区块"，但区块内部没有判断"是否有内容"

**需求**:
- Menu 区块：products.length === 0 时不渲染
- Gallery 区块：没有图片时不渲染
- Events 区块：没有 events 时不渲染
- Video 区块：没有 video URL 时不渲染
- Testimonials 区块：没有 reviews 时不渲染
- Hero 区块：没有 cover_image 时显示 fallback（纯色背景 + 商家名首字母），而不是 "No Image"

**涉及文件**:
- `app/store/[merchant]/page.tsx` 或相关 section 组件
- 需要确认各区块的组件路径（可能在 `app/components/sections/` 或 `components/sections/`）

#### 问题 3: 图片 URL 容易填错
**现象**: 
- 用户填了 Unsplash 页面链接（`https://unsplash.com/photos/...`）
- 结果前端显示 "No Image" 灰色块
- 用户不知道要填直接图片链接（`https://images.unsplash.com/photo-...`）

**需求**:
- 输入框加验证：如果不是以图片扩展名结尾（.jpg/.jpeg/.png/.webp/.gif），显示黄色警告提示
- 加帮助文字："Paste the direct image URL (ends with .jpg or .png). Right-click image → Copy image address."
- 预览图加载失败时显示明确提示（而不是默默隐藏）

**涉及文件**:
- `app/admin/components/merchant-form.tsx` — Images tab

#### 问题 4: Social Links 没有格式验证
**现象**: 
- Website: `test website` → 不是网址
- Instagram: `test instagram` → 不是网址
- 前端点击会 404 或跳转错误

**需求**:
- 输入框加 `https://` 前缀占位符
- 保存时验证：如果不是有效 URL（以 http:// 或 https:// 开头），显示警告但不阻止保存（或者存为 null）
- 前端渲染时：如果不是有效 URL，显示为纯文本而不是链接

**涉及文件**:
- `app/admin/components/merchant-form.tsx` — Contact tab
- `app/store/[merchant]/page.tsx` — 前端渲染逻辑

#### 问题 5: 缺少 Save 成功/失败反馈
**现象**: 
- 点击 Create/Update 后，如果成功只是回到列表，没有 Toast/提示
- 如果失败，只在表单顶部显示红色错误条，容易忽略
- 用户不确定操作是否成功

**需求**:
- 添加 Toast 组件：Save 成功显示绿色 "Merchant saved successfully"
- Delete 成功显示 "Merchant deleted"
- 错误时显示红色 Toast（替代或补充现有的顶部 error bar）

**涉及文件**:
- `app/admin/components/merchant-form.tsx`
- 可能需要新建 `app/admin/components/toast.tsx` 或类似组件

### 🟡 中优先级（Admin 功能完善）

#### 问题 6: Features toggle 有 9 个选项但大部分没有内容管理
**现状**:
| Feature | 有内容管理界面 | 内容存在哪 |
|---------|--------------|----------|
| Hero | ✅ | Images tab → cover_image |
| About | ✅ | Basic Info → description |
| Menu | ❌ | 需要 Menu Manager |
| Contact | ✅ | Contact tab |
| Related | ✅ | 自动（同 cuisine_type） |
| Events | ❌ | 需要 Events Editor |
| Video | ❌ | 需要 Video URL 输入 |
| Gallery | ❌ | 需要 Gallery 图片管理 |
| Testimonials | ❌ | 需要 Reviews 管理 |

**需求**:
- 短期内：没内容管理的 Features 先不显示 toggle，或者 toggle 旁标注 "Coming soon"
- 或者：有 toggle 但对应区块为空时自动隐藏（见问题 2）

#### 问题 7: Cuisine Type / Area / Tags 应该是下拉+自定义
**现象**: 
- 纯文本输入导致数据混乱
- `test cuisine type` 显示为全大写 `TEST CUISINE TYPE`
- 同一类型多种写法：`Cafe`/`cafe`/`CAFE`/`Café`

**需求**:
- **Cuisine Type**：下拉预设（Cafe, Western, Asian, Bakery, Japanese, Indian, Chinese, Korean, Mexican, Italian, French, Fusion, Dessert, Bar, Fine Dining）+ "Other" 自定义输入
- **Area**：下拉预设（Desa ParkCity, Bangsar, Mont Kiara, KLCC, Damansara, TTDI, PJ, Kepong, Cheras, Subang, Puchong, Kuchai Lama, Mid Valley, Pavilion, Setapak）+ "Other" 自定义输入
- **Tags**：多选标签预设（Halal, Pet Friendly, WiFi, Outdoor Seating, Delivery, Takeaway, Parking, Wheelchair Accessible, Live Music, Private Room, Vegan Options, Gluten Free）+ 自定义新增
- 数据库层面：考虑是否需要新建 `cuisine_types` / `areas` 表，还是继续用字符串+前端限制

**涉及文件**:
- `app/admin/components/merchant-form.tsx` — Basic Info tab
- 可能需要新建预设常量文件

#### 问题 8: 缺少 Preview 功能
**需求**:
- 表单加 "Preview" 按钮，在新标签页打开 `/store/{slug}?preview=1`
- 或者右侧边栏显示实时预览卡片
- 对于 Draft 状态的商家，也能预览（绕过 is_published 检查）

**涉及文件**:
- `app/admin/components/merchant-form.tsx`
- `app/store/[merchant]/page.tsx` — 需要支持 `?preview=1` 参数

### 🟢 低优先级（体验提升）

#### 问题 9: 缺少 Auto-save
**需求**: 填到一半刷新页面，内容不丢失（localStorage 草稿）

#### 问题 10: 缺少 Duplicate Merchant 功能
**需求**: 基于现有商家复制一份，改个名字就能快速创建新商家

#### 问题 11: tagline 字段数据库兼容性
**历史**: 最初创建 merchants 表时可能没有 tagline 字段，需要确认所有环境都有该字段
**SQL 检查**: `ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tagline TEXT;`

#### 问题 12: 地图坐标精度
**现象**: 填了 Latitude 3.134, Longitude 101.7，但地图显示 Kuchai Lama（可能默认坐标）
**需要确认**: Google Maps 嵌入组件用的是坐标还是地址搜索

---

## 四、🔵 下一步计划（分阶段）

### 阶段 A: 修复高优先级问题（🔴 层）
**目标**: 让现有商家页面体验正常，test restaurant 不再显示混乱

#### A1: Operating Hours 结构化输入
- 改 `app/admin/components/merchant-form.tsx` — Hours tab
- 改商家页面营业时间显示组件（确认路径后修改）
- 工作量：中

#### A2: 空模块自动隐藏 + 图片 Fallback
- 改商家页面各 section 组件
- 工作量：中（需要确认各区块组件路径）

#### A3: 图片 URL 验证 + Social Links 验证 + Toast 提示
- 改 `app/admin/components/merchant-form.tsx`
- 可能需要新建 Toast 组件
- 工作量：小

### 阶段 B: Menu Manager（核心功能）
**目标**: 能在 Admin 里管理菜单（Categories + Products）

#### B1: Menu Manager UI
- 新建 `app/admin/components/menu-manager.tsx`
- 在 MerchantForm 里嵌入或作为独立 tab
- 功能：显示该商家的 categories + products，增删改，拖拽排序

#### B2: Menu CRUD API
- 新建 `app/api/admin/products/route.ts`（GET/POST/PUT/DELETE）
- 操作 categories 和 products 表

#### B3: 前端菜单渲染对接
- 确认商家页面如何读取 categories/products
- 工作量：大

### 阶段 C: 下拉选择 + 自定义（🟡 层）
- Cuisine Type / Area / Tags 下拉 + 自定义
- Features toggle 标注 "Coming soon" 或隐藏无内容管理的选项
- Preview 按钮

### 阶段 D: 其他内容管理（Events/Video/Gallery/Testimonials）
- 需要新建数据库表
- 每个都要独立的 Admin 管理界面
- 工作量：大，分多个阶段

### 阶段 E: Phase 5 优化
- Supabase Storage 图片上传
- Auto-save
- Duplicate Merchant
- Stories 分页、全文搜索

---

## 五、数据库表结构速查（最新确认）

### merchants（商家）
```sql
id uuid, slug text UNIQUE, name text, tagline text, description text,
layout text, cuisine_type text, area text, tags text[],
address text, phone text, whatsapp text, email text, website text,
instagram text, facebook text, latitude numeric, longitude numeric,
operating_hours jsonb, is_published boolean DEFAULT false,
status text DEFAULT 'active', features jsonb,
logo_image text, cover_image text, menu_pdf_url text,
created_at timestamptz, updated_at timestamptz
```

### categories（菜品分类）
```sql
id uuid, merchant_id uuid REFERENCES merchants(id),
name text, sort_order int, created_at
```

### products（菜品）
```sql
id uuid, merchant_id uuid REFERENCES merchants(id),
category_id uuid REFERENCES categories(id), name text,
description text, price numeric, discount_price numeric, image_url text,
sort_order int, is_available boolean DEFAULT true, is_featured boolean DEFAULT false,
show_prices boolean DEFAULT true, created_at, updated_at
```

### articles（Stories）
```sql
id uuid, slug text UNIQUE, title text, excerpt text, content text,
cover_image text, category text, tags text[], author text,
background_style text, merchant_slug text, published boolean,
view_count int DEFAULT 0, created_at, updated_at
```

### page_views（埋点）
```sql
id uuid, slug text, path text, page_type text, event_type text,
event_detail text, referrer text, user_agent text, ip text, created_at
```

**注意**: `tagline` 字段如果报错 "Could not find column"，需要执行：
```sql
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tagline TEXT;
```

---

## 六、关键文件状态速查

### 当前已确认正常的文件
| 文件 | 状态 | 备注 |
|------|------|------|
| `package.json` | ✅ 正常 | 加了 remark-breaks |
| `app/api/admin/stories/route.ts` | ✅ 正常 | 含 revalidatePath |
| `app/api/admin/merchants-crud/route.ts` | ✅ 正常 | 完整 CRUD + revalidate |
| `app/api/admin/merchants-list/route.ts` | ✅ 正常 | 返回 {slug, name} |
| `app/api/admin/stories-analytics/route.ts` | ✅ 正常 | 含 title/published/fallback |
| `components/sections/story-content.tsx` | ✅ 正常 | remark-breaks + 换行处理 |
| `app/admin/components/story-editor.tsx` | ✅ 正常 | 完整重写，功能全 |
| `app/admin/components/stories-manager.tsx` | ✅ 正常 | updated_at + tags null fix |
| `app/admin/components/stories-chart.tsx` | ✅ 正常 | 含 Status 列 |
| `app/admin/components/auth-context.tsx` | ✅ 正常 | 未改动 |
| `app/admin/components/admin-shell.tsx` | ✅ 正常 | 13 tabs + settings/export |
| `app/admin/components/client-layout.tsx` | ✅ 正常 | 包裹 AuthProvider |
| `app/admin/components/merchant-manager.tsx` | ✅ 正常 | 含 Status filter + 表单接入 |
| `app/admin/components/merchant-form.tsx` | ✅ 正常 | 5 tabs 完整表单 |
| `app/admin/layout.tsx` | ✅ 正常 | force-dynamic |
| `app/admin/page.tsx` | ✅ 正常 | 15 tabs 全部渲染 |
| `lib/analytics.ts` | ✅ 正常 | trackEvent + classifyReferrer |
| `lib/admin-auth.ts` | ✅ 正常 | verifyAdminToken |
| `lib/supabase.ts` | ✅ 正常 | 未改动 |

### 需要修改的文件（待办）
| 文件 | 优先级 | 说明 |
|------|--------|------|
| `app/admin/components/merchant-form.tsx` | 🔴 高 | Hours tab 重构、URL 验证、Toast |
| `app/store/[merchant]/page.tsx` | 🔴 高 | ISR 已改 60s，需修空模块隐藏 |
| 商家页面各 section 组件 | 🔴 高 | 空模块隐藏、图片 fallback |
| `app/admin/components/menu-manager.tsx` | 🟡 中 | 待创建 |
| `app/api/admin/products/route.ts` | 🟡 中 | 待创建 |

---

## 七、Import 导出方式速查（重要！）

| Component | 导出方式 | 正确 import |
|-----------|----------|-------------|
| `AdminShell` | `export default` | `import AdminShell from '...'` |
| `StatCards` | `export default` | `import StatCards from '...'` |
| `TrendChart` | `export default` | `import TrendChart from '...'` |
| `DeviceChart` | `export default` | `import DeviceChart from '...'` |
| `ReferrerChart` | `export default` | `import ReferrerChart from '...'` |
| `EventsChart` | `export default` | `import EventsChart from '...'` |
| `LocationChart` | `export default` | `import LocationChart from '...'` |
| `HourlyChart` | `export default` | `import HourlyChart from '...'` |
| `StoriesChart` | `export default` | `import StoriesChart from '...'` |
| `MapStats` | `export default` | `import MapStats from '...'` |
| `SearchKeywordsTable` | `export default` | `import SearchKeywordsTable from '...'` |
| `MerchantTable` | `export default` | `import MerchantTable from '...'` |
| `ExportButton` | `export default` | `import ExportButton from '...'` |
| `RealtimeBadge` | `export default` | `import RealtimeBadge from '...'` |
| `DateRangePicker` | `export default` | `import DateRangePicker from '...'` |
| `SettingsPanel` | `export { SettingsPanel }` | `import { SettingsPanel } from '...'` ⚠️ 唯一例外 |
| `StoriesManager` | `export default` | `import StoriesManager from '...'` |
| `StoryEditor` | `export default` | `import StoryEditor from '...'` |
| `MerchantManager` | `export default` | `import MerchantManager from '...'` |
| `MerchantForm` | `export default` | `import MerchantForm from '...'` |
| `AuthProvider` | `export { AuthProvider }` | `import { AuthProvider } from '...'` |
| `useAuth` | `export { useAuth }` | `import { useAuth } from '...'` |
| `ClientLayout` | `export { ClientLayout }` | `import { ClientLayout } from '...'` |

---

## 八、文件路径陷阱

项目有两个平行的 component 目录：
- `components/sections/` —— **legacy**，Stories 页面在用（如 `story-content.tsx`, `story-hero.tsx`）
- `app/components/sections/` —— **新版**，其他页面在用

**修改前务必确认 import 路径！**

---

## 九、关键代码速查

### 埋点调用
```typescript
import { trackEvent } from '@/lib/analytics';
trackEvent('page_view', { pageType: 'story', slug: articleSlug });
trackEvent('story_to_merchant', { 
  pageType: 'story', 
  slug: merchantSlug, 
  detail: articleSlug 
});
```

### Supabase 查询
```sql
-- 查看所有商家
SELECT * FROM merchants ORDER BY created_at DESC;

-- 查看商家菜品
SELECT * FROM products WHERE merchant_id = 'xxx';

-- 查看分类
SELECT * FROM categories WHERE merchant_id = 'xxx' ORDER BY sort_order;

-- 添加 tagline 字段（如缺失）
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tagline TEXT;
```

### 文件编辑方式
1. 打开 https://github.com/chlew467779-new/bitesite
2. 找到文件 → 点击铅笔 Edit
3. 粘贴完整代码（新文件第一行必须写 `/* bitesite/文件路径 */`）
4. Commit message 写清楚
5. 等 Vercel 部署（30-60秒）

---

## 十、待确认问题（新 Chat 开始前必须解决）

1. **商家页面各 section 组件路径**
   - Menu 区块在哪个文件？`app/components/sections/menu-section.tsx`？
   - Gallery 区块在哪个文件？
   - Events 区块在哪个文件？
   - Video 区块在哪个文件？
   - Testimonials 区块在哪个文件？
   - 需要查看 `app/store/[merchant]/page.tsx` 的 import 路径确认

2. **operating_hours 前端解析逻辑**
   - 现有商家页面如何解析 `operating_hours` JSON？
   - 格式是 `{"monday":"9:00 AM - 10:00 PM",...}` 还是其他？
   - 需要确认解析代码才能做标准化

3. **地图组件使用方式**
   - 是用 Google Maps iframe？还是 react-google-maps？
   - 用的是 latitude/longitude 还是地址字符串？
   - 需要确认才能修复坐标问题

---

*文档结束。下一个 Chat 请从 "阶段 A: 修复高优先级问题" 开始，先确认商家页面 section 组件路径，然后分阶段实现。*
