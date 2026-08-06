// =====================================================
// Supabase 数据访问层（直接使用 REST API，不依赖 SDK CDN）
// =====================================================
// 使用 fetch 直接调用 Supabase REST API，无需加载外部 SDK
// =====================================================

const SUPABASE_CONFIG = {
  url: 'https://gntjfuzhlkhnbbukjomx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdudGpmdXpobGtobmJidWtqb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MDcxMDQsImV4cCI6MjEwMTQ4MzEwNH0.R2GZNHFXJApPJ8BY2xufmbGSqWjX4SAa8k3juN_UH5w',
};

// 直接启用，不依赖 SDK
let USE_SUPABASE = true;

// 通用请求封装
async function sbFetch(path, options = {}) {
  const url = SUPABASE_CONFIG.url + '/rest/v1/' + path;
  const headers = {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': 'Bearer ' + SUPABASE_CONFIG.anonKey,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const resp = await fetch(url, { ...options, headers });
  if (resp.status === 204 || resp.status === 205) return null;
  const text = await resp.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = text; }
  }
  if (!resp.ok) {
    const errMsg = (data && (data.message || data.error || JSON.stringify(data))) || ('HTTP ' + resp.status);
    throw new Error(errMsg);
  }
  return data;
}

// =====================================================
// 数据访问层
// =====================================================

async function dbGetConfig() {
  if (!USE_SUPABASE) return null;
  try {
    const data = await sbFetch('site_config?id=eq.1&limit=1');
    return (data && data.length > 0) ? data[0] : null;
  } catch (e) { console.error('[Supabase] dbGetConfig:', e); return null; }
}

async function dbUpdateConfig(cfg) {
  if (!USE_SUPABASE) return null;
  try {
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
    const data = await sbFetch('site_config?id=eq.1', {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(dbCfg),
    });
    return (data && data.length > 0) ? data[0] : null;
  } catch (e) { console.error('[Supabase] dbUpdateConfig:', e); throw e; }
}

async function dbCreateOrder(order) {
  if (!USE_SUPABASE) return null;
  try {
    const payload = {
      id: order.id,
      phone: order.phone,
      amount: order.amount,
      actual_pay: order.actualPay,
      discount_rate: order.discountRate,
      pay_method: order.payMethod,
      status: order.status,
      voucher: order.voucher,
    };
    const data = await sbFetch('orders', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(payload),
    });
    return (data && data.length > 0) ? data[0] : null;
  } catch (e) { console.error('[Supabase] dbCreateOrder:', e); throw e; }
}

async function dbListOrders(filter = {}) {
  if (!USE_SUPABASE) return [];
  try {
    let path = 'orders?order=created_at.desc&limit=500';
    if (filter.status) path += '&status=eq.' + encodeURIComponent(filter.status);
    if (filter.search) {
      path += '&or=(id.ilike.*' + encodeURIComponent(filter.search) + '*,phone.ilike.*' + encodeURIComponent(filter.search) + '*)';
    }
    const data = await sbFetch(path);
    return data || [];
  } catch (e) { console.error('[Supabase] dbListOrders:', e); return []; }
}

async function dbUpdateOrderStatus(id, status, failReason) {
  if (!USE_SUPABASE) return null;
  try {
    const payload = { status };
    if (failReason) payload.fail_reason = failReason;
    const data = await sbFetch('orders?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(payload),
    });
    return (data && data.length > 0) ? data[0] : null;
  } catch (e) { console.error('[Supabase] dbUpdateOrderStatus:', e); throw e; }
}

async function dbGetStats() {
  if (!USE_SUPABASE) return null;
  try {
    const data = await sbFetch('v_stats?limit=1');
    return (data && data.length > 0) ? data[0] : null;
  } catch (e) { console.error('[Supabase] dbGetStats:', e); return null; }
}
