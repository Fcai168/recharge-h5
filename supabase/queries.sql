-- =====================================================
-- 易捷加油 · 常用查询示例
-- =====================================================
-- 复制到 Supabase SQL Editor 逐条运行
-- =====================================================

-- 1. 总体统计
SELECT * FROM v_stats;

-- 2. 最近 7 天订单趋势
SELECT * FROM v_daily_stats;

-- 3. 今日订单列表
SELECT id, phone, amount, actual_pay, pay_method, status, created_at
FROM orders
WHERE created_at::date = CURRENT_DATE
ORDER BY created_at DESC;

-- 4. 失败订单（需人工审核）
SELECT id, phone, amount, actual_pay, status, created_at
FROM orders
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;

-- 5. 各支付方式占比
SELECT
  pay_method,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
FROM orders
GROUP BY pay_method;

-- 6. 各金额档位热度
SELECT
  amount AS 面额,
  COUNT(*) AS 订单数,
  SUM(actual_pay) AS 总金额
FROM orders
WHERE status = 'success'
GROUP BY amount
ORDER BY amount ASC;

-- 7. 转化漏斗
SELECT
  status,
  COUNT(*) AS 数量,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS 占比
FROM orders
GROUP BY status
ORDER BY
  CASE status
    WHEN 'pending' THEN 1
    WHEN 'processing' THEN 2
    WHEN 'success' THEN 3
    WHEN 'failed' THEN 4
  END;

-- 8. 手动标记订单为成功
UPDATE orders
SET status = 'success', updated_at = NOW()
WHERE id = 'ORD20260805006';

-- 9. 手动标记订单为失败
UPDATE orders
SET status = 'failed', fail_reason = '凭证审核未通过', updated_at = NOW()
WHERE id = 'ORD20260805004';

-- 10. 删除某用户的订单（GDPR 删除请求）
DELETE FROM orders WHERE phone = '13800138003';
