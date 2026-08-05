// =====================================================
// Supabase 客户端配置（待用户填入凭据后启用）
// =====================================================
// 1. 引入 SDK（在 HTML <head>）：
//    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//
// 2. 填入 Supabase Dashboard → Project Settings → API 中的：
//    - Project URL
//    - anon public key
//
// 3. 详情见 supabase/README.md
// =====================================================

const SUPABASE_CONFIG = {
  url: 'https://gntjfuzhlkhnbbukjomx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdudGpmdXpobGtobmJidWtqb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MDcxMDQsImV4cCI6MjEwMTQ4MzEwNH0.R2GZNHFXJApPJ8BY2xufmbGSqWjX4SAa8k3juN_UH5w',
  serviceKey: '',
};

// 创建客户端
let supabase = null;
let USE_SUPABASE = false;

function initSupabase() {
  if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) return;
  if (typeof window.supabase === 'undefined') return;
  supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  USE_SUPABASE = true;
  console.log('[Supabase] 已连接:', SUPABASE_CONFIG.url);
}

// 页面加载时尝试初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupabase);
} else {
  initSupabase();
}

// =====================================================
// 数据访问层（async，未启用时返回 null）
// =====================================================

async function dbGetConfig() {
  if (!USE_SUPABASE) return null;
  try {
    const { data, error } = await supabase
      .from('site_config')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) { console.error('[Supabase] dbGetConfig:', error); return null; }
    return data;
  } catch (e) { console.error(e); return null; }
}

async function dbUpdateConfig(cfg) {
  if (!USE_SUPABASE) return null;
  try {
    // 转换字段名为 snake_case
    const dbCfg = {
      logo: cfg.logo,
      banner: cfg.banner,
      announcement: cfg.announcement,
      wechat_qr: cfg.wechatQR,
      alipay_qr: cfg.alipayQR,
      customer_service: cfg.customerService,
      customer_service_text: cfg.customerServiceText,
      discount_rate: cfg.discountRate,
      amounts: cfg.amounts,
    };
    const { data, error } = await supabase
      .from('site_config')
      .update(dbCfg)
      .eq('id', 1)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (e) { console.error('[Supabase] dbUpdateConfig:', e); throw e; }
}

async function dbCreateOrder(order) {
  if (!USE_SUPABASE) return null;
  try {
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
  } catch (e) { console.error('[Supabase] dbCreateOrder:', e); throw e; }
}

async function dbListOrders(filter = {}) {
  if (!USE_SUPABASE) return [];
  try {
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
  } catch (e) { console.error('[Supabase] dbListOrders:', e); return []; }
}

async function dbUpdateOrderStatus(id, status, failReason) {
  if (!USE_SUPABASE) return null;
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, fail_reason: failReason })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (e) { console.error('[Supabase] dbUpdateOrderStatus:', e); throw e; }
}

async function dbGetStats() {
  if (!USE_SUPABASE) return null;
  try {
    const { data, error } = await supabase.from('v_stats').select('*').single();
    if (error) throw error;
    return data;
  } catch (e) { console.error('[Supabase] dbGetStats:', e); return null; }
}
