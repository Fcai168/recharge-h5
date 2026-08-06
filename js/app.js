// =====================================================
// 易捷加油 - 前端逻辑
// =====================================================

// ---------- 数据持久化 ----------
const STORAGE_KEY_CONFIG = 'oilcard_config';
const STORAGE_KEY_ORDER = 'oilcard_current_order';
const STORAGE_KEY_CLAIMED = 'oilcard_phone_claimed';

// 默认配置
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

function getConfig() {
  // 优先用 Supabase 远程配置（后台保存的实时数据）
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

// Supabase 数据库配置（snake_case）→ 前端配置（camelCase）
let _remoteConfig = null;
let _orderSyncedToDb = false;
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

// ---------- 全局状态 ----------
let state = {
  phone: '',
  selectedAmount: null,
  payMethod: null,
  voucher: null,
  orderId: null
};

// ---------- 初始化 ----------
function init() {
  loadSiteConfig();
  setupUploadDrag();
}

async function loadSiteConfig() {
  let cfg = null;
  // 优先从 Supabase 读取配置
  if (typeof USE_SUPABASE !== 'undefined' && USE_SUPABASE) {
    try {
      const dbCfg = await dbGetConfig();
      if (dbCfg) {
        cfg = dbConfigToJsConfig(dbCfg);
        _remoteConfig = cfg;
        // 同步写入 localStorage 作为缓存（Supabase 不可用时 fallback）
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
      }
    } catch (e) { console.error('[Config] 远程配置加载失败，回退本地', e); }
  }
  if (!cfg) cfg = getConfig();

  // Logo
  if (cfg.logo) {
    const el = document.getElementById('topLogo');
    el.src = cfg.logo;
    el.style.display = 'block';
    document.getElementById('topLogoFallback').style.display = 'none';
  }

  // Banner（默认隐藏，仅在后台配置并恢复 HTML 时显示）
  if (cfg.banner) {
    const el = document.getElementById('bannerImg');
    if (el) {
      el.src = cfg.banner;
      el.style.display = 'block';
      el.parentElement.style.background = 'transparent';
      el.parentElement.style.display = 'block';
    }
  }

  // 公告
  const box = document.getElementById('announcementBox');
  if (box) {
    if (cfg.announcement) {
      box.innerHTML = renderAnnouncement(cfg.announcement);
    } else {
      // 没拉到公告时显示默认
      box.innerHTML = renderAnnouncement(DEFAULT_CONFIG.announcement);
    }
  }

  // 动态折扣标识
  const badge = document.getElementById('discountBadge');
  if (badge && cfg.discountRate) {
    const discount = (cfg.discountRate * 10).toFixed(1);
    badge.textContent = '限时 ' + discount + ' 折';
  }
}

// ---------- 公告解析与渲染 ----------
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

// 解析公告文本：首行 = 主标题；以"·"开头的为要点；其余非空行为段落/小节标题
function parseAnnouncement(text) {
  const lines = String(text || '').split('\n').map(l => l.trim());
  const result = { title: '', sections: [] };
  // 找到首个非空行作为主标题
  let i = 0;
  while (i < lines.length && !lines[i]) i++;
  if (i >= lines.length) return result;
  result.title = lines[i];
  i++;

  let current = { title: '', items: [] };
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (line.startsWith('·') || line.startsWith('•') || line.startsWith('-')) {
      if (!current) current = { title: '', items: [] };
      current.items.push(line.replace(/^[·•\-]\s*/, ''));
    } else {
      // 切换到新小节
      if (current && (current.title || current.items.length)) result.sections.push(current);
      current = { title: line, items: [] };
    }
  }
  if (current && (current.title || current.items.length)) result.sections.push(current);
  return result;
}

function renderAnnouncement(text) {
  const p = parseAnnouncement(text);
  let html = '';
  if (p.title) html += `<h3>${escapeHtml(p.title)}</h3>`;
  p.sections.forEach(sec => {
    if (sec.title) html += `<h4>${escapeHtml(sec.title)}</h4>`;
    if (sec.items.length) {
      html += '<ul>';
      sec.items.forEach(it => {
        html += `<li>${escapeHtml(it)}</li>`;
      });
      html += '</ul>';
    }
  });
  return html;
}

// ---------- 工具 ----------
function showStep(n) {
  // 隐藏所有 step
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  // 展示目标 step
  const target = document.getElementById('step-' + n);
  if (target) target.classList.add('active');
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
  // 重置
  state = { phone: '', selectedAmount: null, payMethod: null, voucher: null, orderId: null };
  _orderSyncedToDb = false;
  localStorage.removeItem(STORAGE_KEY_ORDER);
  document.getElementById('phoneInput').value = '';
  document.getElementById('phoneInput').disabled = false;
  document.getElementById('step-4a').classList.remove('active');
  document.getElementById('step-4b').classList.remove('active');
  document.getElementById('step-4c').classList.remove('active');
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('fileInput').value = '';
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('nextBtn2').disabled = true;
  document.querySelectorAll('.amount-card').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.pay-method').forEach(el => el.classList.remove('selected'));
  showStep('1');
}

// ---------- 步骤 1: 输入手机号直接进入 ----------
    document.getElementById('nextBtn1').classList.add('btn-primary');
    // 显示右上角浮动徽章"代金券已领取！"
    document.getElementById('couponClaimedBadge').style.display = 'flex';
    // 隐藏领取按钮
    btn.style.display = 'none';
    // 手机号输入框变灰
    document.getElementById('phoneInput').disabled = true;
  }, 800);
}

// 实时校验手机号
document.addEventListener('DOMContentLoaded', () => {
  const phoneInput = document.getElementById('phoneInput');
  phoneInput.addEventListener('input', () => {
    // 数字过滤
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 11);
  });
  init();
});

// ---------- 步骤切换 ----------
function goStep(n) {
  if (n === 2) {
    // 校验手机号
    if (!state.phone) {
      const phone = document.getElementById('phoneInput').value.trim();
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        alert('请先输入正确的 11 位手机号码');
        return;
      }
      state.phone = phone;
    }
    renderAmounts();
    document.getElementById('sumPhone').textContent = state.phone;
  }
  if (n === 3) {
    if (!state.selectedAmount) { alert('请选择充值金额'); return; }
    if (!state.payMethod) { alert('请选择支付方式'); return; }
    renderPayment();
  }
  if (n === 4) {
    showStep('4a');
    return;
  }
  showStep(String(n));
}

// ---------- 步骤 2: 金额选择 ----------
function getAmtPrice(a, cfg) {
  if (a.price != null && a.price > 0) return Number(a.price);
  return Math.round(a.value * (cfg.discountRate || 0.85));
}

function renderAmounts() {
  const cfg = getConfig();
  const grid = document.getElementById('amountGrid');
  grid.innerHTML = '';
  cfg.amounts.forEach((a, idx) => {
    const price = getAmtPrice(a, cfg);
    const div = document.createElement('div');
    div.className = 'amount-card' + (a.available ? '' : ' disabled');
    div.dataset.value = a.value;
    div.dataset.price = price;
    div.innerHTML = `
      ${!a.available ? '<span class="stock-tag">补货中</span>' : ''}
      <div class="value">${a.value}<small> 元</small></div>
      <div class="price">¥ ${price}</div>
      <div class="original">原价 ¥ ${a.value}</div>
    `;
    if (a.available) {
      div.onclick = () => selectAmount(a);
    }
    grid.appendChild(div);
  });
  // 默认选中第一个可用的
  const first = cfg.amounts.find(a => a.available);
  if (first) selectAmount(first);
}

function selectAmount(a) {
  state.selectedAmount = a;
  document.querySelectorAll('.amount-card').forEach(el => el.classList.remove('selected'));
  const target = document.querySelector(`.amount-card[data-value="${a.value}"]`);
  if (target) target.classList.add('selected');

  // 生成订单号
  if (!state.orderId) state.orderId = 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
  const orderIdEl = document.getElementById('sumOrderId');
  if (orderIdEl) orderIdEl.textContent = state.orderId;

  const cfg = getConfig();
  const price = getAmtPrice(a, cfg);
  const discount = (a.value - price).toFixed(0);
  document.getElementById('sumAmount').textContent = '¥ ' + a.value;
  document.getElementById('sumDiscount').textContent = '- ¥ ' + discount;
  document.getElementById('sumPay').textContent = '¥ ' + price;

  updateNextBtn2();
}

function selectPay(method) {
  state.payMethod = method;
  document.querySelectorAll('.pay-method').forEach(el => el.classList.remove('selected'));
  document.querySelector(`.pay-method[data-method="${method}"]`).classList.add('selected');
  updateNextBtn2();
}

function updateNextBtn2() {
  const ok = state.selectedAmount && state.payMethod;
  document.getElementById('nextBtn2').disabled = !ok;
}

// ---------- 步骤 3: 支付 ----------
function renderPayment() {
  const cfg = getConfig();
  const price = getAmtPrice(state.selectedAmount, cfg);

  document.getElementById('payTitle').textContent = state.payMethod === 'wechat' ? '微信支付' : '支付宝支付';
  document.getElementById('payAppName').textContent = state.payMethod === 'wechat' ? '微信' : '支付宝';
  document.getElementById('qrPayAmount').textContent = '¥ ' + price;

  // 二维码
  const qrBox = document.getElementById('qrBox');
  const qrSrc = state.payMethod === 'wechat' ? cfg.wechatQR : cfg.alipayQR;
  if (qrSrc) {
    qrBox.innerHTML = `<img src="${qrSrc}" alt="收款二维码">`;
  } else {
    // 生成占位二维码（基于订单信息）
    qrBox.innerHTML = renderPlaceholderQR(state.payMethod, price);
  }

  // 确认信息
  document.getElementById('cfPhone').textContent = state.phone;
  document.getElementById('cfAmount').textContent = state.selectedAmount.value + ' 元';
  document.getElementById('cfMethod').textContent = state.payMethod === 'wechat' ? '微信支付' : '支付宝';
  document.getElementById('cfPay').textContent = '¥ ' + price;
  const cfOrderId = document.getElementById('cfOrderId');
  if (cfOrderId) cfOrderId.textContent = state.orderId || '--';
}

// 占位二维码（视觉占位）
function renderPlaceholderQR(method, amount) {
  const color = method === 'wechat' ? '#07c160' : '#1677ff';
  const label = method === 'wechat' ? '微信收款码' : '支付宝收款码';
  // 简单的视觉占位
  let cells = '';
  const N = 21;
  // 固定的伪随机图案
  const seed = (method + amount).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // 三个定位点
      const isCorner = (x < 7 && y < 7) || (x >= N-7 && y < 7) || (x < 7 && y >= N-7);
      if (isCorner) continue;
      const v = Math.sin((x * 12.9898 + y * 78.233 + seed) * 43758.5453) * 10000;
      if ((v - Math.floor(v)) > 0.5) {
        cells += `<rect x="${x * 8}" y="${y * 8}" width="8" height="8" fill="${color}"/>`;
      }
    }
  }
  // 定位点
  const corners = [
    { x: 0, y: 0 }, { x: (N-7)*8, y: 0 }, { x: 0, y: (N-7)*8 }
  ];
  let cornerSvg = '';
  corners.forEach(c => {
    cornerSvg += `
      <rect x="${c.x}" y="${c.y}" width="56" height="56" fill="${color}"/>
      <rect x="${c.x+8}" y="${c.y+8}" width="40" height="40" fill="#fff"/>
      <rect x="${c.x+16}" y="${c.y+16}" width="24" height="24" fill="${color}"/>
    `;
  });
  return `
    <svg viewBox="0 0 ${N*8} ${N*8}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;">
      ${cells}${cornerSvg}
      <rect x="${(N*8-50)/2}" y="${(N*8-14)/2}" width="50" height="14" fill="#fff"/>
      <text x="${N*4}" y="${N*4+4}" text-anchor="middle" font-size="9" fill="${color}" font-weight="bold">${label}</text>
    </svg>
  `;
}

// ---------- 步骤 4: 凭证 ----------
function triggerUpload() {
  document.getElementById('fileInput').click();
}

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过 5MB');
    return;
  }
  if (!file.type.startsWith('image/')) {
    alert('请上传图片文件');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    state.voucher = e.target.result;
    document.getElementById('previewImg').src = state.voucher;
    document.getElementById('uploadPreview').style.display = 'block';
    document.getElementById('uploadArea').style.display = 'none';
    document.getElementById('submitBtn').disabled = false;
  };
  reader.readAsDataURL(file);
}

function removeFile() {
  state.voucher = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('previewImg').src = '';
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('uploadArea').style.display = 'block';
  document.getElementById('submitBtn').disabled = true;
}

function setupUploadDrag() {
  const area = document.getElementById('uploadArea');
  if (!area) return;
  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });
  area.addEventListener('dragleave', () => {
    area.classList.remove('dragover');
  });
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const fakeEvent = { target: { files: [file] } };
      handleFile(fakeEvent);
    }
  });
}

function submitVoucher() {
  if (!state.voucher) { alert('请先上传付款凭证'); return; }
  // 保存订单
  saveOrder('processing');
  // 跳到充值中
  showStep('4b');
  // 模拟 3 秒后失败
  setTimeout(() => {
    saveOrder('failed');
    showStep('4c');
  }, 3000);
}

function saveOrder(status) {
  const cfg = getConfig();
  const price = getAmtPrice(state.selectedAmount, cfg);
  if (!state.orderId) {
    state.orderId = 'ORD' + Date.now() + Math.floor(Math.random()*1000);
  }
  const order = {
    id: state.orderId,
    phone: state.phone,
    amount: state.selectedAmount.value,
    actualPay: parseFloat(price),
    discountRate: cfg.discountRate,
    payMethod: state.payMethod,
    status: status,
    voucher: state.voucher,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  // 存到订单列表
  const ordersKey = 'oilcard_orders';
  let orders = [];
  try { orders = JSON.parse(localStorage.getItem(ordersKey) || '[]'); } catch(e) { orders = []; }
  const idx = orders.findIndex(o => o.id === order.id);
  if (idx >= 0) {
    orders[idx] = { ...orders[idx], ...order };
  } else {
    orders.unshift(order);
  }
  localStorage.setItem(ordersKey, JSON.stringify(orders));
  localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(order));

  // 同步写入 Supabase 数据库（后台可查看订单）
  if (typeof USE_SUPABASE !== 'undefined' && USE_SUPABASE) {
    if (!_orderSyncedToDb) {
      // 首次：INSERT
      dbCreateOrder({
        id: order.id,
        phone: order.phone,
        amount: order.amount,
        actualPay: order.actualPay,
        discountRate: order.discountRate,
        payMethod: order.payMethod,
        status: order.status,
        voucher: order.voucher
      }).then(() => {
        _orderSyncedToDb = true;
        console.log('[Supabase] 订单已写入数据库:', order.id);
      }).catch(err => console.error('[Supabase] 订单写入失败:', err));
    } else {
      // 后续：UPDATE 状态
      dbUpdateOrderStatus(order.id, order.status).catch(err =>
        console.error('[Supabase] 订单状态更新失败:', err)
      );
    }
  }
}

function contactService() {
  const cfg = getConfig();
  if (cfg.customerService) {
    window.open(cfg.customerService, '_blank');
  } else {
    alert('客服链接未配置，请联系管理员');
  }
}
