window.onerror = function (message, source, line) {
  console.log("ERROR:", message, "LINE:", line);
};

// ══════════════════════════════════════════
//  CONFIG — change this to match your server
// ══════════════════════════════════════════
const API = "http://localhost/agromarket/backend";

// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════

let PRODUCTS = [];
let ADMIN_USERS = [];
let ORDER_HISTORY = [];
let SELLER_ORDERS = [];

let CONVERSATIONS = [];

let currentUser = null;
let currentRole = 'buyer';
let cart = [];
let currentFilter = 'All';
let activeConv = null;
let deleteTarget = null;
let editTarget = null;
let addSelectedFiles = [];
let editSelectedFiles = [];

// ══════════════════════════════════════════
//  SESSION — persist login across refresh
// ══════════════════════════════════════════
function saveSession() {
  localStorage.setItem('agro_user', JSON.stringify(currentUser));
  localStorage.setItem('agro_role', currentRole);
}
function clearSession() {
  localStorage.removeItem('agro_user');
  localStorage.removeItem('agro_role');
}
function loadSession() {
  const saved = localStorage.getItem('agro_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      currentRole = localStorage.getItem('agro_role') || currentUser.role;
      return true;
    } catch (e) { return false; }
  }
  return false;
}

// ══════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  el.innerHTML = `<span class="ti">${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
  toast.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}


function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function escapeAttr(value) {
  return escapeHTML(value).replace(/'/g, '&#39;');
}

function productVisual(p, className = 'card-emoji') {

  const imageUrl = (p.image_url || '').trim();

  if (!imageUrl) {

    return `
      <div class="${className}">
        <div class="product-image-placeholder">
          No Image
        </div>
      </div>
    `;
  }

  return `
    <div class="${className}">
      <img
        src="${escapeAttr(imageUrl)}"
        class="product-image"
        alt="${escapeAttr(p.name || 'Product')}"
        onerror="this.parentElement.innerHTML='<div class=product-image-placeholder>No Image</div>'"
      >
    </div>
  `;
}

function getCategories() {
  return [...new Set(PRODUCTS.map(p => (p.category || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function buildCategoryOptions() {
  const list = document.getElementById('category-list');
  if (!list) return;
  list.innerHTML = getCategories().map(cat => `<option value="${escapeAttr(cat)}"></option>`).join('');
}

function buildCategoryFilters() {
  const wrap = document.getElementById('category-filter-buttons');
  if (!wrap) return;
  const buttons = ['All', ...getCategories()];
  wrap.innerHTML = buttons.map(cat =>
    `<button class="filter-btn ${cat === currentFilter ? 'active' : ''}" data-category="${escapeAttr(cat)}" onclick="setFilter(this.dataset.category,this)">${cat === 'All' ? 'All' : escapeHTML(cat)}</button>`
  ).join('');
}

function sellerNameFromEmail(email) {
  return email ? email.split('@')[0] : 'Unknown Seller';
}

function clampDiscount(value) {
  const discount = parseFloat(value) || 0;
  return Math.max(0, Math.min(100, discount));
}

function discountedPrice(price, discountPercent) {
  return Math.max(0, price * (1 - clampDiscount(discountPercent) / 100));
}

function priceMarkup(p) {
  const discount = clampDiscount(p.discount_percent);
  const finalPrice = discountedPrice(p.price, discount);
  if (!discount) return `<span class="card-price">${p.price.toFixed(2)}</span>`;
  return `
    <span class="card-price">${finalPrice.toFixed(2)}</span>
    <span class="card-price-old">${p.price.toFixed(2)}</span>
    <span class="discount-pill">${discount}% off</span>
  `;
}

function todayAtMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateFromDaysOld(daysOld) {
  const days = Math.max(0, parseInt(daysOld) || 0);
  const d = todayAtMidnight();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysOldFromHarvest(harvestDate) {
  if (!harvestDate) return 0;
  const harvest = new Date(harvestDate);
  if (Number.isNaN(harvest.getTime())) return 0;
  harvest.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((todayAtMidnight() - harvest) / 86400000));
}

function freshnessScoreFromDays(daysOld) {
  return Math.max(5, Math.min(100, 100 - daysOld * 15));
}

function freshnessLabel(daysOld) {
  if (daysOld === 0) return 'Fresh today';
  if (daysOld === 1) return '1 day old';
  return `${daysOld} days old`;
}

function freshnessBadgeClass(daysOld) {
  if (daysOld <= 1) return 'badge-fresh';
  if (daysOld <= 4) return 'badge-aging';
  return 'badge-stale';
}

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pass').value;

  if (!email || !password) {
    showToast('Please enter email and password', 'error');
    return;
  }

  fetch(`${API}/users/login.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        currentUser = { name: data.name, email: data.email, role: data.role };
        currentRole = data.role;
        saveSession();
        showToast('Login Successful 🌿', 'success');
        enterApp();
      } else {
        showToast(data.message || 'Invalid email or password', 'error');
      }
    })
    .catch(() => showToast('Could not reach server', 'error'));
}

function quickAccess(role) {
  const names = { buyer: 'Demo Buyer', seller: 'Demo Seller', admin: 'Administrator' };
  const emails = { buyer: 'buyer@demo.com', seller: 'seller@demo.com', admin: 'admin@demo.com' };
  currentUser = { name: names[role], email: emails[role], role };
  currentRole = role;
  saveSession();
  enterApp();
}

function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-pass').value;
  const role = document.getElementById('role-seller').classList.contains('selected') ? 'seller' : 'buyer';

  if (!name || !email || !password) {
    showToast('All fields are required', 'error');
    return;
  }

  fetch(`${API}/users/register.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name, email, password, role })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast(data.message, 'success');
        currentUser = { name, email, role };
        currentRole = role;
        saveSession();
        enterApp();
      } else {
        showToast(data.message || 'Registration failed', 'error');
      }
    })
    .catch(() => showToast('Could not reach server', 'error'));
}

function selectRole(r) {
  document.getElementById('role-buyer').classList.toggle('selected', r === 'buyer');
  document.getElementById('role-seller').classList.toggle('selected', r === 'seller');
}

function enterApp() {
  showPage('page-app');
  buildNav();
  buildProducts();
  buildMessages();
  buildCart();
  buildOrderHistory();
  buildSellerInventory();
  buildSellerProductsList();
  buildAdminUsers();
  updateCartCount();

  document.getElementById('nav-username').textContent = currentUser.name;
  document.getElementById('ud-name').textContent = currentUser.name;
  document.getElementById('ud-email').textContent = currentUser.email;
  document.getElementById('ud-role-badge').textContent = currentRole.charAt(0).toUpperCase() + currentRole.slice(1);
  document.getElementById('dash-buyer-name').textContent = currentUser.name;

  if (currentRole === 'buyer') {
    document.getElementById('nav-cart-btn').style.display = '';
  } else {
    document.getElementById('nav-cart-btn').style.display = 'none';
  }

  const loginBtn = document.querySelector('.lh-login-btn');
  if (loginBtn) {
    loginBtn.textContent = 'GO TO APP';
    loginBtn.onclick = () => showPage('page-app');
  }

  const lhCartBtn = document.querySelector('.lh-cart-btn');
  if (lhCartBtn) {
    lhCartBtn.style.display = currentRole === 'buyer' ? '' : 'none';
  }

  const startTab = currentRole === 'seller' ? 'tab-dashboard-seller'
    : currentRole === 'admin' ? 'tab-admin'
      : 'tab-market';
  switchTab(startTab);
}

function doLogout() {
  currentUser = null;
  cart = [];
  clearSession();
  const loginBtn = document.querySelector('.lh-login-btn');
  if (loginBtn) {
    loginBtn.textContent = 'LOGIN / REGISTER';
    loginBtn.onclick = () => showPage('page-login');
  }
  const lhCartBtn = document.querySelector('.lh-cart-btn');
  if (lhCartBtn) {
    lhCartBtn.style.display = '';
  }
  showPage('page-landing');
}

function switchRole() {
  currentRole = currentRole === 'buyer' ? 'seller' : 'buyer';
  currentUser.role = currentRole;
  saveSession();
  enterApp();
  document.getElementById('user-dropdown').classList.remove('open');
}

function toggleUserDropdown() {
  document.getElementById('user-dropdown').classList.toggle('open');
}
document.addEventListener('click', e => {
  const u = document.querySelector('.nav-user');
  if (u && !u.contains(e.target)) document.getElementById('user-dropdown').classList.remove('open');
});

// ══════════════════════════════════════════
//  NAV
// ══════════════════════════════════════════
const NAV_CONFIGS = {
  buyer: [
    { id: 'tab-market', icon: '🌿', label: 'Market' },
    { id: 'tab-dashboard-buyer', icon: '📊', label: 'Dashboard' },
    { id: 'tab-messages', icon: '💬', label: 'Messages' },
    { id: 'tab-cart', icon: '🛒', label: 'Cart' },
  ],
  seller: [
    { id: 'tab-market', icon: '🌿', label: 'Market' },
    { id: 'tab-dashboard-seller', icon: '📊', label: 'Dashboard' },
    { id: 'tab-products', icon: '🌾', label: 'Products' },
    { id: 'tab-orders', icon: '📦', label: 'Orders' },
    { id: 'tab-messages', icon: '💬', label: 'Messages' },
    { id: 'tab-add', icon: '➕', label: 'Add' },
  ],
  admin: [
    { id: 'tab-admin', icon: '📊', label: 'Dashboard' },
    { id: 'tab-settings', icon: '⚙️', label: 'Settings' },
  ],
};

function buildNav() {
  const container = document.getElementById('nav-links');
  const links = NAV_CONFIGS[currentRole] || NAV_CONFIGS.buyer;
  container.innerHTML = links.map(l =>
    `<button class="nav-link" data-tab="${l.id}" onclick="switchTab('${l.id}')">${l.icon} ${l.label}</button>`
  ).join('');
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  const el = document.getElementById(tabId);
  if (el) el.style.display = 'block';
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.tab === tabId)
  );
  if (tabId === 'tab-cart') updateCartCount();
  if (tabId === 'tab-dashboard-seller') document.getElementById('seller-product-count').textContent = PRODUCTS.filter(p => p.seller_email === currentUser.email).length;
  if (tabId === 'tab-products') buildSellerProductsList();
  if (tabId === 'tab-orders') buildSellerOrders();
  if (tabId === 'tab-admin') buildAdminUsers();
  if (tabId === 'tab-messages') buildMessages();
  if (tabId === 'tab-cart') { buildCart(); buildOrderHistory(); }
}

// ══════════════════════════════════════════
//  PRODUCTS
// ══════════════════════════════════════════
function buildProducts() {
  fetch(`${API}/products/getProducts.php`)
    .then(r => r.json())
    .then(data => {
      PRODUCTS = data.map(p => ({
        id: parseInt(p.id),
        name: p.name,
        farm: p.seller_email ? p.seller_email.split('@')[0] : 'Local Farm',
        category: p.category,
        price: parseFloat(p.price),
        discount_percent: clampDiscount(p.discount_percent),
        stock: parseInt(p.stock),
        harvest_date: p.harvest_date || '',
        days_old: daysOldFromHarvest(p.harvest_date),
        freshness: freshnessScoreFromDays(daysOldFromHarvest(p.harvest_date)),
        rating: p.rating ? parseFloat(p.rating) : null,
        reviews: parseInt(p.reviews || 0),
        fresh: daysOldFromHarvest(p.harvest_date) <= 1,
        seller_email: p.seller_email || '',
        image_url: p.image_url || '',
        description: p.description || '',
        delivery_time: p.delivery_time || '2-3 Days'
      }));
      buildCategoryOptions();
      buildCategoryFilters();
      filterProducts();
      buildSellerInventory();
      buildSellerProductsList();
      buildAdminAnalytics();
      loadSiteStats(); // load site stats dynamically
      // update hero stat
      document.querySelectorAll('.stat-num').forEach((el, i) => {
        if (i === 0) el.textContent = PRODUCTS.length;
      });
      renderLandingPageContent();
      loadLandingConfig();
    })
    .catch(() => console.log('Could not load products'));
}

function setFilter(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterProducts();
}

function filterProducts() {
  const search = document.getElementById('search-input').value.toLowerCase();
  let list = PRODUCTS.filter(p => {
    const matchCat = currentFilter === 'All' || p.category === currentFilter;
    const matchSearch = !search || p.name.toLowerCase().includes(search) || p.farm.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });
  renderProducts(list);
}

function renderProducts(list) {
  const grid = document.getElementById('products-grid');
  if (!list.length) {
    grid.innerHTML = '<p style="color:var(--text-light);padding:40px 0">No products found.</p>';
    return;
  }
  grid.innerHTML = list.map(p => {
    const inCart = cart.find(c => c.id === p.id);
    return `
    <div class="product-card" style="cursor:pointer" onclick="if(!event.target.closest('button')) openProductDetails(${p.id})">
      <div class="card-badges">
        <span class="${freshnessBadgeClass(p.days_old)}">${freshnessLabel(p.days_old)}</span>
      </div>
      ${productVisual(p, 'card-emoji')}
      <div class="card-name">${p.name}</div>
      <div class="card-farm">${p.farm}</div>
      <div style="display:flex;align-items:baseline;gap:4px">
        ${priceMarkup(p)}
      </div>
      <div class="card-meta">
        <span>${p.stock} left</span>
        <span>${p.rating ? `<span class="card-stars">★</span> ${p.rating} (${p.reviews})` : freshnessLabel(p.days_old)}</span>
      </div>
      <button class="btn-add-cart ${inCart ? 'added' : ''}" onclick="event.stopPropagation(); addToCart(${p.id})" ${p.stock === 0 ? 'disabled style="opacity:.5"' : ''}>
        ${p.stock === 0 ? 'Out of Stock' : inCart ? '✓ Added' : 'Add to Cart'}
      </button>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════
//  CART
// ══════════════════════════════════════════
function addToCart(id) {
  if (currentRole !== 'buyer') { showToast('Switch to Buyer to shop', 'error'); return; }
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  const existing = cart.find(c => c.id === id);
  if (existing) {
    if (existing.qty >= p.stock) { showToast('Not enough stock', 'error'); return; }
    existing.qty++;
  } else {
    cart.push({ ...p, price: discountedPrice(p.price, p.discount_percent), original_price: p.price, qty: 1 });
  }
  updateCartCount();
  filterProducts();
  showToast(`Added ${p.name} to cart`, 'success');
  buildCart();
  const el = document.getElementById('dash-cart-num');
  if (el) el.textContent = cart.reduce((s, c) => s + c.qty, 0);
}

function updateCartCount() {
  const total = cart.reduce((s, c) => s + c.qty, 0);
  document.getElementById('cart-count').textContent = total;
}

function buildCart() {
  const container = document.getElementById('cart-items-container');
  if (!cart.length) {
    container.innerHTML = `<div class="cart-empty">
      <div class="cart-empty-icon">🛒</div>
      <p>Your cart is empty</p>
      <small>Add some fresh products!</small>
    </div>`;
    return;
  }
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-media">
        ${item.image_url ? `<img src="${escapeAttr(item.image_url)}" class="cart-item-image" alt="${escapeAttr(item.name || 'Product')}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <span class="cart-item-fallback" style="${item.image_url ? 'display:none' : ''}">${escapeHTML(item.emoji || '🥬')}</span>
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-farm">${item.farm}</div>
      </div>
      <div class="cart-qty">
        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
      </div>
      <div class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</div>
      <button class="cart-remove" onclick="removeFromCart(${item.id})">✕</button>
    </div>
  `).join('')
    + `<div class="cart-total-row"><span>Total</span><span style="color:var(--green-dark)">$${total.toFixed(2)}</span></div>
     <button class="btn-checkout" onclick="checkout()">Checkout →</button>`;
}

function changeQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
  buildCart(); updateCartCount(); filterProducts();
  const el = document.getElementById('dash-cart-num');
  if (el) el.textContent = cart.reduce((s, c) => s + c.qty, 0);
}

function removeFromCart(id) {
  const item = cart.find(c => c.id === id);
  cart = cart.filter(c => c.id !== id);
  buildCart(); updateCartCount(); filterProducts();
  if (item) showToast(`Removed ${item.name}`, 'error');
}

function checkout() {
  if (!cart.length) {
    showToast('Your cart is empty', 'error');
    return;
  }
  if (!currentUser) {
    landingGateAlert();
    return;
  }
  // Show checkout tab
  switchTab('tab-checkout');
  // Reset step views
  document.getElementById('checkout-view-step1').style.display = 'block';
  document.getElementById('checkout-view-step2').style.display = 'none';
  
  // Update stepper visual
  document.getElementById('cs-step-1').style.opacity = '1';
  document.getElementById('cs-step-line').style.background = 'var(--cream-dark)';
  document.getElementById('cs-step-2').style.opacity = '0.5';
  
  // Autofill buyer name from profile if input is blank
  const nameInput = document.getElementById('checkout-name');
  if (nameInput && !nameInput.value) {
    nameInput.value = currentUser.name;
  }
}

function checkoutNextStep() {
  const name = document.getElementById('checkout-name').value.trim();
  const phone = document.getElementById('checkout-phone').value.trim();
  const address = document.getElementById('checkout-address').value.trim();
  const payment = document.getElementById('checkout-payment').value;

  if (!name || !phone || !address) {
    showToast('Please fill in all shipping details.', 'error');
    return;
  }

  // Transition stepper visual
  document.getElementById('cs-step-line').style.background = 'var(--green)';
  document.getElementById('cs-step-2').style.opacity = '1';
  
  // Hide step 1, show step 2
  document.getElementById('checkout-view-step1').style.display = 'none';
  document.getElementById('checkout-view-step2').style.display = 'block';

  // Build Invoice Memo HTML
  const memoContainer = document.getElementById('invoice-memo-container');
  if (!memoContainer) return;

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const shipping = subtotal > 50 ? 0.00 : 5.00;
  const vat = subtotal * 0.05;
  const grandTotal = subtotal + shipping + vat;

  let itemsHtml = cart.map(item => `
    <div class="invoice-item-row">
      <span class="invoice-item-name">${escapeHTML(item.name)}</span>
      <span class="invoice-item-qty-price">${item.qty} x $${item.price.toFixed(2)}</span>
      <span class="invoice-item-total">$${(item.price * item.qty).toFixed(2)}</span>
    </div>
  `).join('');

  memoContainer.innerHTML = `
    <div class="invoice-header">
      <div class="invoice-logo">🌿 Agro<span>Market</span></div>
      <div class="invoice-title">Order Summary & Invoice</div>
    </div>
    <div class="invoice-details-grid">
      <div>
        <span class="invoice-details-label">Bill To:</span><br>
        ${escapeHTML(name)}<br>
        ${escapeHTML(phone)}
      </div>
      <div style="text-align: right">
        <span class="invoice-details-label">Ship To:</span><br>
        ${escapeHTML(address)}
      </div>
    </div>
    <div class="invoice-details-grid" style="grid-template-columns: 1fr; margin-top: -8px">
      <div>
        <span class="invoice-details-label">Payment Mode:</span>
        <span class="invoice-details-val">${escapeHTML(payment)}</span>
      </div>
    </div>
    <hr class="invoice-divider">
    <div class="invoice-items-list">
      ${itemsHtml}
    </div>
    <hr class="invoice-divider">
    <div class="invoice-summary-box">
      <div class="invoice-summary-row">
        <span>Subtotal</span>
        <span>$${subtotal.toFixed(2)}</span>
      </div>
      <div class="invoice-summary-row">
        <span>Delivery Fee</span>
        <span>${shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
      </div>
      <div class="invoice-summary-row">
        <span>VAT (5%)</span>
        <span>$${vat.toFixed(2)}</span>
      </div>
      <div class="invoice-summary-row grand-total">
        <span>Grand Total</span>
        <span>$${grandTotal.toFixed(2)}</span>
      </div>
    </div>
  `;
}

function checkoutPrevStep() {
  document.getElementById('checkout-view-step1').style.display = 'block';
  document.getElementById('checkout-view-step2').style.display = 'none';

  document.getElementById('cs-step-line').style.background = 'var(--cream-dark)';
  document.getElementById('cs-step-2').style.opacity = '0.5';
}

function confirmCheckoutOrder() {
  const name = document.getElementById('checkout-name').value.trim();
  const phone = document.getElementById('checkout-phone').value.trim();
  const address = document.getElementById('checkout-address').value.trim();
  const payment = document.getElementById('checkout-payment').value;

  if (!cart.length) return;

  const itemsJson = JSON.stringify(cart.map(c => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji || '🥬',
    image_url: c.image_url || '',
    qty: c.qty,
    price: c.price
  })));

  fetch(`${API}/orders/placeOrder.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      buyer_email: currentUser.email,
      buyer_name: name,
      buyer_phone: phone,
      shipping_address: address,
      payment_method: payment,
      items: itemsJson
    })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast('Checkout complete! Order placed successfully. 📦', 'success');
        cart = [];
        updateCartCount();
        filterProducts();
        buildCart();
        buildOrderHistory();
        buildProducts();

        // Clear fields
        document.getElementById('checkout-name').value = '';
        document.getElementById('checkout-phone').value = '';
        document.getElementById('checkout-address').value = '';
        document.getElementById('checkout-payment').value = 'Cash on Delivery';

        // Redirect to Cart/Order History tab
        switchTab('tab-cart');
      } else {
        showToast(data.message || 'Failed to place order', 'error');
      }
    })
    .catch(() => showToast('Could not reach server to place order', 'error'));
}

// ══════════════════════════════════════════
//  ORDER HISTORY (buyer)
// ══════════════════════════════════════════
function buildOrderHistory() {
  if (!currentUser) return;
  const el = document.getElementById('order-history');
  el.innerHTML = '<p style="color:var(--text-light);padding:20px 0;font-size:13px">Loading...</p>';

  fetch(`${API}/orders/getOrders.php?buyer_email=${encodeURIComponent(currentUser.email)}`)
    .then(r => r.json())
    .then(orders => {
      ORDER_HISTORY = orders;
      if (!orders.length) {
        el.innerHTML = '<p style="color:var(--text-light);padding:20px 0;font-size:13px">No orders yet.</p>';
        return;
      }
      el.innerHTML = orders.map(o => `
      <div class="order-item">
        <div class="order-item-emoji">
<img
  src="${o.image_url || ''}"
  class="mini-order-image"
  onerror="this.src='https://via.placeholder.com/60?text=No+Image'"
></div>
        <div class="order-item-info">
          <div class="order-item-name">${o.product_name}</div>
          <div class="order-item-meta">Qty: ${o.quantity} · ${o.created_at.split(' ')[0]}</div>
          <div><span class="order-status status-${o.status.toLowerCase()}">${o.status}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <div class="order-price">$${parseFloat(o.total).toFixed(2)}</div>
          <div style="display:flex;gap:6px">
            <button class="btn-track" onclick="openOrderTracking(${o.id})">🚚 Track</button>
            ${o.status === 'Delivered' && !o.is_rated ? `<button class="btn-sm" onclick="rateProduct(${o.id}, ${o.product_id})">⭐ Rate</button>` : ''}
            ${o.is_rated ? `<span style="font-size:12px;color:var(--text-light);align-self:center">Rated ⭐</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');
      // update dashboard numbers
      const confirmed = orders.filter(o => o.status === 'Confirmed').length;
      const delivered = orders.filter(o => o.status === 'Delivered').length;
      const totalEl = document.getElementById('dash-orders-total');
      const confEl = document.getElementById('dash-orders-confirmed');
      const delEl = document.getElementById('dash-orders-delivered');
      if (totalEl) totalEl.textContent = orders.length;
      if (confEl) confEl.textContent = confirmed;
      if (delEl) delEl.textContent = delivered;
    })
    .catch(() => {
      el.innerHTML = '<p style="color:var(--text-light);font-size:13px">Could not load orders.</p>';
    });
}

function rateProduct(orderId, productId) {
  const ratingStr = prompt('Rate this product (1-5 stars):', '5');
  if (!ratingStr) return;
  const rating = parseFloat(ratingStr);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    showToast('Invalid rating. Please enter a number between 1 and 5.', 'error');
    return;
  }

  fetch(`${API}/products/rateProduct.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ order_id: orderId, product_id: productId, rating })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast('Rating submitted! Thanks.', 'success');
        buildOrderHistory();
        buildProducts(); // refresh products data
      } else {
        showToast(data.message || 'Rating failed', 'error');
      }
    })
    .catch(() => showToast('Could not reach server', 'error'));
}

// ══════════════════════════════════════════
//  MESSAGES
// ══════════════════════════════════════════
function conversationName(email) {
  return sellerNameFromEmail(email);
}

function conversationFromPartner(partnerEmail, lastMsg = 'Start a conversation') {
  const name = conversationName(partnerEmail);
  return {
    id: partnerEmail,
    partner_email: partnerEmail,
    name,
    initial: name.charAt(0).toUpperCase(),
    lastMsg,
    messages: []
  };
}

function productSellerConversations(existing = []) {
  const byId = new Map(existing.map(c => [c.partner_email || c.id, c]));
  PRODUCTS.forEach(p => {
    const email = (p.seller_email || '').trim();
    if (!email || email === currentUser?.email || byId.has(email)) return;
    byId.set(email, conversationFromPartner(email));
  });
  return [...byId.values()];
}

function buildMessages() {
  if (!currentUser) return;
  const contacts = document.getElementById('msg-contacts');
  const main = document.getElementById('msg-main');
  contacts.innerHTML = '<div class="msg-empty-inline">Loading messages...</div>';

  fetch(`${API}/messages/getMessages.php?user_email=${encodeURIComponent(currentUser.email)}&role=${encodeURIComponent(currentRole)}`)
    .then(r => r.json())
    .then(data => {
      const backendConversations = data.success ? data.conversations.map(c =>
        conversationFromPartner(c.partner_email, c.last_message || 'Start a conversation')
      ) : [];

      CONVERSATIONS = currentRole === 'buyer'
        ? productSellerConversations(backendConversations)
        : backendConversations;

      if (!CONVERSATIONS.length) {
        contacts.innerHTML = currentRole === 'seller'
          ? '<div class="msg-empty-inline">No buyer messages yet.</div>'
          : '<div class="msg-empty-inline">No seller messages yet.</div>';
        if (main) main.innerHTML = '<div class="msg-empty">No conversations yet</div>';
        return;
      }

      contacts.innerHTML = CONVERSATIONS.map((c, i) => `
        <div class="msg-contact" onclick="openConversation(${i})">
          <div class="msg-avatar">${escapeHTML(c.initial)}</div>
          <div>
            <div class="msg-contact-name">${escapeHTML(c.name)}</div>
            <div class="msg-contact-last">${escapeHTML(c.lastMsg)}</div>
          </div>
        </div>
      `).join('');

      if (activeConv === null || !CONVERSATIONS[activeConv]) {
        main.innerHTML = '<div class="msg-empty">Select a conversation</div>';
      } else {
        openConversation(activeConv);
      }
    })
    .catch(() => {
      contacts.innerHTML = '<div class="msg-empty-inline">Could not load messages.</div>';
    });
}

function openConversationForSeller(sellerId) {
  const id = String(sellerId || '').trim();
  if (!id) return;
  let index = CONVERSATIONS.findIndex(c => (c.partner_email || c.id) === id);
  if (index === -1) {
    CONVERSATIONS.push(conversationFromPartner(id));
    index = CONVERSATIONS.length - 1;
  }
  switchTab('tab-messages');
  openConversation(index);
}

function loadConversationMessages(conv) {
  return fetch(`${API}/messages/getMessages.php?user_email=${encodeURIComponent(currentUser.email)}&role=${encodeURIComponent(currentRole)}&partner_email=${encodeURIComponent(conv.partner_email || conv.id)}`)
    .then(r => r.json())
    .then(data => {
      conv.messages = data.success ? data.messages.map(m => ({
        text: m.message,
        sent: m.sender_email === currentUser.email,
        time: new Date(m.created_at.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })) : [];
      return conv;
    });
}

function renderConversation(conv) {
  const main = document.getElementById('msg-main');
  main.innerHTML = `
    <div class="msg-header">
      <div class="msg-avatar">${escapeHTML(conv.initial)}</div>
      <div>
        <div style="font-weight:700;font-size:15px">${escapeHTML(conv.name)}</div>
        <div style="font-size:12px;color:var(--text-light)">${currentRole === 'seller' ? 'Buyer' : 'Seller'}</div>
      </div>
    </div>
    <div class="msg-messages" id="msg-msgs">
      ${conv.messages.length ? conv.messages.map(m => `
        <div style="display:flex;flex-direction:column;align-items:${m.sent ? 'flex-end' : 'flex-start'}">
          <div class="msg-bubble ${m.sent ? 'sent' : 'recv'}">${escapeHTML(m.text)}
            <div class="msg-time">${escapeHTML(m.time)}</div>
          </div>
        </div>
      `).join('') : '<div class="msg-empty">No messages yet.</div>'}
    </div>
    <div class="msg-input-row">
      <input class="msg-input" id="msg-input-box" placeholder="Type a message..." onkeydown="if(event.key==='Enter')sendMsg()">
      <button class="msg-send-btn" onclick="sendMsg()">Send</button>
    </div>
  `;
  const msgs = document.getElementById('msg-msgs');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function openConversation(i) {
  activeConv = i;
  document.querySelectorAll('.msg-contact').forEach((el, idx) => el.classList.toggle('active', idx === i));
  const conv = CONVERSATIONS[i];
  const main = document.getElementById('msg-main');
  if (!conv) {
    main.innerHTML = '<div class="msg-empty">Select a conversation</div>';
    return;
  }
  main.innerHTML = '<div class="msg-empty">Loading conversation...</div>';
  loadConversationMessages(conv).then(renderConversation).catch(() => {
    main.innerHTML = '<div class="msg-empty">Could not load conversation.</div>';
  });
}

function sendMsg() {
  const input = document.getElementById('msg-input-box');
  const text = input.value.trim();
  if (!text || activeConv === null || !CONVERSATIONS[activeConv]) return;
  const conv = CONVERSATIONS[activeConv];
  const partner = conv.partner_email || conv.id;
  const buyer_email = currentRole === 'seller' ? partner : currentUser.email;
  const seller_email = currentRole === 'seller' ? currentUser.email : partner;

  fetch(`${API}/messages/sendMessage.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ buyer_email, seller_email, sender_email: currentUser.email, message: text })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        input.value = '';
        conv.lastMsg = text;
        openConversation(activeConv);
        buildMessages();
      } else {
        showToast(data.message || 'Message failed', 'error');
      }
    })
    .catch(() => showToast('Could not reach server', 'error'));
}

// ══════════════════════════════════════════
//  SELLER INVENTORY
// ══════════════════════════════════════════
function buildSellerInventory() {
  const myProducts = PRODUCTS.filter(
    p => currentUser && p.seller_email === currentUser.email
  ); const el = document.getElementById('seller-inventory');
  if (!myProducts.length) {
    el.innerHTML = '<p style="color:var(--text-light)">No products yet. Use the Add tab to list your first product!</p>';
    document.getElementById('seller-avg-rating').textContent = '⭐ 0.0';
    return;
  }
  
  const totalRating = myProducts.reduce((sum, p) => sum + (p.rating || 0) * (p.reviews || 0), 0);
  const totalReviews = myProducts.reduce((sum, p) => sum + (p.reviews || 0), 0);
  const avgRating = totalReviews > 0 ? (totalRating / totalReviews).toFixed(1) : '0.0';
  const ratingEl = document.getElementById('seller-avg-rating');
  if (ratingEl) ratingEl.textContent = `⭐ ${avgRating}`;

  el.innerHTML = myProducts.map(p => {
    const freshClass = p.freshness >= 80 ? 'high' : p.freshness >= 50 ? 'mid' : 'low';
    return `
    <div class="inv-item">
      <div style="display:flex;align-items:center;gap:12px;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px">
          ${productVisual(p, 'inventory-product-visual')}
          <div>
            <div class="inv-name">${p.name}<span class="inv-badge ${freshnessBadgeClass(p.days_old)}">${freshnessLabel(p.days_old)}</span></div>
          </div>
        </div>
        <div class="inv-actions">
          <button class="inv-btn" onclick="openEditModal(${p.id})">✏️</button>
          <button class="inv-btn delete" onclick="confirmDeleteProduct(${p.id})">🗑️</button>
        </div>
      </div>
      <div class="inv-stats" style="margin:12px 0 8px">
        <div><div class="inv-stat-label">Price</div><div class="inv-stat-val price">$${discountedPrice(p.price, p.discount_percent).toFixed(2)}</div></div>
        <div><div class="inv-stat-label">Discount</div><div class="inv-stat-val">${clampDiscount(p.discount_percent)}%</div></div>
        <div><div class="inv-stat-label">Stock</div><div class="inv-stat-val">${p.stock} units</div></div>
        <div><div class="inv-stat-label">Age</div><div class="inv-stat-val">${freshnessLabel(p.days_old)}</div></div>
        <div><div class="inv-stat-label">Category</div><div class="inv-stat-val">${p.category}</div></div>
      </div>
      <div class="freshness-bar"><div class="freshness-fill ${freshClass}" style="width:${p.freshness}%"></div></div>
    </div>`;
  }).join('');
}

function buildSellerProductsList() {
  const myProducts = PRODUCTS.filter(
    p => currentUser && p.seller_email === currentUser.email
  ); const el = document.getElementById('seller-products-list');
  el.innerHTML = myProducts.length ? myProducts.map(p => `
    <div class="inv-item">
      <div style="display:flex;align-items:center;gap:12px;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px">
          ${productVisual(p, 'inventory-product-visual')}
          <div>
            <div class="inv-name">${p.name} <span class="inv-badge ${freshnessBadgeClass(p.days_old)}">${freshnessLabel(p.days_old)}</span></div>
            <div style="font-size:13px;color:var(--text-light)">${p.category} · $${discountedPrice(p.price, p.discount_percent).toFixed(2)} · ${clampDiscount(p.discount_percent)}% off · ${p.stock} units</div>
          </div>
        </div>
        <div class="inv-actions">
          <button class="inv-btn" onclick="openEditModal(${p.id})">✏️</button>
          <button class="inv-btn delete" onclick="confirmDeleteProduct(${p.id})">🗑️</button>
        </div>
      </div>
    </div>
  `).join('') : '<p style="color:var(--text-light)">No products listed yet. Use the Add tab to list your first product!</p>';
}

// ══════════════════════════════════════════
//  SELLER ORDERS (real from DB)
// ══════════════════════════════════════════
function buildSellerOrders() {
  if (!currentUser) return;
  const el = document.getElementById('seller-orders');
  el.innerHTML = '<p style="color:var(--text-light);font-size:13px;padding:20px 0">Loading...</p>';

  fetch(`${API}/orders/getOrders.php?seller_email=${encodeURIComponent(currentUser.email)}`)
    .then(r => r.json())
    .then(orders => {
      SELLER_ORDERS = orders;
      updateSellerDashboard(); // Update seller analytics and reports!
      if (!orders.length) {
        el.innerHTML = '<p style="color:var(--text-light);padding:20px 0;font-size:13px">No orders yet.</p>';
        return;
      }
      el.innerHTML = orders.map(o => `
      <div class="order-card">
        <div class="order-card-emoji">
<img
  src="${o.image_url || ''}"
  class="mini-order-image"
  onerror="this.src='https://via.placeholder.com/60?text=No+Image'"
></div>
        <div class="order-card-info">
          <div class="order-card-name">${o.product_name}</div>
          <div class="order-card-meta">Buyer: ${o.buyer_email} · Qty: ${o.quantity} · ${o.created_at.split(' ')[0]}</div>
          <span class="order-status status-${o.status.toLowerCase()}" style="margin-top:4px;display:inline-block">${o.status}</span>
        </div>
        <div class="order-card-price">$${parseFloat(o.total).toFixed(2)}</div>
        <div class="order-actions" style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-sm btn-sm-confirm" onclick="openSellerTracking(${o.id})">⚙️ Update Status & Tracking</button>
          <button class="btn-sm btn-sm-outline" style="border: 1.5px solid var(--cream-dark)" onclick="openConversationForBuyer('${escapeAttr(o.buyer_email)}')">💬 Chat</button>
        </div>
      </div>
    `).join('');
    })
    .catch(() => {
      el.innerHTML = '<p style="color:var(--text-light);font-size:13px">Could not load orders.</p>';
    });
}

function updateOrderStatus(orderId, status, btn) {
  fetch(`${API}/orders/updateOrderStatus.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id: orderId, status })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast(`Order marked as ${status}`, 'success');
        buildSellerOrders();
      } else {
        showToast('Update failed', 'error');
      }
    })
    .catch(() => showToast('Could not reach server', 'error'));
}

// ══════════════════════════════════════════
//  ADD PRODUCT
// ══════════════════════════════════════════


function updatePreview() {
  const name = document.getElementById('add-name').value || 'Product Name';
  const cat = document.getElementById('add-category').value || 'Category';
  const price = parseFloat(document.getElementById('add-price').value) || 0;
  const discount = clampDiscount(document.getElementById('add-discount')?.value);
  const finalPrice = discountedPrice(price, discount);
  const stock = parseInt(document.getElementById('add-stock').value) || 0;
  const harvestDate = document.getElementById('add-harvest-date')?.value;
  const daysOld = daysOldFromHarvest(harvestDate);

  document.getElementById('prev-name').textContent = name;
  document.getElementById('prev-cat').textContent = cat;
  document.getElementById('prev-price').textContent = `${finalPrice.toFixed(2)}`;
  const oldPriceEl = document.getElementById('prev-old-price');
  const discountEl = document.getElementById('prev-discount');
  if (oldPriceEl && discountEl) {
    oldPriceEl.style.display = discount ? '' : 'none';
    discountEl.style.display = discount ? '' : 'none';
    oldPriceEl.textContent = `${price.toFixed(2)}`;
    discountEl.textContent = `${discount}% off`;
  }
  const freshnessPreview = document.getElementById('prev-freshness');
  if (freshnessPreview) freshnessPreview.textContent = freshnessLabel(daysOld);
  document.getElementById('prev-stock').textContent = `${stock} units`;

  const delivery = document.getElementById('add-delivery')?.value || '2-3 Days';
  document.getElementById('prev-delivery').textContent = delivery;

  const media = document.getElementById('prev-media');

  if (addSelectedFiles.length > 0) {
    media.innerHTML = `
      <img
        src="${URL.createObjectURL(addSelectedFiles[0])}"
        class="product-image"
        onerror="this.parentElement.innerHTML='<div class=product-image-placeholder>No Image</div>'"
      >
    `;
  } else {
    media.innerHTML = `
      <div class="product-image-placeholder">
        No Image
      </div>
    `;
  }
}

function listProduct() {
  const name = document.getElementById('add-name').value.trim();
  const category = document.getElementById('add-category').value.trim();
  const price = document.getElementById('add-price').value;
  const discount_percent = clampDiscount(document.getElementById('add-discount').value);
  const stock = document.getElementById('add-stock').value;
  const description = document.getElementById('add-desc').value;
  const delivery_time = document.getElementById('add-delivery').value.trim() || '2-3 Days';
  const harvest_date = document.getElementById('add-harvest-date').value;

  if (!name) { showToast('Please enter product name', 'error'); return; }
  if (!category) { showToast('Please enter product category', 'error'); return; }
  if (!price) { showToast('Please enter product price', 'error'); return; }

  // Build FormData for multipart file upload to PHP
  const formData = new FormData();
  formData.append('name', name);
  formData.append('category', category);
  formData.append('price', price);
  formData.append('discount_percent', discount_percent);
  formData.append('stock', stock);
  formData.append('description', description);
  formData.append('delivery_time', delivery_time);
  formData.append('harvest_date', harvest_date);
  formData.append('seller_email', currentUser.email);

  addSelectedFiles.forEach(file => {
    formData.append('images[]', file);
  });

  // Display upload progress bar
  const progressContainer = document.getElementById('add-upload-progress');
  progressContainer.innerHTML = `
    <div style="font-size:12px;margin: 10px 0 4px;">Uploading to server... <span id="add-progress-text">0%</span></div>
    <div class="progress-bar-inner" style="height:8px;background:var(--cream-dark);">
      <div class="progress-bar-fill" id="add-progress-bar" style="width:0%;height:100%;background:var(--green);"></div>
    </div>
  `;

  submitFormWithProgress(`${API}/products/addProduct.php`, formData,
    (percent) => {
      document.getElementById('add-progress-text').textContent = `${percent}%`;
      document.getElementById('add-progress-bar').style.width = `${percent}%`;
    },
    (data) => {
      progressContainer.innerHTML = '';
      if (data.success) {
        showToast(data.message, 'success');
        buildProducts();
        // Clear form
        document.getElementById('add-name').value = '';
        document.getElementById('add-category').value = '';
        document.getElementById('add-price').value = '';
        document.getElementById('add-discount').value = '';
        document.getElementById('add-stock').value = '';
        document.getElementById('add-desc').value = '';
        document.getElementById('add-delivery').value = '';
        document.getElementById('add-harvest-date').value = '';
        addSelectedFiles = [];
        document.getElementById('add-image-previews').innerHTML = '';
        updatePreview();
      } else {
        showToast(data.message || 'Failed to add product', 'error');
      }
    },
    (err) => {
      progressContainer.innerHTML = '';
      showToast(`Upload failed: ${err}`, 'error');
    }
  );
}

// ══════════════════════════════════════════
//  EDIT PRODUCT MODAL
// ══════════════════════════════════════════
function openEditModal(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  editTarget = id;

  // Fill the edit modal fields
  document.getElementById('edit-name').value = p.name;
  document.getElementById('edit-category').value = p.category;
  document.getElementById('edit-price').value = p.price;
  document.getElementById('edit-discount').value = clampDiscount(p.discount_percent);
  document.getElementById('edit-stock').value = p.stock;
  document.getElementById('edit-harvest-date').value = p.harvest_date ? p.harvest_date.substring(0, 10) : '';
  document.getElementById('edit-description').value = p.description || '';
  document.getElementById('edit-delivery').value = p.delivery_time || '2-3 Days';

  // Load existing images and reset select files buffer
  editUploadedUrls = p.images ? [...p.images] : [];
  editSelectedFiles = [];
  renderEditImages();

  document.getElementById('editModal').classList.add('open');
}

function renderEditImages() {
  const container = document.getElementById('edit-image-list-container');
  container.innerHTML = editUploadedUrls.map((url, index) => {
    const boxId = `edit-img-box-${index}`;
    return `
      <div class="preview-item-box" id="${boxId}">
        <img src="${escapeAttr(url)}" alt="Preview">
        <button type="button" class="btn-delete-preview" onclick="deleteEditImage('${escapeAttr(url)}', '${boxId}')">✕</button>
      </div>
    `;
  }).join('');
}

function deleteEditImage(url, boxId) {
  // Simply remove the image from the list of kept URLs. The backend will clean it up on save!
  editUploadedUrls = editUploadedUrls.filter(u => u !== url);
  document.getElementById(boxId)?.remove();
}

function saveEdit() {
  const name = document.getElementById('edit-name').value.trim();
  const category = document.getElementById('edit-category').value;
  const price = document.getElementById('edit-price').value;
  const discount_percent = clampDiscount(document.getElementById('edit-discount').value);
  const stock = document.getElementById('edit-stock').value;
  const harvest_date = document.getElementById('edit-harvest-date').value;
  const description = document.getElementById('edit-description').value.trim();
  const delivery_time = document.getElementById('edit-delivery').value.trim() || '2-3 Days';

  if (!name || !price) { showToast('Name and price are required', 'error'); return; }

  // Submit via FormData for file uploading in backend/updateProduct.php
  const formData = new FormData();
  formData.append('id', editTarget);
  formData.append('name', name);
  formData.append('category', category);
  formData.append('price', price);
  formData.append('discount_percent', discount_percent);
  formData.append('stock', stock);
  formData.append('harvest_date', harvest_date);
  formData.append('description', description);
  formData.append('delivery_time', delivery_time);
  formData.append('existing_image_urls', JSON.stringify(editUploadedUrls));

  editSelectedFiles.forEach(file => {
    formData.append('images[]', file);
  });

  const progressContainer = document.getElementById('edit-upload-progress');
  progressContainer.innerHTML = `
    <div style="font-size:12px;margin: 10px 0 4px;">Uploading edits... <span id="edit-progress-text">0%</span></div>
    <div class="progress-bar-inner" style="height:8px;background:var(--cream-dark);">
      <div class="progress-bar-fill" id="edit-progress-bar" style="width:0%;height:100%;background:var(--green);"></div>
    </div>
  `;

  submitFormWithProgress(`${API}/products/updateProduct.php`, formData,
    (percent) => {
      document.getElementById('edit-progress-text').textContent = `${percent}%`;
      document.getElementById('edit-progress-bar').style.width = `${percent}%`;
    },
    (data) => {
      progressContainer.innerHTML = '';
      if (data.success) {
        showToast('Product updated!', 'success');
        buildProducts();
        closeEditModal();
      } else {
        showToast(data.message || 'Update failed', 'error');
      }
    },
    (err) => {
      progressContainer.innerHTML = '';
      showToast(`Update failed: ${err}`, 'error');
    }
  );
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
  editTarget = null;
}

// ══════════════════════════════════════════
//  ADMIN
// ══════════════════════════════════════════


function buildAdminAnalytics() {
  if (currentRole !== 'admin') return;
  const growthEl = document.getElementById('admin-seller-growth');
  const categoryEl = document.getElementById('admin-category-analysis');
  const sellerEl = document.getElementById('admin-seller-analysis');
  if (!growthEl || !categoryEl || !sellerEl) return;

  const sellers = ADMIN_USERS.filter(u => u.role === 'seller');
  const sellerProductCounts = sellers.map(seller => {
    const products = PRODUCTS.filter(p => p.seller_email === seller.email);
    const stock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    return { ...seller, products: products.length, stock };
  }).sort((a, b) => b.products - a.products);

  const maxProducts = Math.max(1, ...sellerProductCounts.map(s => s.products));
  growthEl.innerHTML = sellerProductCounts.length ? sellerProductCounts.slice(0, 6).map(s => `
    <div class="growth-row">
      <div class="growth-label"><strong>${escapeHTML(s.name)}</strong><span>${escapeHTML(s.email)}</span></div>
      <div class="growth-track"><div class="growth-fill" style="width:${Math.max(8, (s.products / maxProducts) * 100)}%"></div></div>
      <div class="growth-value">${s.products}</div>
    </div>
  `).join('') : '<p style="color:var(--text-light);font-size:13px">No sellers yet.</p>';

  const categoryCounts = getCategories().map(category => ({
    category,
    count: PRODUCTS.filter(p => p.category === category).length
  })).sort((a, b) => b.count - a.count);
  categoryEl.innerHTML = categoryCounts.length ? categoryCounts.map(c => `
    <div class="category-chip"><span>${escapeHTML(c.category)}</span><strong>${c.count}</strong></div>
  `).join('') : '<p style="color:var(--text-light);font-size:13px">No product categories yet.</p>';

  sellerEl.innerHTML = sellerProductCounts.length ? sellerProductCounts.slice(0, 5).map((s, index) => `
    <div class="seller-row">
      <div class="seller-rank">${index + 1}</div>
      <div class="seller-info"><strong>${escapeHTML(s.name)}</strong><span>${s.products} products · ${s.stock} stock units</span></div>
      <div class="seller-score">${Math.round((s.products / maxProducts) * 100)}%</div>
    </div>
  `).join('') : '<p style="color:var(--text-light);font-size:13px">No seller product data yet.</p>';
}

function buildAdminUsers() {
  if (currentRole !== 'admin') return;
  fetch(`${API}/users/getUsers.php`)
    .then(r => r.json())
    .then(users => {
      ADMIN_USERS = users;
      renderAdminUsers(users);
      // Update stat cards
      const buyers = users.filter(u => u.role === 'buyer').length;
      const sellers = users.filter(u => u.role === 'seller').length;
      document.querySelectorAll('.admin-stat-total').forEach(el => el.textContent = users.length);
      document.querySelectorAll('.admin-stat-buyers').forEach(el => el.textContent = buyers);
      document.querySelectorAll('.admin-stat-sellers').forEach(el => el.textContent = sellers);
      document.querySelectorAll('.admin-stat-active').forEach(el => el.textContent = users.length);
      buildAdminAnalytics();
    })
    .catch(() => renderAdminUsers([]));
}

function renderAdminUsers(list) {
  const tbody = document.getElementById('admin-users-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:40px">No users found.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(u => `
    <tr>
      <td class="td-user"><strong>${u.name}</strong><br><small>${u.email}</small></td>
      <td><span class="role-pill">${u.role === 'seller' ? '🧑‍🌾' : '🛒'} ${u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span></td>
      <td><span class="status-pill">Active</span></td>
      <td>${u.total_orders ?? 0}</td>
      <td>$${parseFloat(u.total_spending || 0).toFixed(2)}</td>
      <td><div class="actions-cell">
        <button class="action-btn del" onclick="deleteUser(${u.id}, '${u.name}')">🗑️</button>
      </div></td>
    </tr>
  `).join('');
}

function filterAdminUsers(search) {
  const tab = document.querySelector('.filter-tab.active')?.textContent || 'All';
  applyAdminFilter(tab, search);
}
function filterAdminTab(role, btn) {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const search = document.querySelector('.admin-search input')?.value || '';
  applyAdminFilter(role, search);
}
function applyAdminFilter(role, search = '') {
  let list = ADMIN_USERS;
  if (role !== 'All') list = list.filter(u => u.role === role.toLowerCase());
  if (search) list = list.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  renderAdminUsers(list);
}

function deleteUser(id, name) {

  if (!confirm(`Delete user "${name}"?`)) return;

  fetch(`${API}/users/deleteUser.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ id })
  })
    .then(r => r.json())
    .then(data => {

      if (data.success) {

        showToast(data.message, 'success');

        ADMIN_USERS = ADMIN_USERS.filter(u => u.id != id);

        renderAdminUsers(ADMIN_USERS);

      } else {

        showToast(data.message, 'error');

      }

    })
    .catch(() => {

      showToast('Delete failed', 'error');

    });
}

// ══════════════════════════════════════════
//  DELETE PRODUCT MODAL
// ══════════════════════════════════════════
function confirmDeleteProduct(id) {
  deleteTarget = id;
  document.getElementById('deleteModal').classList.add('open');
}

function confirmDelete() {
  if (!deleteTarget) return;
  
  fetch(`${API}/products/deleteProduct.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id: deleteTarget })
  })
    .then(r => r.json())
    .then(data => {
      showToast(data.message, data.success ? 'success' : 'error');
      if (data.success) buildProducts();
      closeModal();
    })
    .catch(() => showToast('Delete failed', 'error'));
}

function closeModal() {
  document.getElementById('deleteModal').classList.remove('open');
  deleteTarget = null;
}

// ══════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

// ══════════════════════════════════════════
//  LIVE HOMEPAGE HERO STATS
// ══════════════════════════════════════════
function loadSiteStats() {
  fetch(`${API}/analytics/getSiteStats.php`)
    .then(r => r.json())
    .then(data => {
      const pCount = document.getElementById('hero-product-count');
      const fCount = document.getElementById('hero-farmer-count');
      const oCount = document.getElementById('hero-order-count');
      if (pCount) pCount.textContent = data.total_products;
      if (fCount) fCount.textContent = data.total_farmers;
      if (oCount) oCount.textContent = data.total_orders;
    })
    .catch(() => {
      const pCount = document.getElementById('hero-product-count');
      if (pCount) pCount.textContent = PRODUCTS.length;
    });
}

// ══════════════════════════════════════════
//  SELLER MESSAGE LNK
// ══════════════════════════════════════════
function openConversationForBuyer(buyerEmail) {
  const email = String(buyerEmail || '').trim();
  if (!email) return;
  switchTab('tab-messages');
  let index = CONVERSATIONS.findIndex(c => (c.partner_email || c.id) === email);
  if (index === -1) {
    CONVERSATIONS.push(conversationFromPartner(email));
    index = CONVERSATIONS.length - 1;
    const contacts = document.getElementById('msg-contacts');
    if (contacts) {
      contacts.innerHTML = CONVERSATIONS.map((c, idx) => `
        <div class="msg-contact" onclick="openConversation(${idx})">
          <div class="msg-avatar">${escapeHTML(c.initial)}</div>
          <div>
            <div class="msg-contact-name">${escapeHTML(c.name)}</div>
            <div class="msg-contact-last">${escapeHTML(c.lastMsg)}</div>
          </div>
        </div>
      `).join('');
    }
  }
  openConversation(index);
}

// ══════════════════════════════════════════
//  PRODUCT DETAILS POPUP (BUYER)
// ══════════════════════════════════════════
let detailsSelectedProduct = null;
let detailsQty = 1;

function openProductDetails(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  detailsSelectedProduct = p;
  detailsQty = 1;

  document.getElementById('details-name').textContent = p.name;
  document.getElementById('details-cat-farm').textContent = `${p.category} · Sold by ${p.farm}`;
  
  const ratingRow = document.getElementById('details-rating-row');
  if (p.rating) {
    ratingRow.innerHTML = `<span class="card-stars">★</span> <strong>${p.rating.toFixed(1)}</strong> (${p.reviews} reviews)`;
  } else {
    ratingRow.innerHTML = `<span style="color:var(--text-light)">No ratings yet</span>`;
  }

  const discount = clampDiscount(p.discount_percent);
  const finalPrice = discountedPrice(p.price, discount);
  document.getElementById('details-price').textContent = `$${finalPrice.toFixed(2)}`;
  
  const oldPriceEl = document.getElementById('details-price-old');
  const discountEl = document.getElementById('details-discount');
  if (discount > 0) {
    oldPriceEl.style.display = '';
    discountEl.style.display = '';
    oldPriceEl.textContent = `$${p.price.toFixed(2)}`;
    discountEl.textContent = `${discount}% off`;
  } else {
    oldPriceEl.style.display = 'none';
    discountEl.style.display = 'none';
  }

  document.getElementById('details-delivery-pill').innerHTML = `🚚 Estimated Delivery: <strong>${p.delivery_time || '2-3 Days'}</strong>`;
  document.getElementById('details-desc-box').textContent = p.description || 'No description provided by the seller.';

  const stockEl = document.getElementById('details-stock-num');
  if (p.stock > 0) {
    stockEl.textContent = `In Stock (${p.stock} units left)`;
    stockEl.style.color = 'var(--green-dark)';
    document.getElementById('details-add-cart-btn').disabled = false;
    document.getElementById('details-buy-now-btn').disabled = false;
    document.getElementById('details-add-cart-btn').style.opacity = '1';
    document.getElementById('details-buy-now-btn').style.opacity = '1';
  } else {
    stockEl.textContent = 'Out of Stock';
    stockEl.style.color = 'var(--stale-badge)';
    document.getElementById('details-add-cart-btn').disabled = true;
    document.getElementById('details-buy-now-btn').disabled = true;
    document.getElementById('details-add-cart-btn').style.opacity = '0.5';
    document.getElementById('details-buy-now-btn').style.opacity = '0.5';
  }

  const imgWrap = document.getElementById('details-image-wrap');
  const thumbWrap = document.getElementById('details-thumbnails-wrap');
  
  const images = p.images && p.images.length > 0 ? p.images : (p.image_url ? [p.image_url] : []);
  
  if (images.length > 0) {
    imgWrap.innerHTML = `<img id="gallery-main-img" src="${escapeAttr(images[0])}" alt="${escapeAttr(p.name)}" onerror="this.parentElement.innerHTML='<div class=product-image-placeholder>No Image</div>'">`;
    
    if (images.length > 1) {
      thumbWrap.style.display = 'flex';
      thumbWrap.innerHTML = images.map((url, idx) => `
        <img src="${escapeAttr(url)}" class="gallery-thumb-item ${idx === 0 ? 'active' : ''}" onclick="changeGalleryImage('${escapeAttr(url)}', this)">
      `).join('');
    } else {
      thumbWrap.style.display = 'none';
    }
  } else {
    imgWrap.innerHTML = `<div class="product-image-placeholder">No Image</div>`;
    thumbWrap.style.display = 'none';
  }

  document.getElementById('details-qty-num').textContent = detailsQty;
  
  // Load comments, ratings & configure form
  loadProductReviews(p.id);

  document.getElementById('productDetailsModal').classList.add('open');
}

function closeProductDetails() {
  document.getElementById('productDetailsModal').classList.remove('open');
  detailsSelectedProduct = null;
}

function changeDetailsQty(delta) {
  if (!detailsSelectedProduct) return;
  const newQty = detailsQty + delta;
  if (newQty < 1) return;
  if (newQty > detailsSelectedProduct.stock) {
    showToast(`Only ${detailsSelectedProduct.stock} items left in stock`, 'error');
    return;
  }
  detailsQty = newQty;
  document.getElementById('details-qty-num').textContent = detailsQty;
}

function detailsAddToCart() {
  if (!detailsSelectedProduct) return;
  if (!currentUser) {
    landingGateAlert();
    return;
  }
  if (currentRole !== 'buyer') {
    showToast('Switch to Buyer to shop', 'error');
    return;
  }
  const p = detailsSelectedProduct;
  const existing = cart.find(c => c.id === p.id);
  const addQty = detailsQty;
  
  if (existing) {
    if (existing.qty + addQty > p.stock) {
      showToast(`Cannot add ${addQty} more. Stock limit: ${p.stock}`, 'error');
      return;
    }
    existing.qty += addQty;
  } else {
    cart.push({ ...p, price: discountedPrice(p.price, p.discount_percent), original_price: p.price, qty: addQty });
  }
  updateCartCount();
  filterProducts();
  showToast(`Added ${addQty} x ${p.name} to cart`, 'success');
  buildCart();
  closeProductDetails();
}

function detailsBuyNow() {
  if (!detailsSelectedProduct) return;
  if (!currentUser) {
    landingGateAlert();
    return;
  }
  if (currentRole !== 'buyer') {
    showToast('Switch to Buyer to shop', 'error');
    return;
  }
  const p = detailsSelectedProduct;
  cart = [{ ...p, price: discountedPrice(p.price, p.discount_percent), original_price: p.price, qty: detailsQty }];
  updateCartCount();
  buildCart();
  closeProductDetails();
  checkout();
}

function detailsChat() {
  if (!detailsSelectedProduct) return;
  if (!currentUser) {
    landingGateAlert();
    return;
  }
  if (currentRole !== 'buyer') {
    showToast('Switch to Buyer to chat', 'error');
    return;
  }
  const email = detailsSelectedProduct.seller_email || detailsSelectedProduct.farm;
  closeProductDetails();
  openConversationForSeller(email);
}

// ══════════════════════════════════════════
//  SHOPIFY-STYLE ORDER TRACKING (BUYER)
// ══════════════════════════════════════════
function openOrderTracking(orderId) {
  const o = ORDER_HISTORY.find(x => x.id === orderId);
  if (!o) return;

  document.getElementById('track-order-id').textContent = `#${o.id}`;
  document.getElementById('track-est-delivery').textContent = o.estimated_delivery || 'Not updated yet';
  
  const statusBadge = document.getElementById('track-status-badge');
  statusBadge.className = `order-status status-${o.status.toLowerCase()}`;
  statusBadge.textContent = o.status;

  const steps = ['Pending', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];
  const currentStatusIndex = steps.indexOf(o.status);

  const timelineBar = document.getElementById('track-timeline-bar');
  timelineBar.className = 'tracking-timeline';
  
  if (currentStatusIndex >= 1 && o.status !== 'Cancelled') {
    timelineBar.classList.add(`completed-to-${currentStatusIndex}`);
  }

  const stepIds = ['step-placed', 'step-confirmed', 'step-shipped', 'step-out', 'step-delivered'];
  stepIds.forEach((stepId, idx) => {
    const el = document.getElementById(stepId);
    if (!el) return;
    
    el.classList.remove('active', 'completed');
    
    const timeEl = document.getElementById(stepId.replace('step', 'time'));
    if (timeEl) {
      if (idx === 0) timeEl.textContent = o.created_at;
      else if (idx <= currentStatusIndex && o.status !== 'Cancelled') timeEl.textContent = 'Updated recently';
      else timeEl.textContent = '–';
    }

    if (o.status === 'Cancelled') {
      if (idx === 0) el.classList.add('completed');
      return;
    }

    if (idx < currentStatusIndex) {
      el.classList.add('completed');
      const icon = el.querySelector('.tracking-icon');
      if (icon) icon.textContent = '✓';
    } else if (idx === currentStatusIndex) {
      el.classList.add('active');
      const icon = el.querySelector('.tracking-icon');
      if (icon) icon.textContent = String(idx + 1);
    } else {
      const icon = el.querySelector('.tracking-icon');
      if (icon) icon.textContent = String(idx + 1);
    }
  });

  const logsContainer = document.getElementById('tracking-logs-container');
  let logsHtml = `
    <div class="tracking-log-item">
      <span>📍 Order Placed successfully</span>
      <span style="color:var(--text-light)">${o.created_at}</span>
    </div>
  `;

  if (o.status !== 'Pending' && o.status !== 'Cancelled') {
    logsHtml += `
      <div class="tracking-log-item">
        <span>✅ Order Confirmed & preparing for shipment</span>
        <span style="color:var(--text-light)">Status: Confirmed</span>
      </div>
    `;
  }

  if (o.tracking_location) {
    logsHtml += `
      <div class="tracking-log-item">
        <span>🚚 ${o.tracking_location}</span>
        <span style="color:var(--text-light)">Current Location</span>
      </div>
    `;
  }

  if (o.status === 'Delivered') {
    logsHtml += `
      <div class="tracking-log-item">
        <span>🎉 Package delivered at destination</span>
        <span style="color:var(--text-light)">Delivered</span>
      </div>
    `;
  } else if (o.status === 'Cancelled') {
    logsHtml += `
      <div class="tracking-log-item" style="color:var(--stale-badge)">
        <span>❌ Order was cancelled</span>
        <span style="color:var(--text-light)">Cancelled</span>
      </div>
    `;
  }

  logsContainer.innerHTML = logsHtml;
  document.getElementById('trackingModal').classList.add('open');
}

function closeTrackingModal() {
  document.getElementById('trackingModal').classList.remove('open');
}

// ══════════════════════════════════════════
//  SELLER ORDER STATUS UPDATE MODAL
// ══════════════════════════════════════════
let sellerActiveUpdateOrderId = null;

function openSellerTracking(orderId) {
  const o = SELLER_ORDERS.find(x => x.id === orderId);
  if (!o) return;

  sellerActiveUpdateOrderId = orderId;
  document.getElementById('update-track-status').value = o.status;
  document.getElementById('update-track-delivery').value = o.estimated_delivery || '';
  document.getElementById('update-track-location').value = o.tracking_location || '';

  document.getElementById('sellerTrackingModal').classList.add('open');
}

function closeSellerTrackingModal() {
  document.getElementById('sellerTrackingModal').classList.remove('open');
  sellerActiveUpdateOrderId = null;
}

function saveOrderStatusUpdate() {
  if (!sellerActiveUpdateOrderId) return;
  const status = document.getElementById('update-track-status').value;
  const estimated_delivery = document.getElementById('update-track-delivery').value.trim();
  const tracking_location = document.getElementById('update-track-location').value.trim();

  fetch(`${API}/orders/updateOrderStatus.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id: sellerActiveUpdateOrderId,
      status,
      estimated_delivery,
      tracking_location
    })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast(`Tracking details updated!`, 'success');
        buildSellerOrders();
        closeSellerTrackingModal();
      } else {
        showToast('Tracking update failed', 'error');
      }
    })
    .catch(() => showToast('Could not reach server', 'error'));
}

// ══════════════════════════════════════════
//  SELLER DASHBOARD ANALYTICS & REPORTS
// ══════════════════════════════════════════
let sellerReportsTab = 'daily';

function updateSellerDashboard() {
  if (!currentUser || !SELLER_ORDERS) return;

  const activeOrders = SELLER_ORDERS.filter(o => o.status !== 'Cancelled');
  document.getElementById('seller-orders-count').textContent = SELLER_ORDERS.length;

  const totalRevenue = activeOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  document.getElementById('seller-sales-revenue').textContent = `$${totalRevenue.toFixed(2)}`;

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const monthlyOrders = activeOrders.filter(o => o.created_at.startsWith(currentMonthStr));
  const monthlyRevenue = monthlyOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  
  document.getElementById('seller-monthly-sales').textContent = `$${monthlyRevenue.toFixed(2)}`;
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById('seller-monthly-sales-sub').textContent = `Sales in ${monthNames[today.getMonth()]}`;

  const salesByProduct = {};
  let totalDiscountLoss = 0;

  activeOrders.forEach(o => {
    const pId = o.product_id;
    if (!pId) return;

    if (!salesByProduct[pId]) {
      salesByProduct[pId] = {
        name: o.product_name,
        qty: 0,
        revenue: 0
      };
    }
    salesByProduct[pId].qty += parseInt(o.quantity || 0);
    salesByProduct[pId].revenue += parseFloat(o.total || 0);

    const prod = PRODUCTS.find(p => p.id === pId);
    if (prod && prod.discount_percent > 0) {
      const originalPrice = prod.price;
      const unitDiscount = originalPrice - o.unit_price;
      totalDiscountLoss += unitDiscount * o.quantity;
    }
  });

  document.getElementById('seller-discount-loss').textContent = `$${totalDiscountLoss.toFixed(2)}`;

  let bestProdName = 'None';
  let bestProdQty = 0;
  let worstProdName = 'None';
  let worstProdQty = Infinity;

  const sellerProducts = PRODUCTS.filter(p => p.seller_email === currentUser.email);
  
  sellerProducts.forEach(p => {
    const salesInfo = salesByProduct[p.id];
    const qtySold = salesInfo ? salesInfo.qty : 0;
    
    if (qtySold > bestProdQty) {
      bestProdQty = qtySold;
      bestProdName = p.name;
    }

    if (qtySold < worstProdQty) {
      worstProdQty = qtySold;
      worstProdName = p.name;
    }
  });

  if (sellerProducts.length === 0) {
    worstProdQty = 0;
  }

  document.getElementById('seller-best-sell').textContent = bestProdName;
  document.getElementById('seller-best-sell-qty').textContent = `${bestProdQty} units sold`;
  document.getElementById('seller-worst-sell').textContent = worstProdName;
  document.getElementById('seller-worst-sell-qty').textContent = `${worstProdQty} units sold`;

  renderReportsTable();
}

function switchReportTab(period, btn) {
  sellerReportsTab = period;
  document.querySelectorAll('.reports-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReportsTable();
}

function renderReportsTable() {
  const header = document.getElementById('reports-table-header');
  const body = document.getElementById('reports-table-body');
  if (!header || !body) return;

  const activeOrders = SELLER_ORDERS.filter(o => o.status !== 'Cancelled');
  
  if (sellerReportsTab === 'daily') {
    header.innerHTML = `
      <th>Date</th>
      <th>Orders</th>
      <th>Items Sold</th>
      <th>Revenue</th>
      <th>Status</th>
    `;

    const dailyData = {};
    activeOrders.forEach(o => {
      const date = o.created_at.split(' ')[0];
      if (!dailyData[date]) {
        dailyData[date] = { count: 0, qty: 0, revenue: 0 };
      }
      dailyData[date].count++;
      dailyData[date].qty += parseInt(o.quantity);
      dailyData[date].revenue += parseFloat(o.total);
    });

    const dates = Object.keys(dailyData).sort().reverse();
    if (!dates.length) {
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:20px">No daily sales data available.</td></tr>`;
      return;
    }

    body.innerHTML = dates.map((date) => {
      const data = dailyData[date];
      return `
        <tr>
          <td><strong>${date}</strong></td>
          <td>${data.count} orders</td>
          <td>${data.qty} units</td>
          <td style="color:var(--green-dark);font-weight:700">$${data.revenue.toFixed(2)}</td>
          <td><span class="trend-pill trend-up">✓ Active</span></td>
        </tr>
      `;
    }).join('');

  } else if (sellerReportsTab === 'monthly') {
    header.innerHTML = `
      <th>Month</th>
      <th>Orders</th>
      <th>Items Sold</th>
      <th>Revenue</th>
      <th>Performance</th>
    `;

    const monthlyData = {};
    activeOrders.forEach(o => {
      const month = o.created_at.substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { count: 0, qty: 0, revenue: 0 };
      }
      monthlyData[month].count++;
      monthlyData[month].qty += parseInt(o.quantity);
      monthlyData[month].revenue += parseFloat(o.total);
    });

    const months = Object.keys(monthlyData).sort().reverse();
    if (!months.length) {
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:20px">No monthly sales data available.</td></tr>`;
      return;
    }

    body.innerHTML = months.map(month => {
      const data = monthlyData[month];
      return `
        <tr>
          <td><strong>${month}</strong></td>
          <td>${data.count} orders</td>
          <td>${data.qty} units</td>
          <td style="color:var(--green-dark);font-weight:700">$${data.revenue.toFixed(2)}</td>
          <td><span class="trend-pill trend-up">📈 Growth</span></td>
        </tr>
      `;
    }).join('');

  } else if (sellerReportsTab === 'yearly') {
    header.innerHTML = `
      <th>Year</th>
      <th>Orders</th>
      <th>Items Sold</th>
      <th>Revenue</th>
      <th>Performance</th>
    `;

    const yearlyData = {};
    activeOrders.forEach(o => {
      const year = o.created_at.substring(0, 4);
      if (!yearlyData[year]) {
        yearlyData[year] = { count: 0, qty: 0, revenue: 0 };
      }
      yearlyData[year].count++;
      yearlyData[year].qty += parseInt(o.quantity);
      yearlyData[year].revenue += parseFloat(o.total);
    });

    const years = Object.keys(yearlyData).sort().reverse();
    if (!years.length) {
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:20px">No yearly sales data available.</td></tr>`;
      return;
    }

    body.innerHTML = years.map(year => {
      const data = yearlyData[year];
      return `
        <tr>
          <td><strong>${year}</strong></td>
          <td>${data.count} orders</td>
          <td>${data.qty} units</td>
          <td style="color:var(--green-dark);font-weight:700">$${data.revenue.toFixed(2)}</td>
          <td><span class="trend-pill trend-up">👑 Stable</span></td>
        </tr>
      `;
    }).join('');
  }
}

// ══════════════════════════════════════════
//  LANDING CUSTOMIZER & GATE ALERTS
// ══════════════════════════════════════════
function landingGateAlert() {
  showToast('Please login to browse categories, view product details, or checkout items.', 'error');
  showPage('page-login');
}

function loadLandingConfig() {
  fetch(`${API}/analytics/getLandingConfig.php`)
    .then(r => r.json())
    .then(data => {
      if (data.success && data.config) {
        const c = data.config;
        
        // Update landing UI
        const heroTitle = document.getElementById('landing-hero-title');
        const heroSubtitle = document.getElementById('landing-hero-subtitle');
        const heroSec = document.getElementById('landing-hero-section');
        const clienteTitle = document.getElementById('landing-cliente-title');
        const clienteDesc = document.getElementById('landing-cliente-desc');
        const producerTitle = document.getElementById('landing-producer-title');
        const producerDesc = document.getElementById('landing-producer-desc');

        if (heroTitle) heroTitle.textContent = c.hero_title || 'At AgroMarket your products speak for themselves';
        if (heroSubtitle) heroSubtitle.textContent = c.hero_subtitle || 'The online marketplace for farm-fresh agricultural products.';
        if (heroSec && c.hero_image) {
          heroSec.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('${c.hero_image}')`;
        }
        const marketHero = document.querySelector('.market-hero');
        if (marketHero && c.hero_image) {
          marketHero.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('${c.hero_image}')`;
        }
        if (clienteTitle) clienteTitle.textContent = c.cliente_title || 'Cliente';
        if (clienteDesc) clienteDesc.textContent = c.cliente_desc || '';
        if (producerTitle) producerTitle.textContent = c.producer_title || 'Producer';
        if (producerDesc) producerDesc.textContent = c.producer_desc || '';

        // Update admin input settings
        if (currentRole === 'admin') {
          const adminHeroTitle = document.getElementById('admin-hero-title');
          const adminHeroSubtitle = document.getElementById('admin-hero-subtitle');
          const adminHeroImage = document.getElementById('admin-hero-image');
          const adminClienteTitle = document.getElementById('admin-cliente-title');
          const adminProducerTitle = document.getElementById('admin-producer-title');
          const adminClienteDesc = document.getElementById('admin-cliente-desc');
          const adminProducerDesc = document.getElementById('admin-producer-desc');

          if (adminHeroTitle) adminHeroTitle.value = c.hero_title || '';
          if (adminHeroSubtitle) adminHeroSubtitle.value = c.hero_subtitle || '';
          if (adminHeroImage) adminHeroImage.value = c.hero_image || 'hero.png';
          if (adminClienteTitle) adminClienteTitle.value = c.cliente_title || 'Cliente';
          if (adminProducerTitle) adminProducerTitle.value = c.producer_title || 'Producer';
          if (adminClienteDesc) adminClienteDesc.value = c.cliente_desc || '';
          if (adminProducerDesc) adminProducerDesc.value = c.producer_desc || '';
        }
      }
    })
    .catch(err => console.log("Failed to load landing config:", err));
}

function saveAdminLandingConfig() {
  const hero_title = document.getElementById('admin-hero-title').value.trim();
  const hero_subtitle = document.getElementById('admin-hero-subtitle').value.trim();
  const hero_image = document.getElementById('admin-hero-image').value.trim();
  const cliente_title = document.getElementById('admin-cliente-title').value.trim();
  const producer_title = document.getElementById('admin-producer-title').value.trim();
  const cliente_desc = document.getElementById('admin-cliente-desc').value.trim();
  const producer_desc = document.getElementById('admin-producer-desc').value.trim();

  fetch(`${API}/analytics/saveLandingConfig.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      hero_title, hero_subtitle, hero_image,
      cliente_title, producer_title,
      cliente_desc, producer_desc
    })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast('Landing page theme configuration saved successfully! 🎨', 'success');
        loadLandingConfig();
      } else {
        showToast('Failed to save configuration', 'error');
      }
    })
    .catch(() => showToast('Could not save configuration details', 'error'));
}

function buildLandingProductsAndProducers() {
  fetch(`${API}/products/getProducts.php`)
    .then(r => r.json())
    .then(data => {
      PRODUCTS = data.map(p => ({
        id: parseInt(p.id),
        name: p.name,
        farm: p.seller_email ? p.seller_email.split('@')[0] : 'Local Farm',
        category: p.category,
        price: parseFloat(p.price),
        discount_percent: clampDiscount(p.discount_percent),
        stock: parseInt(p.stock),
        harvest_date: p.harvest_date || '',
        days_old: daysOldFromHarvest(p.harvest_date),
        freshness: freshnessScoreFromDays(daysOldFromHarvest(p.harvest_date)),
        rating: p.rating ? parseFloat(p.rating) : null,
        reviews: parseInt(p.reviews || 0),
        fresh: daysOldFromHarvest(p.harvest_date) <= 1,
        seller_email: p.seller_email || '',
        image_url: p.image_url || '',
        description: p.description || '',
        delivery_time: p.delivery_time || '2-3 Days'
      }));
      renderLandingPageContent();
    })
    .catch(err => console.log("Error loading landing products:", err));
}

let currentLandingCategory = 'All';

function filterLandingByCategory(categoryName) {
  // If the user clicks the already active category, toggle back to 'All'
  if (currentLandingCategory === categoryName) {
    currentLandingCategory = 'All';
  } else {
    currentLandingCategory = categoryName;
  }

  // Update category cards active styling
  const cards = document.querySelectorAll('.landing-cat-card');
  cards.forEach(card => {
    const nameEl = card.querySelector('.lcc-name');
    if (nameEl && nameEl.textContent === currentLandingCategory) {
      card.style.borderColor = 'var(--green)';
      card.style.background = '#f0f7ee';
    } else {
      card.style.borderColor = 'transparent';
      card.style.background = 'white';
    }
  });

  // Update heading and products list
  const heading = document.getElementById('landing-products-heading');
  if (heading) {
    heading.textContent = currentLandingCategory === 'All' ? 'Recently Added' : currentLandingCategory;
  }

  renderLandingPageContent();
}

function handleLandingAddToCart(productId) {
  if (!currentUser) {
    landingGateAlert();
    return;
  }
  if (currentRole === 'buyer') {
    addToCart(productId);
  } else {
    showToast('Switch to Buyer role to add items to cart.', 'error');
  }
}

function clickLandingCart() {
  if (!currentUser) {
    landingGateAlert();
    return;
  }
  if (currentRole === 'buyer') {
    showPage('page-app');
    switchTab('tab-cart');
  } else {
    showToast('Sellers and Admins do not have a shopping cart.', 'error');
  }
}

function categoryEmoji(catName) {
  const map = {
    'vegetables': '🥬',
    'vegetable': '🥬',
    'tubers': '🥔',
    'tuber': '🥔',
    'seeds': '🌱',
    'seed': '🌱',
    'shoots': '🌿',
    'shoot': '🌿',
    'dry fruits': '🥜',
    'dry fruit': '🥜',
    'fruit': '🍎',
    'fruits': '🍎',
    'cereals': '🌾',
    'cereal': '🌾',
    'honey': '🍯',
    'fish': '🐟',
    'meat': '🥩'
  };
  return map[catName.toLowerCase().trim()] || '🌾';
}

function renderLandingPageContent() {
  // Dynamic categories update based on sellers product inclusions
  const catList = document.getElementById('landing-categories-list');
  if (catList) {
    const categories = getCategories();
    catList.innerHTML = categories.map(cat => `
      <div class="landing-cat-card" onclick="filterLandingByCategory('${escapeAttr(cat)}')" style="${currentLandingCategory === cat ? 'border-color: var(--green); background: #f0f7ee;' : ''}">
        <span class="lcc-emoji">${categoryEmoji(cat)}</span>
        <span class="lcc-name">${escapeHTML(cat)}</span>
      </div>
    `).join('');
  }

  const recentContainer = document.getElementById('landing-recent-products');
  if (recentContainer) {
    let filteredList = PRODUCTS;
    if (typeof currentLandingCategory !== 'undefined' && currentLandingCategory !== 'All') {
      filteredList = PRODUCTS.filter(p => p.category === currentLandingCategory);
    }
    
    // Slice top 6 matching products for landing view
    const recentList = filteredList.slice(0, 6);
    if (!recentList.length) {
      recentContainer.innerHTML = '<p style="color:var(--text-light);grid-column:1/-1;text-align:center;padding:40px 0">No products listed in this category yet.</p>';
    } else {
      recentContainer.innerHTML = recentList.map(p => `
        <div class="product-card" onclick="openProductDetails(${p.id})">
          <div class="card-badges">
            <span class="${freshnessBadgeClass(p.days_old)}">${freshnessLabel(p.days_old)}</span>
          </div>
          ${productVisual(p, 'card-emoji')}
          <div class="card-name">${p.name}</div>
          <div class="card-farm">${p.farm}</div>
          <div style="display:flex;align-items:baseline;gap:4px">
            ${priceMarkup(p)}
          </div>
          <div class="card-meta">
            <span>${p.stock} left</span>
            <span>${p.rating ? `★ ${p.rating} (${p.reviews})` : freshnessLabel(p.days_old)}</span>
          </div>
          <button class="btn-add-cart" onclick="event.stopPropagation(); handleLandingAddToCart(${p.id})">Add to Cart</button>
        </div>
      `).join('');
    }
  }

  // Producer profiles
  const producerContainer = document.getElementById('landing-producers-list');
  if (producerContainer) {
    const producers = {};
    PRODUCTS.forEach(p => {
      if (!p.seller_email) return;
      if (!producers[p.seller_email]) {
        producers[p.seller_email] = {
          email: p.seller_email,
          name: p.farm,
          ratings: [],
          reviews: 0,
          count: 0
        };
      }
      producers[p.seller_email].count++;
      if (p.rating) {
        producers[p.seller_email].ratings.push(p.rating);
        producers[p.seller_email].reviews += p.reviews;
      }
    });

    const list = Object.values(producers);
    if (!list.length) {
      producerContainer.innerHTML = '<p style="color:var(--text-light);grid-column:1/-1;text-align:center">No farmers registered.</p>';
    } else {
      producerContainer.innerHTML = list.map(seller => {
        const avg = seller.ratings.length
          ? (seller.ratings.reduce((s, r) => s + r, 0) / seller.ratings.length).toFixed(1)
          : '0.0';
        const ratingStr = parseFloat(avg) > 0 ? `⭐ ${avg} (${seller.reviews} reviews)` : '⭐ No reviews yet';
        return `
          <div class="producer-profile-card" onclick="landingGateAlert()">
            <div class="ppc-avatar">${seller.name.charAt(0).toUpperCase()}</div>
            <div class="ppc-name">${seller.name}</div>
            <div class="ppc-title">Local Fields Farmer</div>
            <div class="ppc-rating">${ratingStr}</div>
            <div class="ppc-stats">
              <strong>${seller.count}</strong> products listed
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function filterLandingProducts(search) {
  if (!search) {
    renderLandingPageContent();
    return;
  }
  const term = search.toLowerCase();
  const filtered = PRODUCTS.filter(p => p.name.toLowerCase().includes(term) || p.farm.toLowerCase().includes(term));
  const recentContainer = document.getElementById('landing-recent-products');
  if (recentContainer) {
    if (!filtered.length) {
      recentContainer.innerHTML = '<p style="color:var(--text-light);grid-column:1/-1;text-align:center;padding:40px 0">No search results found.</p>';
    } else {
      recentContainer.innerHTML = filtered.slice(0, 6).map(p => `
        <div class="product-card" onclick="openProductDetails(${p.id})">
          <div class="card-badges">
            <span class="${freshnessBadgeClass(p.days_old)}">${freshnessLabel(p.days_old)}</span>
          </div>
          ${productVisual(p, 'card-emoji')}
          <div class="card-name">${p.name}</div>
          <div class="card-farm">${p.farm}</div>
          <div style="display:flex;align-items:baseline;gap:4px">
            ${priceMarkup(p)}
          </div>
          <div class="card-meta">
            <span>${p.stock} left</span>
            <span>${p.rating ? `★ ${p.rating} (${p.reviews})` : freshnessLabel(p.days_old)}</span>
          </div>
          <button class="btn-add-cart" onclick="event.stopPropagation(); handleLandingAddToCart(${p.id})">Add to Cart</button>
        </div>
      `).join('');
    }
  }
}

// ══════════════════════════════════════════
//  INIT — restore session or show landing
// ══════════════════════════════════════════
let editUploadedUrls = [];
let selectedStarRating = 5;

function submitFormWithProgress(url, formData, onProgress, onLoad, onError) {
  const xhr = new XMLHttpRequest();
  
  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      onProgress(percent);
    }
  };
  
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          onLoad(data);
        } catch (e) {
          onError("Invalid response from server");
        }
      } else {
        onError(`Server error: ${xhr.status}`);
      }
    }
  };
  
  xhr.open("POST", url, true);
  xhr.send(formData);
}

function setupImageUploadHandlers() {
  const addInput = document.getElementById('add-images-input');
  if (addInput) {
    addInput.addEventListener('change', function(e) {
      const files = Array.from(e.target.files);
      const container = document.getElementById('add-image-previews');
      
      files.forEach(file => {
        addSelectedFiles.push(file);
        
        const previewId = `add-prev-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const box = document.createElement('div');
        box.className = 'preview-item-box';
        box.id = previewId;
        box.innerHTML = `
          <img src="${URL.createObjectURL(file)}" alt="Preview">
          <button type="button" class="btn-delete-preview" id="del-${previewId}">✕</button>
        `;
        container.appendChild(box);
        
        const delBtn = document.getElementById(`del-${previewId}`);
        if (delBtn) {
          delBtn.onclick = () => {
            addSelectedFiles = addSelectedFiles.filter(f => f !== file);
            box.remove();
            updatePreview();
          };
        }
      });
      updatePreview();
      addInput.value = '';
    });
  }
  
  const editInput = document.getElementById('edit-images-input');
  if (editInput) {
    editInput.addEventListener('change', function(e) {
      const files = Array.from(e.target.files);
      const container = document.getElementById('edit-image-list-container');
      
      files.forEach(file => {
        editSelectedFiles.push(file);
        
        const previewId = `edit-prev-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const box = document.createElement('div');
        box.className = 'preview-item-box';
        box.id = previewId;
        box.innerHTML = `
          <img src="${URL.createObjectURL(file)}" alt="Preview">
          <button type="button" class="btn-delete-preview" id="del-${previewId}">✕</button>
        `;
        container.appendChild(box);
        
        const delBtn = document.getElementById(`del-${previewId}`);
        if (delBtn) {
          delBtn.onclick = () => {
            editSelectedFiles = editSelectedFiles.filter(f => f !== file);
            box.remove();
          };
        }
      });
      editInput.value = '';
    });
  }
}

function changeGalleryImage(url, thumbEl) {
  const mainImg = document.getElementById('gallery-main-img');
  if (mainImg) {
    mainImg.src = url;
  }
  document.querySelectorAll('.gallery-thumb-item').forEach(el => el.classList.remove('active'));
  if (thumbEl) {
    thumbEl.classList.add('active');
  }
}

function setupStarRatingSelector() {
  const stars = document.querySelectorAll('#review-stars-selector span');
  stars.forEach(star => {
    star.addEventListener('click', function() {
      const val = parseInt(this.dataset.value);
      setSelectedStarRating(val);
    });
    star.addEventListener('mouseover', function() {
      const val = parseInt(this.dataset.value);
      highlightStars(val);
    });
    star.addEventListener('mouseout', function() {
      highlightStars(selectedStarRating);
    });
  });
}

function setSelectedStarRating(val) {
  selectedStarRating = val;
  highlightStars(val);
}

function highlightStars(val) {
  const stars = document.querySelectorAll('#review-stars-selector span');
  stars.forEach(star => {
    const starVal = parseInt(star.dataset.value);
    star.classList.toggle('selected', starVal <= val);
  });
}

function loadProductReviews(productId) {
  const reviewsContainer = document.getElementById('reviews-comments-container');
  reviewsContainer.innerHTML = '<p style="color:var(--text-light); font-size: 13px;">Loading comments and ratings...</p>';

  fetch(`${API}/products/getProductReviews.php?product_id=${productId}`)
    .then(r => r.json())
    .then(reviews => {
      const avgValEl = document.getElementById('reviews-avg-value');
      const avgStarsEl = document.getElementById('reviews-avg-stars');
      const totalCountEl = document.getElementById('reviews-total-count');
      
      const count = reviews.length;
      let avg = 0.0;
      if (count > 0) {
        const total = reviews.reduce((sum, r) => sum + r.rating, 0);
        avg = parseFloat((total / count).toFixed(1));
      }
      
      avgValEl.textContent = avg.toFixed(1);
      avgStarsEl.textContent = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
      totalCountEl.textContent = `${count} ${count === 1 ? 'review' : 'reviews'}`;
      
      if (count === 0) {
        reviewsContainer.innerHTML = '<p style="color:var(--text-light); font-size: 13px; font-style: italic; padding: 10px 0;">No comments or reviews yet for this product.</p>';
      } else {
        reviewsContainer.innerHTML = reviews.map(r => `
          <div class="review-comment-item">
            <div class="review-comment-header">
              <span class="review-comment-user">${escapeHTML(r.user_email.split('@')[0])} <small style="color:var(--text-light);font-weight:normal;">(${escapeHTML(r.user_email)})</small></span>
              <span class="review-comment-date">${escapeHTML(r.created_at.split(' ')[0])}</span>
            </div>
            <div class="review-comment-stars">${'★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)}</div>
            <div class="review-comment-text">${escapeHTML(r.comment || 'No comment text.')}</div>
          </div>
        `).join('');
      }

      const formEl = document.getElementById('review-write-form');
      if (currentUser && currentRole === 'buyer') {
        formEl.style.display = 'block';
        
        const myReview = reviews.find(r => r.user_email === currentUser.email);
        const headlineEl = document.getElementById('review-form-headline');
        const submitBtn = document.getElementById('btn-submit-review');
        const commentInput = document.getElementById('review-comment-input');
        
        if (myReview) {
          headlineEl.textContent = "Edit Your Review";
          submitBtn.textContent = "Update Review";
          setSelectedStarRating(myReview.rating);
          commentInput.value = myReview.comment;
        } else {
          headlineEl.textContent = "Write a Review";
          submitBtn.textContent = "Submit Review";
          setSelectedStarRating(5);
          commentInput.value = "";
        }
      } else {
        formEl.style.display = 'none';
      }
    })
    .catch(err => {
      console.error(err);
      reviewsContainer.innerHTML = '<p style="color:var(--stale-badge); font-size: 13px;">Error loading reviews.</p>';
    });
}

function submitProductReview() {
  if (!detailsSelectedProduct || !currentUser || currentRole !== 'buyer') return;
  
  const rating = selectedStarRating;
  const comment = document.getElementById('review-comment-input').value.trim();
  
  if (rating < 1 || rating > 5) {
    showToast("Please choose a star rating from 1 to 5", "error");
    return;
  }
  
  fetch(`${API}/products/submitReview.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      product_id: detailsSelectedProduct.id,
      user_email: currentUser.email,
      rating,
      comment
    })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast("Review submitted successfully!", "success");
        
        const prod = PRODUCTS.find(p => p.id === detailsSelectedProduct.id);
        if (prod) {
          prod.rating = data.rating;
          prod.reviews = data.reviews;
        }
        
        filterProducts();
        renderLandingPageContent();
        
        loadProductReviews(detailsSelectedProduct.id);
        
        const ratingRow = document.getElementById('details-rating-row');
        if (ratingRow) {
          ratingRow.innerHTML = `<span class="card-stars">★</span> <strong>${data.rating.toFixed(1)}</strong> (${data.reviews} reviews)`;
        }
      } else {
        showToast(data.message || "Failed to submit review", "error");
      }
    })
    .catch(() => showToast("Could not reach review server", "error"));
}

async function initApp() {
  loadLandingConfig();
  if (loadSession()) {
    enterApp();
  } else {
    buildLandingProductsAndProducers();
    updatePreview();
  }
  setupStarRatingSelector();
  setupImageUploadHandlers();
  console.log('AgroMarket ready');
}

initApp();





