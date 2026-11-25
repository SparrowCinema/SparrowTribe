# 麻雀观影护照 AI 能力部署指南（Google AI Studio + Supabase Edge Function）

本文档说明如何将麻雀观影护照的「AI 识票」与「AI 观影画像 / 评语」接入 Google AI Studio（Gemini API）。两个功能共用同一个 Supabase Edge Function（显示名 `ticket-ai`，线上 slug `smooth-processor`），通过白名单 `action` 区分：

- `ticket_ocr`：典藏票根编辑页「AI 识票」（纸质票 / 电子票截图结构化识别）
- `taste_portrait`：趣味图谱页「AI 观影画像」（基于看过清单、星级与四象限摘要生成 200–300 字评语，前端按指纹本机缓存）

## 架构说明

- **网页端**：
  - `js/tickets.js`：保留本机离线 Tesseract.js（`拍照识票`，图片不出手机）作为默认；点「AI 识票」或「用 AI 重新识别」时调用 `/functions/v1/smooth-processor`（`action: 'ticket_ocr'`），不可用时自动回退离线识票。
  - `js/my.js` + `shared/taste-portrait.js`：在「我的电影趣味图谱」（`#taste-map`）提供「AI 观影画像」，调用同一接口（`action: 'taste_portrait'`），结果按片单指纹缓存在本机 `sparrow-ai-portrait-v1`，记录未变动时不重复请求。
- **微信小程序**：
  - `cloudfunctions/ticketOcr`：转发 `ticket_ocr`，不可用时自动回退微信官方 `ocr.printedText`。
  - `cloudfunctions/taste`：新增 `action: 'portrait'` 转发 `taste_portrait`，小程序分包 `packages/collect/taste-map` 使用本机 `sk-ai-portrait-v1` 缓存。
- **隐私与成本保护**：图片与片单摘要仅在 Edge Function 内存中转发给 Gemini，不落盘、不存库、不打日志；Edge Function 内置来源白名单（CORS）、单图 2 MB / 摘要 18 KB 上限、固定任务白名单与每 IP 滑动窗口限流。

---

## 第一步：在 Google AI Studio 创建 API Key

1. 访问 [Google AI Studio](https://aistudio.google.com/) 并登录 Google 账号。
2. 点击 **API 密钥 → 创建 API 密钥**，生成一把 Gemini API Key。
3. 建议在对应结算账户中设置**月度支出上限（Spend Cap）**，防止异常流量产生超额费用。
4. 默认模型为 `gemini-3.5-flash-lite`（识票保持默认 `minimal` 极速模式；观影画像启用轻量 `low` 思考模式 + 全量深度统计信号，提升影评专栏风洞察力，单次仍约 1–2 分钱）。

---

## 第二步：部署 / 更新 Supabase Edge Function

函数代码位于 [`backend/supabase/functions/ticket-ai/index.ts`](../backend/supabase/functions/ticket-ai/index.ts)。

### 方式 A：在 Supabase 网页后台更新（推荐，零安装）

1. 打开 Supabase 控制台 → 选中项目 `dclxhxxjktegyiwafmsv`。
2. 确认 **Edge Functions → Secrets** 中已保存 `GEMINI_API_KEY`（可选设 `GEMINI_MODEL=gemini-3.5-flash-lite`）。
3. 进入 **Edge Functions**，点进已有的 `ticket-ai`（URL 为 `/functions/v1/smooth-processor`）→ **Code** 标签页，把 `backend/supabase/functions/ticket-ai/index.ts` 的内容完整粘贴替换 → 点 **Deploy updates**。
4. 确认 **Details** 中的 **Verify JWT with legacy secret** 保持关闭状态。

### 方式 B：使用 Supabase CLI

```bash
supabase login
supabase link --project-ref dclxhxxjktegyiwafmsv
supabase secrets set GEMINI_API_KEY="你的_GEMINI_API_KEY"
supabase functions deploy smooth-processor --workdir backend --no-verify-jwt
```

---

## 第三步：验证接口是否生效

### 验证 `taste_portrait`（AI 观影画像）

```bash
curl -X POST "https://dclxhxxjktegyiwafmsv.supabase.co/functions/v1/smooth-processor" \
  -H "Content-Type: application/json" \
  -H "Origin: https://sparrowcinema.org" \
  -H "apikey: sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2" \
  -H "Authorization: Bearer sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2" \
  -d '{"action":"taste_portrait","lang":"zh","scope":"全部观影","watchedCount":3,"topFilms":[{"t":"花样年华","y":"2000","r":10,"fun":4.5,"bore":1},{"t":"潜行者","y":"1979","r":9,"fun":4,"bore":4},{"t":"小城之春","y":"1948","r":8,"fun":3.5,"bore":2}]}'
```

### 验证 `ticket_ocr`（AI 识票）

```bash
IMG_B64=$(base64 -w 0 your-ticket.jpg)
curl -X POST "https://dclxhxxjktegyiwafmsv.supabase.co/functions/v1/smooth-processor" \
  -H "Content-Type: application/json" \
  -H "Origin: https://sparrowcinema.org" \
  -H "apikey: sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2" \
  -H "Authorization: Bearer sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2" \
  -d "{\"action\":\"ticket_ocr\",\"contentType\":\"image/jpeg\",\"imageBase64\":\"$IMG_B64\"}"
```

---

## 第四步：同步微信小程序

1. 在微信开发者工具中右键 `cloudfunctions/ticketOcr` 与 `cloudfunctions/taste`，分别选择 **上传并部署：云端安装依赖**。
2. 票根编辑页（`packages/collect/ticket-edit`）与趣味图谱页（`packages/collect/taste-map`）已同步更新，按常规流程上传体验版 / 提交审核即可生效。
