import { state } from './state.js';
import { translations, PLANT_CLASSES } from './constants.js';
import { setVersionDisplay } from './utils.js';
import { addToCart, renderPage, applyFilter, changeItemsPerPage, removeFromCart } from './actions.js';

export function applyTranslations() {
    const t = translations[state.currentLang];
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) langBtn.innerText = state.currentLang === 'en' ? 'ES' : 'EN';
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && t[key]) (el as HTMLElement).innerText = t[key];
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && t[key]) (el as HTMLInputElement).placeholder = t[key];
    });
}

export function renderFilterControls() {
  const container = document.getElementById("filter-container");
  if (!container) return;

  const label = state.currentLang === 'es' ? 'Filtrar:' : 'Filter:';
  const allLabel = state.currentLang === 'es' ? 'Todos' : 'All';

  let html = `<label style="margin-right:10px; font-weight:bold; font-size: xxx-large;">${label}</label>`;
  html += `<select onchange="applyFilter(this.value)" style="padding: 8px; border-radius: 4px; border: 1px solid var(--primary); background: green; font-size: xxx-large;">`;
  
  PLANT_CLASSES.forEach(type => {
      const display = type === 'All' ? allLabel : type;
      html += `<option value="${type}" ${state.currentFilter === type ? 'selected' : ''}>${display}</option>`;
  });
  html += `</select>`;
  container.innerHTML = html;
}

export function updatePaginationControls(totalCount: number) {
  const container = document.getElementById('pagination-controls');
  if (!container) return;
  
  const totalPages = Math.ceil(totalCount / state.itemsPerPage) || 1;
  
  let html = `<button class="page-btn" onclick="renderPage(${state.currentPage - 1})" ${state.currentPage === 1 ? 'disabled' : ''}>${translations[state.currentLang].prev}</button>`;
  
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" onclick="renderPage(${i})">${i}</button>`;
  }
  
  html += `<button class="page-btn" onclick="renderPage(${state.currentPage + 1})" ${state.currentPage === totalPages ? 'disabled' : ''}>${translations[state.currentLang].next}</button>`;
  
  html += `
    <select onchange="changeItemsPerPage(this.value)" style="margin-left: 15px; padding: 8px; border-radius: 4px; border: 1px solid var(--primary);">
      <option value="5" ${state.itemsPerPage === 5 ? 'selected' : ''}>5 / page</option>
      <option value="10" ${state.itemsPerPage === 10 ? 'selected' : ''}>10 / page</option>
      <option value="20" ${state.itemsPerPage === 20 ? 'selected' : ''}>20 / page</option>
    </select>
  `;
  
  container.innerHTML = html;
}

export function updateCartUI() {
  const cartItemsDiv = document.getElementById("cart-items");
  const cartCount = document.getElementById("cart-count");
  const cartTotal = document.getElementById("cart-total");
  const cartFooter = document.getElementById("cart-footer");
  const removeAllBtn = document.querySelector(".remove-all-btn") as HTMLElement;

  const paypalContainer = document.getElementById("paypal-button-container");
  if (paypalContainer) paypalContainer.innerHTML = "";
  const checkoutBtn = document.querySelector(".checkout-btn") as HTMLElement;
  if (checkoutBtn) checkoutBtn.style.display = "";

  if (cartCount) cartCount.innerText = state.cart.length.toString();

  if (cartItemsDiv && cartFooter && cartTotal) {
    if (state.cart.length === 0) {
        cartItemsDiv.innerHTML = `<p data-i18n="cartEmpty">${translations[state.currentLang].cartEmpty}</p>`;
        cartFooter.style.display = "none";
        if (removeAllBtn) removeAllBtn.style.display = "none";
    } else {
        if (removeAllBtn) removeAllBtn.style.display = "block";
        cartItemsDiv.innerHTML = "";
        let total = 0;
        state.cart.forEach((item, index) => {
        if (!item) return;
        const itemPrice = Number(item.price_cents) / 100;
        total += itemPrice;
        cartItemsDiv.innerHTML += `
                    <div class="cart-item">
                        <div>
                            <strong>${item.name}</strong><br>
                            $${itemPrice.toFixed(2)}
                        </div>
                        <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer;">${translations[state.currentLang].btnRemove}</button>
                    </div>
                `;
        });
        cartTotal.innerText = total.toFixed(2);
        cartFooter.style.display = "block";
    }
  }
}

export function toggleHelp() {
  const dialog = document.getElementById('help-dialog');
  if (!dialog) return;
  if (dialog.style.display === 'none') {
    dialog.style.display = 'block';
    setVersionDisplay();
    const helpFile = state.currentLang === 'es' ? '/user_es.html' : '/user.html';
    fetch(helpFile)
      .then(res => res.text())
      .then(text => {
          const content = document.getElementById('help-content');
          if (content) content.innerHTML = text;
      })
      .catch(err => {
          const content = document.getElementById('help-content');
          if (content) content.innerText = "Help file not found.";
      });
  } else {
    dialog.style.display = 'none';
  }
}

export function injectLoginUI() {
  console.log('injectLoginUI() called');
  const authContainer = document.getElementById("auth-container");
  if (authContainer) {
    authContainer.style.display = "flex";
    // ensure visible in case of CSS interference
    (authContainer as HTMLElement).style.visibility = 'visible';
    console.log('auth-container display set to', (authContainer as HTMLElement).style.display);
  }
  const modal = document.getElementById("login-modal");
  if (modal) modal.style.display = "block";
  const registerForm = document.getElementById("register-modal");
  if (registerForm) registerForm.style.display = "none";
  const input = document.getElementById("login-email");
  if (input) setTimeout(() => input.focus(), 100);
}

export function injectLogoutButton() {
  const btn = document.getElementById("logout-btn");
  if (btn) btn.style.display = "block";
}

export function toggleAdminModal() {
  const modal = document.getElementById("admin-modal");
  if (!modal) return;
  const isClosed = modal.style.display !== "flex";
  modal.style.display = isClosed ? "flex" : "none";

  if (isClosed) {
    state.editingProductId = null;
    (document.getElementById("new-name") as HTMLInputElement).value = "";
    (document.getElementById("new-price") as HTMLInputElement).value = "";
    (document.getElementById("new-image") as HTMLInputElement).value = "";
    const btn = document.querySelector("#admin-modal .add-btn") as HTMLElement;
    if (btn) btn.innerText = translations[state.currentLang].btnAddInventory;
  }
}

export function closeImageModal() {
  const modal = document.getElementById("image-modal");
  if (modal) modal.style.display = "none";
}

export function toggleCart() {
  const sidebar = document.getElementById("cart-sidebar");
  if (!sidebar) return;
  sidebar.classList.toggle("open");

  if (sidebar.classList.contains("open")) {
    const helpDialog = document.getElementById('help-dialog');
    if (helpDialog) helpDialog.style.display = 'none';
  } else {
    const paypalContainer = document.getElementById("paypal-button-container");
    if (paypalContainer) paypalContainer.innerHTML = "";
    const checkoutBtn = document.querySelector(".checkout-btn") as HTMLElement;
    if (checkoutBtn) checkoutBtn.style.display = "";
  }
}

export function groupSidebarElements() {
  const containerId = 'sidebar-container';
  if (document.getElementById(containerId)) return;

  const filter = document.getElementById('filter-container');
  const logo = document.querySelector('.sidebar-logo-container');
  const version = document.querySelector('.version-tag');

  if (!filter && !logo && !version) return;

  const wrapper = document.createElement('div');
  wrapper.id = containerId;
  document.body.appendChild(wrapper);

  if (logo) wrapper.appendChild(logo);

  if (filter) wrapper.appendChild(filter);
  //if (version) wrapper.appendChild(version);
}
