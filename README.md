# 易捷加油 · 充值系统

> 品牌油卡电子代金券在线充值与订单管理后台。
> 移动优先（mobile-first）纯静态站点 + localStorage 持久化，
> 可平滑迁移到 **Supabase** + **Cloudflare Pages** 部署。

![Tech](https://img.shields.io/badge/Frontend-Vanilla%20JS-yellow) ![Style](https://img.shields.io/badge/Style-Mobile--First-blue) ![Deploy](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-orange) ![Backend](https://img.shields.io/badge/Backend-Supabase-green)

---

## ✨ 功能

### 用户端（4 步充值流程）
1. **首页** — 品牌 Logo、手机号输入、领取代金券
2. **选择金额** — 6 档代金券（200 补货中 / 300 / 400 / 500 / 1000 / 2000），全部 8.5 折
3. **扫码支付** — 微信/支付宝收款码、确认订单信息
4. **凭证与结果** — 上传付款截图、3 秒动画、失败引导联系客服

### 管理后台（9 大模块）
- 📊 **数据统计** — 今日/累计/交易额/失败率
- 📋 **订单管理** — 搜索筛选、状态管理、CSV 导出
- 📢 **公告设置** — 多段标题 + 要点列表解析器
- 🖼️ **Logo 设置** — 图片上传转 base64
- 💚 **微信二维码** — 收款码管理
- 💙 **支付宝二维码** — 收款码管理
- 💬 **在线客服链接** — URL + 按钮文案
- ⚙️ **系统设置** — 折扣率、金额面额、密码

---

## 🚀 快速开始

### 本地预览
```bash
# Python 3
python3 -m http.server 8765

# Node.js
npx serve -p 8765

# 浏览器打开
open http://localhost:8765/index.html    # 用户端
open http://localhost:8765/admin.html    # 后台（默认 admin / admin123）
```

### 默认账号
- 后台地址：`/admin.html`
- 账号：`admin`
- 密码：`admin123`

---

## 🌐 部署

### 1️⃣ GitHub 仓库
```bash
git init
git add .
git commit -m "feat: 易捷加油充值系统初始版本"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

### 2️⃣ Cloudflare Pages（前端托管）
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages**
2. 选择 **Connect to Git**，授权并选择刚才推送的 GitHub 仓库
3. 构建设置：
   - **Framework preset**：`None`
   - **Build command**：留空
   - **Build output directory**：`/`（仓库根目录）
4. 点击 **Save and Deploy**，几秒钟后获得 `*.pages.dev` 域名

#### 一键部署脚本
仓库根目录提供：
- `deploy.sh` — macOS / Linux / WSL
- `deploy.bat` — Windows CMD

```bash
# 首次推送
./deploy.sh "feat: 初始版本"

# 之后日常更新
./deploy.sh
```

#### Cloudflare 配置文件
本仓库已包含：
- `_headers` — 缓存策略与安全头
- `_redirects` — SPA 路由回退
- `wrangler.toml` — 高级配置（可选）

### 3️⃣ Supabase（后端数据库）
> 用于将 localStorage 迁移到云端数据库，实现多设备同步、订单持久化。

1. 在 [supabase.com](https://supabase.com/) 创建项目
2. 进入 **SQL Editor**，依次执行 `supabase/schema.sql` 中的所有建表语句
3. 在 **Project Settings → API** 复制 `URL` 和 `anon public key`
4. 在前端 `js/supabase.js` 中填入：

```js
const SUPABASE_URL = 'https://xxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

详见 [`supabase/README.md`](./supabase/README.md)

---

## 📁 目录结构
```
.
├── index.html              # 用户端入口
├── admin.html              # 后台入口
├── css/
│   ├── style.css          # 用户端样式（mobile-first）
│   └── admin.css          # 后台样式
├── js/
│   ├── app.js             # 用户端逻辑
│   └── admin.js           # 后台逻辑
├── supabase/
│   ├── schema.sql         # 数据库建表语句
│   └── README.md          # Supabase 集成指南
├── _headers               # Cloudflare 缓存策略
├── _redirects             # Cloudflare 路由回退
├── wrangler.toml          # Cloudflare Pages 配置
├── .gitignore
└── README.md
```

---

## 🎨 设计特点

### Mobile-First
- 容器最大宽度 **480px**
- 断点：≤320 / ≤360 / 540 / 768 / 1024
- 触摸友好：按钮 ≥ 44px

### 视觉风格
- **深蓝** `#1e3a8a → #1d4ed8 → #0891b2` 顶栏
- **金色** `#fbbf24 → #d97706` 标题 / 招商 / 选中态
- **朱红** `#b91c1c → #dc2626` CTA / 错误 / 徽章
- 文字渐变（`-webkit-background-clip: text`）烫金效果
- 径向高光（`radial-gradient`）模拟光斑

### 桌面端
- 页面以"手机模型"形式居中（420px + 圆角 + 阴影）
- 适合演示与截图

---

## 🛠 技术栈
- 纯 HTML5 / CSS3 / 原生 JavaScript（ES6+）
- 无任何前端框架依赖
- 无构建步骤
- 数据持久化：`localStorage`（默认）/ `Supabase`（可选）
- 部署：Cloudflare Pages（推荐）/ Vercel / Netlify / GitHub Pages

---

## 📋 浏览器兼容
- ✅ Chrome / Edge / Safari（最近 2 个版本）
- ✅ 移动端 Safari / Chrome
- ⚠️ IE 不支持

---

## 📄 License
MIT
