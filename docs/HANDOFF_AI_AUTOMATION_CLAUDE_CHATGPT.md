# BiteSite AI Automation Handoff

**更新时间：** 2026-09-20  
**当前分支：** `feat/story-editorial-foundation`  
**最新 commit：** `f09b8c3`  
**用途：** CH 不在线时，Claude 负责产品设计与 Supabase/Vercel 观察/操作，ChatGPT 负责持续 coding、测试、UI/UX 修复和 SEO 实现。

## 1. 先读哪些文件

按以下顺序读取，不要只依赖聊天记录：

1. `docs/product/BITESITE_MASTER_PRODUCT_DEVELOPMENT_SPEC.md`（产品与架构 source of truth）
2. `docs/DECISION_LOG.md`（已确认决定、开放问题、明确 out of scope）
3. `docs/AI_WORKFLOW.md`（AI 协作和 handoff 规则）
4. 本文件（当前实现状态和明天的执行协议）
5. `git log --oneline -20`、`git status --short`

Master Spec 是产品方向，不代表功能已经实现。实现状态必须以 repository code、migration、测试结果为准。

## 2. CH 不在线时的职责分工

### Claude：设计、审计、Supabase/Vercel 操作

Claude 不负责写 application code。Claude 负责：

- 根据 Master Spec 决定下一阶段的产品设计、用户流程和优先级；
- 审计真实 repository、Supabase schema/RLS/Storage/cron 和 Vercel project/environment；
- 用鼠标在 Supabase/Vercel UI 中确认 ChatGPT 无法读取的设置，并提供截图、字段名、状态和证据；
- 给 ChatGPT 一份可直接执行的 coding packet（见第 5 节）；
- 发现产品决定、法律风险、外部账号授权或不可逆生产操作时，标记为 `CH_REQUIRED`；
- 所有设计必须保留人工审核，不得建议 AI 自动发布高风险内容。

Claude 不应在没有证据时猜测表名、RLS、环境变量、Vercel branch 或生产状态。

### ChatGPT：持续 coding、测试、实现和修复

ChatGPT 负责：

- 读取 Claude 的 coding packet 并直接实现，不重复做大段产品讨论；
- 修改 React/Next.js/API/validation/SEO/test code；
- 运行 `typecheck`、`lint`、`check:security` 和适合的 smoke/integration tests；
- 创建合成 merchant、product、story 数据做 UI/API 测试，并在测试后删除合成数据；
- 发现 UI/UX、可访问性、性能、SEO 和安全问题时，自行修复并记录；
- 每个 bounded batch 建立 commit，保持工作区可恢复；
- 只有遇到 `CH_REQUIRED` 才暂停，不因为普通代码问题等待 CH。

### CH：最小介入

CH 只需要处理：

- 产品方向冲突或法律/版权/定价决定；
- 新的外部账号授权、OAuth、社交平台连接和生产破坏性操作；
- Claude 明确标记的 `CH_REQUIRED` 问题。

如果问题只是实现细节，Claude 应给出推荐默认值，ChatGPT 直接采用并记录，而不是把问题转回 CH。

## 3. 今天已经完成的代码（ChatGPT）

当前最新代码已推送到 `feat/story-editorial-foundation`：

- Merchant optional fields：公开商家页在没有资料时隐藏空白区块；
- Merchant Form：服务端字段类型、URL、邮箱、坐标、数组、长度和 request body 校验；保存前错误会自动跳到首个错误所在分区；未保存修改有离开保护；
- Story Editor：标题、slug、正文、分类、封面 URL、版权声明和 editorial status 校验；已发布 Story 的 material edit 需重新审核；加入文案质量检查提示、自动保存和未保存保护；
- Story List：加载失败显示真实错误和 Retry；分类无结果时可清除筛选；
- Admin Dashboard：指标名称和说明更准确；指标/Story analytics 加 Retry；统计范围修正为真正的 7/30/90/365 个自然日；
- Join Us：Hero、Pricing、Footer WhatsApp CTA 写入转化追踪；
- Analytics：merchant contact actions、GrabFood outbound click、email/phone/WhatsApp/directions/menu/story events 已接入既有 tracking；匿名 ingest 有 body cap、rate limit 和去重保护；
- Security：anon lockdown 测试已通过；service-role 使用检查已通过；
- Lint 工具链：目前 `lint` 无 error，仅保留 `<img>` 优化 warnings；
- SEO 基础：canonical、robots、sitemap、可配置 site URL 的基础已在此前 commits 完成。

已验证：

```text
npm run typecheck       PASS
npm run lint            PASS (0 errors; image warnings remain)
npm run check:security  PASS
```

Production build 在本地曾因无法访问 `fonts.googleapis.com` 失败；这是环境网络问题，不是 TypeScript/应用编译错误。不要因此擅自替换品牌字体，除非 Claude 设计 packet 明确要求 self-host 字体。

## 4. 明天优先级（Claude 负责设计，ChatGPT 负责实现）

### P0-A：Merchant identity / claim / auth

Claude 先确认 merchant owner/member 的最小模型、admin 与 merchant 权限边界、RLS 和 transfer history。ChatGPT 再实现：

- merchant claim/invite 状态；
- owner 只能操作自己的 merchant；
- admin 仍可审核、转移和撤销；
- 所有 mutation 有审计字段和安全错误；
- 不允许把 client-supplied `merchant_id` 当作授权依据。

### P0-B：Story submission 与 AI copy assistance

目标流程：Merchant 提供事实/图片 → submission → AI 只做结构化、改写、摘要、风险提示 → Admin/CH 审核 → publish。

ChatGPT 可先实现不依赖外部模型的基础：

- source facts 与 generated copy 分开存储；
- draft/suggestion/approved/rejected 状态；
- 版本记录、review notes、rights declaration；
- AI 输出不可直接 publish；
- provider unavailable 时仍可手工编辑和提交。

Claude 必须先决定 provider、预算上限、语言（中/英/马来文）、prompt 版本和 fallback。没有 API key 或预算确认时，不要偷偷接入付费模型。

### P0-C：Real media pipeline

当前主要还是 URL-based media。Claude 需要审计 Supabase Storage bucket、大小限制、公开/签名 URL、删除策略和图片优化方式。ChatGPT 再实现：

- 1 cover + 最多 3 张 Story images；
- MIME/size/dimension 校验；
- 自动压缩/生成合理尺寸；
- rights declaration 和删除旧版本；
- 图片加载失败的 fallback 和 alt text。

### P1-A：Merchant/Admin analytics

- 商家只看到自己的数据；
- Story views 独立，不并入 merchant page views；
- 外链 click 按 `event_type` 与 `event_detail` 分开；
- 所有日期范围使用统一 inclusive range 和明确时区；
- 0 数据、延迟、失败必须显示为“无数据/暂时不可用”，不可静默显示 0；
- Dashboard 文案必须说明“tracked events 不等于订单”。

### P1-B：SEO / Growth

按页面逐一审计并修复：

- 首页、Join Us、merchant page、Story list、Story detail 的 title/description；
- canonical URL、robots、sitemap、draft/noindex 行为；
- Open Graph、Twitter/X card、分享图片、图片 alt；
- `Restaurant`/`LocalBusiness`/`Article`/`BreadcrumbList` JSON-LD 的字段完整性；
- 商家 slug 和 Story slug 稳定性，改名时是否需要 redirect；
- 站内链接：Stories ↔ Merchant、地区/菜系 landing page；
- Malaysia/Singapore 的语言、货币和地区 metadata；
- 页面速度、图片尺寸、字体加载、移动端 Core Web Vitals；
- 404、空状态、过期 Story、未发布内容不能被搜索引擎错误索引。

SEO 改动要用真实页面和 `curl`/浏览器检查，不只看 React source。

### P1-C：Join Us / Stories UI UX

- Join Us CTA 必须清楚说明价格、交付时间、没有佣金、如何开始；
- Stories 要有稳定的 loading/error/empty/filter 状态；
- Story detail 要有阅读层级、来源/作者、商家链接、分享和移动端可读性；
- Admin 表单要有 contextual hints、字数提示、版权声明和预览；
- 所有按钮、表单、错误状态支持键盘和 screen reader。

### 社交平台发布：先做 manual-first

Master Spec 当前建议 V1 不依赖社交 API。明天不要直接实现 Facebook/Instagram/Xiaohongshu/Threads API，除非 Claude 先提供平台账号、OAuth、权限、审核、失败重试、token 保管和成本设计。

可先实现低风险基础：

- 生成平台专用文案草稿和 hashtag 建议；
- 生成规范 OG 图片/分享 URL；
- 一键复制 text、URL、image brief；
- 记录“准备发布/已手动发布”的 editorial distribution 状态；
- 不把“复制成功”误报成“平台已发布”。

## 5. Claude 必须交给 ChatGPT 的 coding packet

每个任务请使用下面格式。没有这份 packet，ChatGPT 可以做 bug fix/UX/SEO，但不要猜复杂 schema 或外部集成。

```text
TASK_ID:
GOAL:
PRIORITY: P0/P1/P2
PRODUCT_DECISION:
REPOSITORY_FACTS: exact files, routes, tables, current behavior
FILES_TO_CHANGE: exact paths
FILES_NOT_TO_CHANGE:
DATABASE_CONTRACT: tables, columns, constraints, indexes, RLS
API_CONTRACT: method, path, request, response, auth, errors
UI_FLOW: loading, empty, error, success, mobile behavior
SECURITY_RULES:
SEO_RULES:
ACCEPTANCE_TESTS:
SYNTHETIC_TEST_DATA:
ENV/Vercel/Supabase_ACTIONS: read-only or explicitly approved mutation
CH_REQUIRED: yes/no; if yes, exact reason
DEFAULTS_IF_UNCERTAIN:
```

设计 packet 必须说明 source-of-truth 文件、是否需要 migration、是否要更新 RLS、是否需要 env var、是否会产生外部费用。

## 6. ChatGPT 需要 Claude 明确提供的资料

### Repository / branch

- 最新 branch 和 commit SHA；
- Claude 审计过的真实文件路径；
- 哪些改动已在 branch、哪些只在设计文档；
- 当前 typecheck/lint/security/build 结果。

### Supabase

- project ref、staging/production 区分；
- 当前 migrations 已执行到哪一个；
- 真实表/列/index/constraint/RLS policy；
- Storage buckets、public/private、size/MIME policy；
- pg_cron/aggregation job 和数据库时区；
- anon/authenticated/service_role 哪些操作允许；
- 不要把 service key、password、anon key 写入 handoff。

### Vercel

- project、production branch、preview branch；
- Preview Authentication 当前状态；
- env var 名称、作用域（Preview/Production），只提供“存在/缺失”，不提供 secret 值；
- 最近 deployment/build/log 结果；
- domain/canonical/site URL 实际值。

### 产品与增长

- 目标市场、语言、货币、地区；
- 主要 SEO keyword/城市/菜系；
- AI provider 与月度预算；
- 社交平台第一阶段是否只做 manual distribution；
- 任何需要 CH 明确批准的决定。

## 7. ChatGPT 自主执行循环

1. 读取本文件、Master Spec、Decision Log 和 Claude packet。
2. 用 `rg`、type definitions、route、migration 验证 repository facts。
3. 先做小而可回滚的实现；不要在同一 commit 混入猜测性的产品决定。
4. 为成功、失败、空数据、权限、超长输入、重复提交和移动端做测试。
5. 必要时生成 `zz-ai-test-*` 合成 merchant/story，验证页面、API、analytics 和 SEO；测试后清理。
6. 运行：

   ```text
   npm run typecheck
   npm run lint
   npm run check:security
   ```

7. 能做 local smoke 就不要等待 CH；需要 Supabase/Vercel UI 的事项由 Claude 读取并报告证据。
8. 提交 commit，记录 changed files、测试结果、未解决风险和下一步。
9. 只有遇到 `CH_REQUIRED` 才停；普通 bug、UI 不一致、SEO 缺口由 ChatGPT 自主修复。

## 8. Claude 明天必须先回答的问题

这些是设计输入，不是让 CH 逐个回答；Claude 应基于 Master Spec 和 repository evidence 给出推荐值，并标记真正需要 CH 的项：

1. Merchant claim/auth 的最小可上线模型是什么？
2. Story submission 的状态机和最多 pending 数量是什么？
3. AI copy assistance 使用哪个 provider、预算、语言、留痕和 fallback？
4. Media 使用哪个 Storage bucket、压缩尺寸、公开/签名 URL 和清理策略？
5. SEO 的主域名、地区 URL、语言策略和目标关键词是什么？
6. Analytics 的时区、unique visitor 定义和 Story/merchant 分离规则是什么？
7. Social distribution V1 是否明确为 manual-first？首个平台以后再接哪个？
8. 哪些 Supabase/Vercel 生产操作是 read-only，哪些允许 Claude 执行？

如果 Claude 无法从证据回答，必须输出 `CH_REQUIRED` 的精确问题，而不是让 ChatGPT 猜 secret 或生产配置。

## 9. 完成标准

一个任务只有同时满足以下条件才算完成：

- 代码符合已批准设计和现有 Decision Log；
- typecheck/lint/security 通过，或明确记录失败原因；
- 权限、RLS、body size、rate limit、重复提交和错误态已考虑；
- public/admin/mobile loading、empty、error、success UX 完整；
- SEO metadata/structured data/canonical/indexability 没有回归；
- changed files、migration、env var、Vercel/Supabase 操作有记录；
- 未把 AI 建议误当成事实、未把手动社交发布误报成已发布；
- 没有未经批准的生产破坏性操作。

## 10. 当前明确不应自动做的事

- 不提交真实平台 OAuth/token/密码到 repository 或 handoff；
- 不自动发布未经人工审核的 Story；
- 不把 AI 生成文案直接覆盖 source facts；
- 不在没有平台授权和失败策略时接 Facebook/Instagram/Xiaohongshu/Threads API；
- 不为了通过 build 擅自删除字体、SEO、RLS 或安全检查；
- 不把 anon key/service-role key 写入日志、截图或 handoff；
- 不使用猜测的 Supabase project、Vercel branch、production URL。

