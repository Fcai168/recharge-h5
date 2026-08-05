-- =====================================================
-- 易捷加油 · 订单测试数据
-- =====================================================
-- 仅用于开发测试，生产环境不要执行！
-- =====================================================

-- 清理旧测试数据
DELETE FROM orders WHERE phone LIKE '1380013%';

-- 插入测试订单
INSERT INTO orders (id, phone, amount, actual_pay, discount_rate, pay_method, status, created_at) VALUES
  ('ORD20260805001', '13800138001', 1000, 850, 0.85, 'wechat', 'success', NOW() - INTERVAL '1 day'),
  ('ORD20260805002', '13800138002', 500, 425, 0.85, 'alipay', 'success', NOW() - INTERVAL '1 day'),
  ('ORD20260805003', '13800138003', 2000, 1700, 0.85, 'wechat', 'failed', NOW() - INTERVAL '12 hours'),
  ('ORD20260805004', '13800138004', 500, 425, 0.85, 'wechat', 'processing', NOW() - INTERVAL '2 hours'),
  ('ORD20260805005', '13800138005', 1000, 850, 0.85, 'alipay', 'success', NOW() - INTERVAL '30 minutes'),
  ('ORD20260805006', '13800138006', 300, 255, 0.85, 'wechat', 'pending', NOW() - INTERVAL '5 minutes'),
  ('ORD20260805007', '13800138007', 400, 340, 0.85, 'alipay', 'success', NOW()),
  ('ORD20260805008', '13800138008', 2000, 1700, 0.85, 'wechat', 'failed', NOW() - INTERVAL '3 hours');

-- 验证
SELECT
  status,
  COUNT(*) AS count,
  SUM(actual_pay) AS total
FROM orders
GROUP BY status
ORDER BY status;
