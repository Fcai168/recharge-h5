// =====================================================
// 易捷加油 - 后台管理逻辑
// =====================================================

const STORAGE_KEY_CONFIG = 'oilcard_config';
const STORAGE_KEY_ORDERS = 'oilcard_orders';
const STORAGE_KEY_AUTH = 'oilcard_admin_auth';
const STORAGE_KEY_ADMIN_PASS = 'oilcard_admin_password';

const DEFAULT_CONFIG = {
  logo: '',
  banner: '',
  announcement: `易捷电子加油券使用说明

· 充值手机号须为本人实名号，且与易捷注册号一致；未实名用户到账后需先完成实名。
· 须用本人实名手机号注册易捷账户并开通中石化钱包（192号段及虚拟号不可注册）。
· 到账后不可退换。

使用规则

· 范围：全国中石化自营加油站，仅限汽油，不适用柴油/其他商品。
· 限制：不可提现、退款、找零、叠加，不开发票；过期作废不补。
· 数量：每月每种面值上限4张，合计最多16张。
· 金额：订单金额须≥券面金额，若不足则按券面全额核销，差额不退。
· 方式：需在"易捷加油"APP手动选择使用，不支持自动核销。
· 有效期：180天，逾期作废。`,
  wechatQR: '',
  alipayQR: '',
  customerService: '',
  customerServiceText: '联系在线客服',
  discountRate: 0.85,
  amounts: [
    { value: 200, available: false, restocking: true },
    { value: 300, available: true },
    { value: 400, available: true },
    { value: 500, available: true },
    { value: 1000, available: true },
    { value: 2000, available: true }
  ]
};

// Supabase 远程数据缓存
let _remoteConfig = null;
let _remoteOrders = null;

// Supabase 数据库配置（snake_case）→ 前端配置（camelCase）
function dbConfigToJsConfig(db) {
  return {
    logo: db.logo || '',
    banner: db.banner || '',
    announcement: db.announcement || DEFAULT_CONFIG.announcement,
    wechatQR: db.wechat_qr || '',
    alipayQR: db.alipay_qr || '',
    customerService: db.customer_service || '',
    customerServiceText: db.customer_service_text || '联系在线客服',
    discountRate: db.discount_rate || 0.85,
    amounts: db.amounts || JSON.parse(JSON.stringify(DEFAULT_CONFIG.amounts))
  };
}

// 从 Supabase 加载远程配置和订单
async function loadRemoteData() {
  if (typeof USE_SUPABASE === 'undefined' || !USE_SUPABASE) return;
  try {
    const dbCfg = await dbGetConfig();
    if (dbCfg) _remoteConfig = dbConfigToJsConfig(dbCfg);
  } catch (e) { console.error('[Supabase] 配置加载失败:', e); }
  try {
    const dbOrders = await dbListOrders();
    _remoteOrders = dbOrders.map(o => ({
      id: o.id,
      phone: o.phone,
      amount: o.amount,
      actualPay: o.actual_pay,
      discountRate: o.discount_rate,
      payMethod: o.pay_method,
      status: o.status,
      voucher: o.voucher,
      createdAt: o.created_at,
      updatedAt: o.updated_at
    }));
  } catch (e) { console.error('[Supabase] 订单加载失败:', e); }
}

// ---------- 工具 ----------
function $(id) { return document.getElementById(id); }
function toast(msg, type) {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => el.classList.remove('show'), 2000);
}
function getConfig() {
  if (_remoteConfig) {
    return { ...DEFAULT_CONFIG, ..._remoteConfig, amounts: _remoteConfig.amounts || JSON.parse(JSON.stringify(DEFAULT_CONFIG.amounts)) };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return { ...DEFAULT_CONFIG, amounts: JSON.parse(JSON.stringify(DEFAULT_CONFIG.amounts)) };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed, amounts: parsed.amounts || JSON.parse(JSON.stringify(DEFAULT_CONFIG.amounts)) };
  } catch (e) {
    return { ...DEFAULT_CONFIG, amounts: JSON.parse(JSON.stringify(DEFAULT_CONFIG.amounts)) };
  }
}
function setConfig(cfg) {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
}
function getOrders() {
  if (_remoteOrders) return _remoteOrders;
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_ORDERS) || '[]'); }
  catch (e) { return []; }
}
function setOrders(orders) {
  localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
}
function getAdminPass() {
  return localStorage.getItem(STORAGE_KEY_ADMIN_PASS) || 'admin123';
}

// ---------- 登录 ----------
function doLogin() {
  const u = $('loginUser').value.trim();
  const p = $('loginPass').value;
  if (u === 'admin' && p === getAdminPass()) {
    localStorage.setItem(STORAGE_KEY_AUTH, '1');
    $('loginWrap').style.display = 'none';
    $('mainLayout').classList.add('active');
    $('userName').textContent = u;
    initAdmin();
  } else {
    toast('账号或密码错误', 'error');
  }
}
function doLogout() {
  localStorage.removeItem(STORAGE_KEY_AUTH);
  $('mainLayout').classList.remove('active');
  $('loginWrap').style.display = 'flex';
}

// 回车登录
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && $('loginWrap').style.display !== 'none') {
    doLogin();
  }
});

function checkAuth() {
  if (localStorage.getItem(STORAGE_KEY_AUTH) === '1') {
    $('loginWrap').style.display = 'none';
    $('mainLayout').classList.add('active');
    initAdmin();
  }
}

// ---------- 页面切换 ----------
const pageTitles = {
  dashboard: '数据 / 数据统计',
  orders: '数据 / 订单管理',
  announcement: '系统 / 公告设置',
  logo: '系统 / Logo 设置',
  banner: '系统 / Banner 设置',
  wechat: '系统 / 微信二维码',
  alipay: '系统 / 支付宝二维码',
  service: '系统 / 客服链接',
  system: '系统 / 系统设置'
};

function switchPage(name, el) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const target = $('page-' + name);
  if (target) target.style.display = 'block';
  document.querySelectorAll('.sidebar .menu-item').forEach(m => m.classList.remove('active'));
  if (el) el.classList.add('active');
  $('crumb').innerHTML = pageTitles[name] || name;
  // 刷新数据
  if (name === 'dashboard') renderDashboard();
  if (name === 'orders') renderOrders();
  if (name === 'system') renderSystemPage();
  if (name === 'announcement' || name === 'logo' || name === 'banner' || name === 'wechat' || name === 'alipay' || name === 'service') {
    loadConfigToForm();
  }
}

// ---------- 初始化 ----------
async function initAdmin() {
  await loadRemoteData();
  loadConfigToForm();
  renderDashboard();
  renderOrders();
}

function loadConfigToForm() {
  const cfg = getConfig();
  $('cfgAnnouncement').value = cfg.announcement || '';
  $('cfgServiceUrl').value = cfg.customerService || '';
  $('cfgServiceText').value = cfg.customerServiceText || '联系在线客服';
  $('cfgDiscount').value = cfg.discountRate || 0.85;
  $('cfgAdminPass').value = getAdminPass();

  setImagePreview('logo', cfg.logo);
  setImagePreview('banner', cfg.banner);
  setImagePreview('wechat', cfg.wechatQR);
  setImagePreview('alipay', cfg.alipayQR);

  // 公告预览
  if ($('announcementPreview')) {
    previewAnnouncement();
  }
}

// ---------- 公告预览 ----------
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}
function parseAnnouncement(text) {
  const lines = String(text || '').split('\n').map(l => l.trim());
  const result = { title: '', sections: [] };
  let i = 0;
  while (i < lines.length && !lines[i]) i++;
  if (i >= lines.length) return result;
  result.title = lines[i];
  i++;
  let current = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (line.startsWith('·') || line.startsWith('•') || line.startsWith('-')) {
      if (!current) current = { title: '', items: [] };
      current.items.push(line.replace(/^[·•\-]\s*/, ''));
    } else {
      if (current && (current.title || current.items.length)) result.sections.push(current);
      current = { title: line, items: [] };
    }
  }
  if (current && (current.title || current.items.length)) result.sections.push(current);
  return result;
}
function renderAnnouncementHTML(text) {
  const p = parseAnnouncement(text);
  let html = '';
  if (p.title) html += `<h3>${escapeHtml(p.title)}</h3>`;
  p.sections.forEach(sec => {
    if (sec.title) html += `<h4>${escapeHtml(sec.title)}</h4>`;
    if (sec.items.length) {
      html += '<ul>';
      sec.items.forEach(it => { html += `<li>${escapeHtml(it)}</li>`; });
      html += '</ul>';
    }
  });
  return html;
}
function previewAnnouncement() {
  const el = $('announcementPreview');
  if (!el) return;
  const text = $('cfgAnnouncement').value;
  el.innerHTML = renderAnnouncementHTML(text);
}

function setImagePreview(type, src) {
  const el = $(type + 'Preview');
  if (!el) return;
  if (src) {
    el.innerHTML = `<img src="${src}" alt="">`;
  } else {
    el.innerHTML = `<div class="placeholder">暂无图片</div>`;
  }
}

// ---------- 图片预览 ----------
function previewLogo(e) { handleImagePreview(e, 'logo'); }
function previewBanner(e) { handleImagePreview(e, 'banner'); }
function previewWechat(e) { handleImagePreview(e, 'wechat'); }
function previewAlipay(e) { handleImagePreview(e, 'alipay'); }

function handleImagePreview(e, type) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast('图片不能超过 2MB', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    setImagePreview(type, ev.target.result);
    window['_pending_' + type] = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function clearImage(type) {
  setImagePreview(type, '');
  window['_pending_' + type] = '';
  const fileInput = $(type + 'File');
  if (fileInput) fileInput.value = '';
}

// ---------- 保存配置 ----------
function saveConfig() {
  const cfg = getConfig();

  // 文本配置
  cfg.announcement = $('cfgAnnouncement').value.trim() || DEFAULT_CONFIG.announcement;
  cfg.customerService = $('cfgServiceUrl').value.trim();
  cfg.customerServiceText = $('cfgServiceText').value.trim() || '联系在线客服';

  const dr = parseFloat($('cfgDiscount').value);
  cfg.discountRate = isNaN(dr) ? 0.85 : Math.max(0.1, Math.min(1, dr));

  // 图片
  ['logo', 'banner', 'wechat', 'alipay'].forEach(type => {
    const key = type === 'wechat' ? 'wechatQR' : (type === 'alipay' ? 'alipayQR' : type);
    if (window['_pending_' + type] !== undefined) {
      cfg[key] = window['_pending_' + type];
      delete window['_pending_' + type];
    }
  });

  // 金额配置
  if ($('amountsList').children.length > 0) {
    const amounts = [];
    $('amountsList').querySelectorAll('.amount-item').forEach(item => {
      const v = parseInt(item.querySelector('.amt-value').value);
      const pEl = item.querySelector('.amt-price-input');
      const p = pEl ? parseFloat(pEl.value) : 0;
      const avail = item.querySelector('.amt-avail').checked;
      if (v > 0) {
        const entry = { value: v, available: avail, restocking: !avail };
        if (p > 0) entry.price = p;
        amounts.push(entry);
      }
    });
    if (amounts.length > 0) cfg.amounts = amounts;
  }

  // 管理员密码
  const newPass = $('cfgAdminPass').value.trim();
  if (newPass && newPass.length >= 6) {
    localStorage.setItem(STORAGE_KEY_ADMIN_PASS, newPass);
  } else if (newPass && newPass.length < 6) {
    toast('密码至少 6 位', 'error');
    return;
  }

  setConfig(cfg);
  _remoteConfig = cfg;
  // 同步到 Supabase 数据库（全局生效，所有用户可见）
  if (typeof USE_SUPABASE !== 'undefined' && USE_SUPABASE) {
    dbUpdateConfig(cfg).then(() => {
      toast('设置已保存到数据库', 'success');
    }).catch(err => {
      console.error('[Supabase] 配置同步失败:', err);
      toast('本地已保存，数据库同步失败', 'error');
    });
  } else {
    toast('设置已保存', 'success');
  }
}

// ---------- 数据统计 ----------
async function renderDashboard() {
  let stats = null;
  if (typeof USE_SUPABASE !== 'undefined' && USE_SUPABASE) {
    try { stats = await dbGetStats(); } catch(e) { console.error('[Supabase] 统计加载失败:', e); }
  }
  const orders = getOrders();

  if (stats) {
    $('statToday').textContent = stats.today_orders || 0;
    $('statTotal').textContent = stats.total_orders || 0;
    $('statAmount').textContent = '¥' + Number(stats.total_amount || 0).toLocaleString();
    $('statFailed').textContent = stats.failed_orders || 0;
    $('statFailRate').textContent = (stats.fail_rate_pct || 0) + '%';
  } else {
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today);
    const failedOrders = orders.filter(o => o.status === 'failed');
    const totalAmount = orders.reduce((sum, o) => sum + (o.actualPay || 0), 0);
    const failRate = orders.length > 0 ? ((failedOrders.length / orders.length) * 100).toFixed(1) : '0.0';
    $('statToday').textContent = todayOrders.length;
    $('statTotal').textContent = orders.length;
    $('statAmount').textContent = '¥' + totalAmount.toFixed(0);
    $('statFailed').textContent = failedOrders.length;
    $('statFailRate').textContent = failRate + '%';
  }

  // 最近订单
  const recent = orders.slice(0, 5);
  if (recent.length === 0) {
    $('recentOrders').innerHTML = '<div class="empty"><div class="icon">📭</div><div>暂无订单</div></div>';
  } else {
    $('recentOrders').innerHTML = `
      <table>
        <thead><tr><th>订单号</th><th>手机号</th><th>面额</th><th>实付</th><th>状态</th><th>时间</th></tr></thead>
        <tbody>
          ${recent.map(o => `
            <tr>
              <td>${o.id}</td>
              <td>${o.phone}</td>
              <td>¥${o.amount}</td>
              <td>¥${o.actualPay}</td>
              <td><span class="tag tag-${getStatusKey(o.status)}">${getStatusText(o.status)}</span></td>
              <td>${formatTime(o.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
}

// ---------- 订单管理 ----------
function renderOrders() {
  const search = ($('orderSearch')?.value || '').toLowerCase();
  const status = $('orderStatusFilter')?.value || '';
  const orders = getOrders();

  const filtered = orders.filter(o => {
    if (status && o.status !== status) return false;
    if (search && !o.id.toLowerCase().includes(search) && !(o.phone || '').includes(search)) return false;
    return true;
  });

  const tbody = $('ordersTbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9"><div class="empty"><div class="icon">📭</div><div>暂无订单</div></div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(o => `
    <tr>
      <td>${o.id}</td>
      <td>${o.phone}</td>
      <td>¥${o.amount}</td>
      <td>¥${o.actualPay}</td>
      <td>${o.payMethod === 'wechat' ? '微信' : '支付宝'}</td>
      <td><span class="tag tag-${getStatusKey(o.status)}">${getStatusText(o.status)}</span></td>
      <td>${o.voucher ? `<img src="${o.voucher}" class="voucher-thumb" onclick="showVoucher('${o.id}')">` : '<span style="color:#bbb">-</span>'}</td>
      <td>${formatTime(o.createdAt)}</td>
      <td class="actions">
        <button class="btn btn-sm" onclick="showOrderDetail('${o.id}')">详情</button>
        ${o.status === 'processing' || o.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="updateOrderStatus('${o.id}','success')">标记成功</button>` : ''}
        ${o.status !== 'success' ? `<button class="btn btn-sm btn-danger" onclick="updateOrderStatus('${o.id}','failed')">标记失败</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function getStatusKey(s) {
  return ({ pending: 'pending', processing: 'processing', success: 'success', failed: 'failed' })[s] || 'pending';
}
function getStatusText(s) {
  return ({ pending: '待支付', processing: '充值中', success: '成功', failed: '失败' })[s] || '待支付';
}
function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateOrderStatus(id, status) {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx >= 0) {
    orders[idx].status = status;
    orders[idx].updatedAt = new Date().toISOString();
    if (_remoteOrders) _remoteOrders = orders;
    setOrders(orders);
    if (typeof USE_SUPABASE !== 'undefined' && USE_SUPABASE) {
      dbUpdateOrderStatus(id, status).catch(err =>
        console.error('[Supabase] 订单状态更新失败:', err)
      );
    }
    toast('订单状态已更新', 'success');
    renderOrders();
    renderDashboard();
  }
}

function showVoucher(id) {
  const o = getOrders().find(x => x.id === id);
  if (!o || !o.voucher) return;
  $('modalVoucherImg').src = o.voucher;
  $('voucherModal').classList.add('active');
}

function showOrderDetail(id) {
  const o = getOrders().find(x => x.id === id);
  if (!o) return;
  $('orderDetailBody').innerHTML = `
    <div style="font-size:13px; line-height:2;">
      <div style="display:flex;justify-content:space-between;"><span style="color:#8a9aab">订单号</span><strong>${o.id}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#8a9aab">手机号</span><strong>${o.phone}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#8a9aab">充值面额</span><strong>¥${o.amount}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#8a9aab">折扣率</span><strong>${(o.discountRate*10).toFixed(1)} 折</strong></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#8a9aab">实付金额</span><strong style="color:#f39800;font-size:16px">¥${o.actualPay}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#8a9aab">支付方式</span><strong>${o.payMethod === 'wechat' ? '微信支付' : '支付宝'}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#8a9aab">订单状态</span><span class="tag tag-${getStatusKey(o.status)}">${getStatusText(o.status)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#8a9aab">创建时间</span><strong>${formatTime(o.createdAt)}</strong></div>
      ${o.updatedAt ? `<div style="display:flex;justify-content:space-between;"><span style="color:#8a9aab">更新时间</span><strong>${formatTime(o.updatedAt)}</strong></div>` : ''}
    </div>
    ${o.voucher ? `<div style="margin-top:16px"><div style="font-size:13px;color:#8a9aab;margin-bottom:8px">付款凭证</div><img src="${o.voucher}" style="width:100%;border-radius:6px;cursor:pointer" onclick="showVoucher('${o.id}')"></div>` : ''}
  `;
  $('orderModal').classList.add('active');
}

function closeModal() {
  document.querySelectorAll('.modal-mask').forEach(m => m.classList.remove('active'));
}

function exportOrders() {
  const orders = getOrders();
  if (orders.length === 0) {
    toast('暂无订单可导出', 'error');
    return;
  }
  const headers = ['订单号', '手机号', '面额', '实付', '折扣', '支付方式', '状态', '创建时间', '更新时间'];
  const rows = orders.map(o => [
    o.id, o.phone, o.amount, o.actualPay, (o.discountRate*10).toFixed(1) + '折',
    o.payMethod === 'wechat' ? '微信' : '支付宝', getStatusText(o.status),
    formatTime(o.createdAt), formatTime(o.updatedAt)
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${(c+'').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'orders_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('已导出 CSV', 'success');
}

// ---------- 系统设置页面 ----------
function renderSystemPage() {
  const cfg = getConfig();
  $('cfgDiscount').value = cfg.discountRate;
  $('cfgAdminPass').value = getAdminPass();
  renderAmountsList();
}

function renderAmountsList() {
  const cfg = getConfig();
  const wrap = $('amountsList');
  wrap.innerHTML = cfg.amounts.map((a, i) => {
    const auto = a.value && cfg.discountRate ? (a.value * cfg.discountRate).toFixed(0) : 0;
    const price = (a.price != null && a.price > 0) ? a.price : auto;
    return `
    <div class="amount-item" data-idx="${i}">
      <div class="amt-row">
        <span class="amt-label">面额</span>
        <input type="number" class="amt-value" value="${a.value}" oninput="updateAmtPrice(${i})" style="width:100px; padding:6px 8px; border:1px solid #d8dde3; border-radius:6px; font-size:13px;">
        <span style="color:#8a9aab">元</span>
      </div>
      <div class="amt-row amt-row-voucher">
        <span class="amt-label amt-label-voucher">代金券金额</span>
        <input type="number" class="amt-price-input" value="${price}" oninput="markAmtPriceCustom(${i})" style="width:100px; padding:6px 8px; border:1px solid #d8dde3; border-radius:6px; font-size:13px;">
        <span style="color:#8a9aab">元</span>
        <span style="color:#8a9aab; font-size:11px; margin-left:8px">自动: ¥ ${auto}</span>
      </div>
      <div class="amt-row amt-row-actions">
        <label style="display:flex; align-items:center; gap:4px; cursor:pointer; font-size:12.5px;">
          <input type="checkbox" class="amt-avail" ${a.available ? 'checked' : ''}>
          <span>可购买</span>
        </label>
        <button class="btn btn-sm" onclick="resetAmtPrice(${i})" type="button" style="margin-right:auto">恢复自动</button>
        <button class="btn btn-sm btn-danger" onclick="removeAmount(${i})">删除</button>
      </div>
    </div>
  `;
  }).join('');
}

function updateAmtPrice(idx) {
  const cfg = getConfig();
  const items = document.querySelectorAll('.amount-item');
  const item = items[idx];
  if (!item) return;
  const v = parseFloat(item.querySelector('.amt-value').value) || 0;
  const auto = (v * (cfg.discountRate || 0.85)).toFixed(0);
  const priceEl = item.querySelector('.amt-price-input');
  const hintEl = item.querySelector('.amt-row-voucher');
  if (priceEl && !priceEl.dataset.custom) {
    priceEl.value = auto;
  }
  if (hintEl) hintEl.querySelector('span:last-child').textContent = '自动: ¥ ' + auto;
}

function markAmtPriceCustom(idx) {
  const items = document.querySelectorAll('.amount-item');
  const item = items[idx];
  if (!item) return;
  const priceEl = item.querySelector('.amt-price-input');
  if (priceEl) priceEl.dataset.custom = '1';
}

function resetAmtPrice(idx) {
  const cfg = getConfig();
  const items = document.querySelectorAll('.amount-item');
  const item = items[idx];
  if (!item) return;
  const v = parseFloat(item.querySelector('.amt-value').value) || 0;
  const auto = (v * (cfg.discountRate || 0.85)).toFixed(0);
  const priceEl = item.querySelector('.amt-price-input');
  if (priceEl) {
    priceEl.value = auto;
    delete priceEl.dataset.custom;
  }
}

function addAmount() {
  const cfg = getConfig();
  cfg.amounts.push({ value: 100, available: true });
  setConfig(cfg);
  renderAmountsList();
}
function removeAmount(i) {
  const cfg = getConfig();
  cfg.amounts.splice(i, 1);
  setConfig(cfg);
  renderAmountsList();
}

// ---------- 启动 ----------
checkAuth();
