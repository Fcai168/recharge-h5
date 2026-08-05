-- =====================================================
-- RLS UPDATE 策略 — 允许后台管理写入
-- =====================================================
-- 在 Supabase Dashboard → SQL Editor → New query 执行
-- 作用：允许 anon key 更新 site_config 和 orders 表
-- （后台管理面板保存配置、修改订单状态需要）
--
-- ⚠️ 安全提示：此策略允许任何人通过 anon key 更新数据。
--    生产环境建议改用 Supabase Auth 登录后才能更新。
--    当前适用于快速部署，后续可收紧为 authenticated 角色。
-- =====================================================

-- site_config：允许更新（保存公告/二维码/客服链接等配置）
DROP POLICY IF EXISTS "public update site_config" ON site_config;
CREATE POLICY "public update site_config" ON site_config
  FOR UPDATE USING (true);

-- orders：允许更新（修改订单状态：标记成功/失败）
DROP POLICY IF EXISTS "public update orders" ON orders;
CREATE POLICY "public update orders" ON orders
  FOR UPDATE USING (true);

-- 验证
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';
