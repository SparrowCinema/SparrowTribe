# 拍照识票 AI 增强部署指南（Google AI Studio + Supabase Edge Function）

本文档说明如何将麻雀观影护照的「AI 识票」功能接入 Google AI Studio（Gemini API）。

## 架构说明

- **网页端**（`js/tickets.js`）：保留原有本机离线 Tesseract.js（`拍照识票`，图片不出手机）作为默认；点击「AI 识票」或「用 AI 重新识别」时，将缩放后的 JPEG 发送到现有 Supabase 项目的 Edge Function `ticket-ai`。
- **微信小程序**（`miniprogram/packages/collect/ticket-edit/` + `cloudfunctions/ticketOcr`）：保留微信官方 `ocr.printedText`（`拍照识票`）；点击「AI 识票」时，由 `ticketOcr` 云函数携带 `mode: 'ai'` 转发给同一个 Supabase Edge Function `ticket-ai`，无需在微信后台配置 Google 域名。
- **自动回退**：在未部署 `ticket-ai`、未配置 `GEMINI_API_KEY`、请求限流或网络超时时，网页端自动回退本机离线识票，小程序自动回退微信识字，不会中断用户流程。
- **隐私与成本保护**：图片仅在 Edge Function 内存中转发给 Gemini，不写入数据库或对象存储、不记录日志；Edge Function 内置来源白名单（CORS）、单图 2 MB 上限、固定结构化提取任务与每 IP 滑动窗口限流。

---

## 第一步：在 Google AI Studio 创建 API Key

1. 访问 [Google AI Studio](https://aistudio.google.com/) 并登录 Google 账号。
2. 点击右上角或左侧菜单的 **Get API key → Create API key**，生成一把 Gemini API Key。
3. 建议在对应 Google Cloud 项目中设置**预算提醒 / 每日配额上限**，防止异常流量产生超额费用。
4. 默认模型为 `gemini-2.5-flash`（支持多模态图文与 JSON Schema 输出，速度快且单次识票成本极低）。

---

## 第二步：部署 Supabase Edge Function（`ticket-ai`）

函数代码位于 [`backend/supabase/functions/ticket-ai/index.ts`](../backend/supabase/functions/ticket-ai/index.ts)。

### 方式 A：使用 Supabase CLI（推荐）

```bash
# 1. 登录并关联现有项目
supabase login
supabase link --project-ref dclxhxxjktegyiwafmsv

# 2. 写入 Gemini API Key（仅存放在 Supabase 服务端 Secrets，切勿提交到 Git）
supabase secrets set GEMINI_API_KEY="你的_GEMINI_API_KEY"

# 可选：自定义模型或限流参数（不设则使用默认值）
# supabase secrets set GEMINI_MODEL="gemini-2.5-flash"
# supabase secrets set AI_RATE_LIMIT="12"
# supabase secrets set AI_RATE_WINDOW_MS="600000"

# 3. 部署 Edge Function（允许使用项目公开 publishable key 调用）
supabase functions deploy ticket-ai --workdir backend --no-verify-jwt
```

### 方式 B：在 Supabase 网页后台直接部署

1. 打开 Supabase 控制台 → 选中项目 `dclxhxxjktegyiwafmsv`。
2. 进入 **Edge Functions → Secrets**，新增 `GEMINI_API_KEY` 并填入第一步拿到的 Key。
3. 进入 **Edge Functions → Deploy a new function**，函数名填写 `ticket-ai`，把 `backend/supabase/functions/ticket-ai/index.ts` 的内容完整粘贴进去。
4. 在函数设置中关闭 **Verify JWT**（与现有公开 `publishable` key 调用方式一致），点击 **Deploy**。

---

## 第三步：验证接口是否生效

> 当前项目在线上通过网页编辑器部署的函数显示名为 `ticket-ai`，实际 endpoint slug 为 `smooth-processor`（网页端与小程序云函数均指向 `/functions/v1/smooth-processor`）。

用一张测试票根图片转为 base64 后验证（或直接在本地/线上页面点击「AI 识票」）：

```bash
IMG_B64=$(base64 -w 0 your-ticket.jpg)
curl -X POST "https://dclxhxxjktegyiwafmsv.supabase.co/functions/v1/smooth-processor" \
  -H "Content-Type: application/json" \
  -H "apikey: sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2" \
  -H "Authorization: Bearer sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2" \
  -d "{\"action\":\"ticket_ocr\",\"contentType\":\"image/jpeg\",\"imageBase64\":\"$IMG_B64\"}"
```

正常返回示例：

```json
{
  "ok": true,
  "fields": {
    "date": "2026-11-28",
    "time": "19:30",
    "venue": "杭州百美汇影城",
    "hall": "3号杜比全景声厅",
    "seat": "5排8座",
    "format": "4K修复"
  },
  "raw": "...",
  "model": "gemini-2.5-flash"
}
```

---

## 第四步：同步微信小程序

1. 在微信开发者工具中右键 `cloudfunctions/ticketOcr`，选择 **上传并部署：云端安装依赖**。
2. 票根编辑页（`miniprogram/packages/collect/ticket-edit/`）已同步新增「AI 识票」按钮与失败回退提示；发版前按常规流程上传体验版/提交审核即可生效。
