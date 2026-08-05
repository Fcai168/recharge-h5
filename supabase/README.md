# Supabase 集成指南

## 📦 第一步：创建 Supabase 项目

1. 访问 [supabase.com](https://supabase.com/)，注册并新建项目
2. 选择区域（推荐香港 `ap-southeast-1` 或新加坡 `ap-southeast-2`）
3. 等待项目启动（约 2 分钟）

## 🗃 第二步：初始化数据库

1. 进入项目 Dashboard → 左侧菜单 **SQL Editor**
2. 点击 **New query**
3. 复制 [`schema.sql`](./schema.sql) 的全部内容，粘贴到编辑器
4. 点击 **Run** 执行（应显示 "Success. No rows returned"）
5. 验证：左侧菜单 **Table Editor** 应能看到 `site_config` 和 `orders` 两张表

## 🔑 第三步：获取 API 凭据

Dashboard → **Project Settings** → **API**：

| 项 | 用途 | 填到前端哪里 |
|---|---|---|
| **Project URL** | 公共 URL | `js/supabase.js` 的 `SUPABASE_URL` |
| **anon public key** | 公开读 + 创建订单 | `js/supabase.js` 的 `SUPABASE_ANON_KEY` |
| **service_role key** | 后台管理（保密） | 仅在 Cloudflare 环境变量中，**绝不**暴露给前端 |

## 👤 第四步：创建管理员账号

Dashboard → **Authentication** → **Users** → **Add user** → **Create new user**：

- Email: `admin@yourdomain.com`
- Password: 自定义强密码
- ✅ Auto Confirm User

## 💻 第五步：前端集成

### 5.1 引入 Supabase JS SDK

在 `index.html` 和 `admin.html` 的 `<head>` 中添加：

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### 5.2 创建 `js/supabase.js`

```js
// =====================================================
// Supabase 客户端配置
// =====================================================

const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';  // 替换
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';               // 替换

// 创建客户端
let supabase = null;
if (SUPABASE_URL !== 'https://YOUR_PROJECT.supabase.co') {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// 检测是否启用 Supabase
const USE_SUPABASE = supabase !== null;

// =====================================================
// 数据访问层
// =====================================================

// 读取配置
async function dbGetConfig() {
  if (!USE_SUPABASE) return null;
  const { data, error } = await supabase
    .from('site_config')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) { console.error(error); return null; }
  return data;
}

// 更新配置（仅后台 + service_role）
async function dbUpdateConfig(cfg) {
  if (!USE_SUPABASE) return null;
  const { data, error } = await supabase
    .from('site_config')
    .update(cfg)
    .eq('id', 1)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 创建订单
async function dbCreateOrder(order) {
  if (!USE_SUPABASE) return null;
  const { data, error } = await supabase
    .from('orders')
    .insert({
      id: order.id,
      phone: order.phone,
      amount: order.amount,
      actual_pay: order.actualPay,
      discount_rate: order.discountRate,
      pay_method: order.payMethod,
      status: order.status,
      voucher: order.voucher,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 查询订单列表
async function dbListOrders(filter = {}) {
  if (!USE_SUPABASE) return [];
  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.search) {
    query = query.or(`id.ilike.%${filter.search}%,phone.ilike.%${filter.search}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// 更新订单状态
async function dbUpdateOrderStatus(id, status, failReason) {
  if (!USE_SUPABASE) return null;
  const { data, error } = await supabase
    .from('orders')
    .update({ status, fail_reason: failReason })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 统计数据
async function dbGetStats() {
  if (!USE_SUPABASE) return null;
  const { data, error } = await supabase.from('v_stats').select('*').single();
  if (error) throw error;
  return data;
}
```

### 5.3 改造现有代码

把现有 `js/app.js` 和 `js/admin.js` 中的 `localStorage` 调用替换为 `dbGetConfig` / `dbUpdateConfig` / `dbCreateOrder` / `dbListOrders` 等。

简单包装示例：

```js
// 读取配置：优先 Supabase，回退 localStorage
async function getConfig() {
  const remote = await dbGetConfig();
  if (remote) return remote;
  // localStorage 逻辑保留作为离线 fallback
  return localStorageConfig();
}

// 保存配置：优先 Supabase
async function saveConfig(cfg) {
  await dbUpdateConfig(cfg);
  // 同时保留 localStorage 备份
  localStorage.setItem('oilcard_config', JSON.stringify(cfg));
}
```

## 🔐 第六步：后台认证（可选）

用 Supabase Auth 替换当前的 `admin / admin123` 硬编码：

```js
// 登录
async function doLogin() {
  const email = $('loginUser').value;
  const password = $('loginPass').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { toast('登录失败：' + error.message, 'error'); return; }
  // 登录成功，存储 session
  localStorage.setItem('sb_token', data.session.access_token);
  $('mainLayout').classList.add('active');
  initAdmin();
}

// 退出
async function doLogout() {
  await supabase.auth.signOut();
  localStorage.removeItem('sb_token');
  $('mainLayout').classList.remove('active');
}

// 自动恢复登录
const { data: { session } } = await supabase.auth.getSession();
if (session) initAdmin();
```

## 🚀 第七步：部署到 Cloudflare Pages

详见根目录 [README.md](../README.md) 的「部署」章节。

推荐把 Supabase 凭据放到 Cloudflare Pages 的 **Environment variables** 中（不暴露在前端代码里）：

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

然后用 Cloudflare Pages Functions（`functions/api/config.js`）代理返回：

```js
// functions/api/config.js
export async function onRequestGet() {
  return new Response(JSON.stringify({
    url: globalThis.SUPABASE_URL,
    key: globalThis.SUPABASE_ANON_KEY,
  }), { headers: { 'Content-Type': 'application/json' } });
}
```

前端改为 `fetch('/api/config')` 获取，比直接硬编码在前端更安全。

## ⚠️ 注意事项

1. **anon key 可以公开** — Supabase 设计的 RLS 策略会保护数据
2. **service_role 绝对保密** — 它绕过 RLS，能做任何事
3. **图片存储** — 大尺寸 base64 会膨胀数据库，建议用 Supabase Storage 替代
4. **行级安全** — 当前策略允许所有人读所有订单，生产环境应限制为"按手机号读自己的"
5. **免费额度** — Supabase 免费层 500MB 数据库 + 1GB 存储 + 5GB 流量，足够中小项目使用

## 📚 参考

- [Supabase JS 文档](https://supabase.com/docs/reference/javascript)
- [Supabase + Cloudflare Pages 部署](https://supabase.com/docs/guides/getting-started/tutorials/with-cloudflare-workers)
- [RLS 策略](https://supabase.com/docs/guides/auth/row-level-security)
