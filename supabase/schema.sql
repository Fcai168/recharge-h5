-- =====================================================
-- 易捷加油 · Supabase 数据库 · 完整 Schema
-- =====================================================
-- 在 Supabase Dashboard → SQL Editor → New query 执行
-- =====================================================

-- =====================================================
-- 1. 清理（如果重新执行）
-- =====================================================
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS site_config CASCADE;
DROP VIEW IF EXISTS v_stats CASCADE;
DROP VIEW IF EXISTS v_today_stats CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- =====================================================
-- 2. 站点配置表（单行）
-- =====================================================
CREATE TABLE site_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  logo TEXT,
  banner TEXT,
  announcement TEXT,
  wechat_qr TEXT,
  alipay_qr TEXT,
  customer_service TEXT,
  customer_service_text TEXT DEFAULT '联系在线客服',
  discount_rate NUMERIC(4,2) DEFAULT 0.85 CHECK (discount_rate BETWEEN 0.1 AND 1),
  amounts JSONB DEFAULT '[
    {"value": 200, "available": false, "restocking": true},
    {"value": 300, "available": true},
    {"value": 400, "available": true},
    {"value": 500, "available": true},
    {"value": 1000, "available": true},
    {"value": 2000, "available": true}
  ]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_config (id) VALUES (1);

-- =====================================================
-- 3. 订单表
-- =====================================================
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  actual_pay NUMERIC(10,2) NOT NULL CHECK (actual_pay >= 0),
  discount_rate NUMERIC(4,2) DEFAULT 0.85,
  pay_method TEXT NOT NULL CHECK (pay_method IN ('wechat', 'alipay')),
  status TEXT NOT NULL DEFAULT 'pending'
       CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  voucher TEXT,
  fail_reason TEXT,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_phone ON orders(phone);
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);

-- =====================================================
-- 4. 触发器：自动更新 updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_site_config_updated_at
  BEFORE UPDATE ON site_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- 5. 统计视图
-- =====================================================
-- 总体统计
CREATE OR REPLACE VIEW v_stats AS
SELECT
  (SELECT COUNT(*) FROM orders WHERE created_at::date = CURRENT_DATE) AS today_orders,
  (SELECT COUNT(*) FROM orders
     WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS month_orders,
  (SELECT COUNT(*) FROM orders) AS total_orders,
  (SELECT COALESCE(SUM(actual_pay), 0) FROM orders WHERE status = 'success') AS total_amount,
  (SELECT COUNT(*) FROM orders WHERE status = 'success') AS success_orders,
  (SELECT COUNT(*) FROM orders WHERE status = 'failed') AS failed_orders,
  (SELECT COUNT(*) FROM orders WHERE status = 'processing') AS processing_orders,
  (SELECT
     CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(
            (COUNT(*) FILTER (WHERE status = 'failed')::numeric / COUNT(*)) * 100,
            1
          )
     END
   FROM orders) AS fail_rate_pct;

-- 最近 7 天每日统计
CREATE OR REPLACE VIEW v_daily_stats AS
SELECT
  d::date AS date,
  COALESCE(COUNT(o.id), 0) AS order_count,
  COALESCE(SUM(o.actual_pay) FILTER (WHERE o.status = 'success'), 0) AS amount
FROM generate_series(
  CURRENT_DATE - INTERVAL '6 days',
  CURRENT_DATE,
  '1 day'::interval
) d
LEFT JOIN orders o ON o.created_at::date = d
GROUP BY d
ORDER BY d ASC;

-- =====================================================
-- 6. 行级安全（RLS）
-- =====================================================
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- site_config：所有人可读，anon key 不可写
DROP POLICY IF EXISTS "public read site_config" ON site_config;
CREATE POLICY "public read site_config" ON site_config
  FOR SELECT USING (true);

-- orders：所有人可创建订单（无需登录）
DROP POLICY IF EXISTS "public insert orders" ON orders;
CREATE POLICY "public insert orders" ON orders
  FOR INSERT WITH CHECK (true);

-- orders：所有人可读（生产环境应限制为按 phone 读自己的）
DROP POLICY IF EXISTS "public read orders" ON orders;
CREATE POLICY "public read orders" ON orders
  FOR SELECT USING (true);

-- 注意：更新/删除只能通过 service_role key（后台管理用）

-- =====================================================
-- 7. 管理员认证（Supabase Auth）
-- =====================================================
-- 推荐在 Supabase Dashboard → Authentication → Users → Add user
-- 手动创建管理员账号（如 admin@yourdomain.com）
--
-- 前端用 supabase.auth.signInWithPassword() 登录
-- 后台管理用 service_role key 绕过 RLS

-- =====================================================
-- 8. 辅助函数
-- =====================================================

-- 生成订单号
CREATE OR REPLACE FUNCTION generate_order_id()
RETURNS TEXT AS $$
DECLARE
  ts TEXT;
  rand TEXT;
BEGIN
  ts := TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');
  rand := LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
  RETURN 'ORD' || ts || rand;
END;
$$ LANGUAGE plpgsql;

-- 公开 site_config 的安全视图（隐藏敏感字段如有）
CREATE OR REPLACE VIEW v_site_config_public AS
SELECT
  id, logo, banner, announcement,
  wechat_qr, alipay_qr,
  customer_service, customer_service_text,
  discount_rate, amounts,
  updated_at
FROM site_config;

-- =====================================================
-- 9. Storage（可选 - 图片存到 Supabase Storage）
-- =====================================================
-- 在 Dashboard → Storage 手动创建 bucket：
--   - site-assets（公开读 / 仅 service_role 写）
--   - vouchers（私有 / 仅 service_role 读）
--
-- 创建后，前端可用：
--   const { data } = await supabase.storage
--     .from('site-assets')
--     .getPublicUrl('logo.png');

-- =====================================================
-- 完成！
-- =====================================================
-- 验证：
--   SELECT * FROM site_config;
--   SELECT * FROM v_stats;
-- =====================================================
