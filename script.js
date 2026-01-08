/**
 * Cactus Studio - Main Application Script
 *
 * This file contains the core logic for the single-page e-commerce application.
 * It handles:
 * 1. State Management: Manages products, cart, user session, and admin status.
 * 2. Data Fetching: Loads products from a Neon Database via Netlify Functions,
 *    with a fallback to a local 'data.json' file.
 * 3. Caching: Implements memory caching for paginated product data and images
 *    to reduce network requests and improve performance.
 * 4. UI Rendering: Dynamically generates the product grid, pagination controls,
 *    shopping cart sidebar, and modals (login, image zoom, admin forms).
 * 5. Localization: Supports English (en) and Spanish (es) via a dictionary-based system.
 * 6. Admin Features: Provides a protected interface for adding/editing products,
 *    managing hidden items, and syncing local data to the database.
 * 7. Payment Integration: Integrates PayPal SDK for checkout processing.
 */

const APP_VERSION = '1.0.0';
const CACHE_IMG = true;
const DEFAULT_IMG_CACHE = 100; // Default number of cached images if calculation fails
const MAX_IMGS = 1000;
const MAX_IMG_CACHE_PERCENT = 0.25; // Use 25% of available memory for image cache

/**
 * Calculates the maximum number of cached images based on the available memory.
 * @returns {number} The maximum number of cached images.
 */
const calculateMaxImgCache = () => {
  try {
    const availableMemory = window.performance.memory.totalJSHeapSize - window.performance.memory.usedJSHeapSize;
    res =  Math.floor(availableMemory * MAX_IMG_CACHE_PERCENT);
    return res > MAX_IMGS ? MAX_IMGS : res;
  } catch (error) {
    console.error('Error calculating max image cache:', error);
    return DEFAULT_IMG_CACHE;
  }
};

// Calculate the maximum number of cached images based on available memory
const MAX_IMG_CACHE = calculateMaxImgCache();

console.log(`Max Image Cache Size: ${MAX_IMG_CACHE} images`);

/**
 * Finds all elements with the 'version-tag' class and
 * sets their content to the current app version.
 */
const setVersionDisplay = () => {
  const versionElements = document.querySelectorAll('.version-tag');
  versionElements.forEach(element => {
    element.textContent = `v${APP_VERSION}`;
  });
};

// State for the shopping cart
let cart = [];
let isAdmin = false;
let editingProductId = null;
let currentUser = null;
let defaultProducts = [];
let products = [];
let allProducts = []; // Used for fallback mode
let useDB = false;
let pageCache = {}; // Cache for DB pages: { pageNum: { products, total } }
let imageCache = {}; // Cache for images: { originalUrl: blobUrl }
let totalItems = 0;
let currentPage = 1;
let itemsPerPage = 10;
const hiddenProductIds = new Set();

    // Replace 'test' with your actual PayPal Client ID from the Developer Dashboard
    const CLIENT_ID = window.env.PAYPAL_SANDBOX_CLIENT_ID;


const translations = {
    en: {
        logout: "Logout",
        addItem: "Add Item",
        hidden: "Hidden",
        help: "Help",
        cart: "Cart",
        heroTitle: "Rare & Exotic Cacti",
        heroSubtitle: "Delivered safely from our nursery to your doorstep.",
        inventoryTitle: "Current Inventory",
        uploadTitle: "Upload New Cactus",
        labelName: "Cactus Name",
        labelPrice: "Price ($)",
        labelImage: "Image URL",
        labelHide: "Hide Product",
        helperText: "(For demo, right click any image on Google Images and 'Copy Image Address')",
        btnAddInventory: "Add to Inventory",
        btnUpdateProduct: "Update Product",
        btnCancel: "Cancel",
        hiddenTitle: "Hidden Products",
        btnSave: "Save",
        loginTitle: "Cactus Studio Login",
        loginPlaceholder: "Enter WhatsApp Number",
        btnLogin: "Login",
        cartTitle: "CART",
        btnRemoveAll: "Remove All",
        cartEmpty: "Your cart is empty.",
        cartTotal: "TOTAL:",
        btnCheckout: "CHECKOUT",
        btnAddCart: "Add to Cart",
        btnRemove: "Remove",
        alertAdminPass: "Enter Admin Password:",
        alertAccessGranted: "Admin access granted.",
        alertIncorrectPass: "Incorrect Password.",
        alertValidNumber: "Please enter a valid number.",
        alertUpdated: "Cactus updated!",
        alertAdded: "Cactus added to inventory!",
        alertFillFields: "Please fill in all fields.",
        alertPayment: "This would go to payment!",
        prev: "Prev",
        next: "Next",
        modalAddCart: "Add to Cart +"
    },
    es: {
        logout: "Cerrar Sesión",
        addItem: "Agregar Item",
        hidden: "Ocultos",
        help: "Ayuda",
        cart: "Carrito",
        heroTitle: "Cactus Raros y Exóticos",
        heroSubtitle: "Entregados con seguridad desde nuestro vivero a tu puerta.",
        inventoryTitle: "Inventario Actual",
        uploadTitle: "Subir Nuevo Cactus",
        labelName: "Nombre del Cactus",
        labelPrice: "Precio ($)",
        labelImage: "URL de Imagen",
        labelHide: "Ocultar Producto",
        helperText: "(Para demo, clic derecho en cualquier imagen de Google y 'Copiar dirección de imagen')",
        btnAddInventory: "Agregar al Inventario",
        btnUpdateProduct: "Actualizar Producto",
        btnCancel: "Cancelar",
        hiddenTitle: "Productos Ocultos",
        btnSave: "Guardar",
        loginTitle: "Login Cactus Studio",
        loginPlaceholder: "Ingresa número de WhatsApp",
        btnLogin: "Entrar",
        cartTitle: "CARRITO",
        btnRemoveAll: "Vaciar Carrito",
        cartEmpty: "Tu carrito está vacío.",
        cartTotal: "TOTAL:",
        btnCheckout: "PAGO",
        btnAddCart: "Agregar al Carrito",
        btnRemove: "Eliminar",
        alertAdminPass: "Ingresa Contraseña de Admin:",
        alertAccessGranted: "Acceso de admin concedido.",
        alertIncorrectPass: "Contraseña incorrecta.",
        alertValidNumber: "Por favor ingresa un número válido.",
        alertUpdated: "¡Cactus actualizado!",
        alertAdded: "¡Cactus agregado al inventario!",
        alertFillFields: "Por favor llena todos los campos.",
        alertPayment: "¡Esto iría al pago!",
        prev: "Ant",
        next: "Sig",
        modalAddCart: "Agregar al Carrito +"
    }
};

let currentLang = localStorage.getItem('cactusLang') || 'en';

// Since your script tag is at the end of the <body>,
// the DOM will be ready, and you can call the function directly.
setVersionDisplay();
applyTranslations();

/**
 * Toggles the application language between English and Spanish.
 * Reloads the page to apply changes and resets the user session.
 */
function toggleLanguage() {
    const nextLang = currentLang === 'en' ? 'es' : 'en';
    const msg = currentLang === 'en' 
        ? "Changing language will log you out and reload the page. Continue?" 
        : "Cambiar el idioma cerrará la sesión y recargará la página. ¿Continuar?";

    if (confirm(msg)) {
        currentLang = nextLang;
        localStorage.setItem('cactusLang', currentLang);
        logoutUser();
        window.location.reload();
    }
}

/**
 * Updates the DOM elements with text content based on the current language.
 */
function applyTranslations() {
    const t = translations[currentLang];
    document.getElementById('lang-btn').innerText = currentLang === 'en' ? 'ES' : 'EN';
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.innerText = t[key];
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });

    renderPage(currentPage);
    updateCartUI();
}

/**
 * Toggles the visibility of the help dialog and loads the appropriate content.
 */
function toggleHelp() {
  const dialog = document.getElementById('help-dialog');
  if (dialog.style.display === 'none') {
    dialog.style.display = 'block';
    setVersionDisplay();
    const helpFile = currentLang === 'es' ? '/user_es.html' : '/user.html';
    fetch(helpFile)
      .then(res => res.text())
      .then(text => document.getElementById('help-content').innerHTML = text)
      .catch(err => document.getElementById('help-content').innerText = "Help file not found.");
  } else {
    dialog.style.display = 'none';
  }
}

function removeAllFromCart() {
    if (!cart || !cart.length) return;
    // Iterate backwards to avoid index shifting issues
    for (let i = cart.length - 1; i >= 0; i--) {
        // Call the local removeFromCart function
        removeFromCart(i);
    }
}

// --- SECURITY / ADMIN CHECK LOGIC ---
// Simple hash-based admin check. If URL ends in #admin, prompts for password.
function checkAdminAccess() {
  if (isAdmin) return;
  // Check if URL ends with #admin
  if (window.location.hash === "#admin") {
    const password = prompt(translations[currentLang].alertAdminPass);
    if (password === "LILY") {
      isAdmin = true;
      currentUser = "admin";
      if (document.getElementById("login-modal")) document.getElementById("login-modal").style.display = "none";
      
      if (products.length === 0) {
        fetchDataAndLoad();
      } else {
        loadUserData();
        injectLogoutButton();
      }
      
      alert(translations[currentLang].alertAccessGranted);
      // Show the admin button
      document.getElementById("admin-btn").style.display = "inline-block";
      const hiddenBtn = document.getElementById("hidden-mgr-btn");
      if (hiddenBtn) hiddenBtn.style.display = "inline-block";
      const syncBtn = document.getElementById("sync-btn");
      if (syncBtn) syncBtn.style.display = "inline-block";
    } else {
      alert(translations[currentLang].alertIncorrectPass);
      // Remove the hash to prevent loop
      history.pushState(
        "",
        document.title,
        window.location.pathname + window.location.search
      );
      currentUser = null;
    }
  }
}

function getStorageKey(key) {
  return currentUser ? `${key}_${currentUser}` : key;
}

function injectLoginUI() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.style.display = "flex";
  const input = document.getElementById("login-phone");
  if (input) setTimeout(() => input.focus(), 100);
}

function loginUser() {
  const phone = document.getElementById("login-phone").value.trim();
  if (!phone) {
    alert(translations[currentLang].alertValidNumber);
    return;
  }
  currentUser = phone;
  document.getElementById("login-modal").style.display = "none";
  fetchDataAndLoad();
}

async function fetchDataAndLoad() {
  const savedPage = parseInt(localStorage.getItem('cactusPage')) || 1;
  const savedLimit = parseInt(localStorage.getItem('cactusLimit')) || 20;
  itemsPerPage = savedLimit;
  currentPage = savedPage;
  pageCache = {}; // Reset cache on new load

  try {
    // 1. Try to load from Database first
    const res = await fetch(`/.netlify/functions/get-products?page=${savedPage}&limit=${savedLimit}`);
    if (res.ok) {
      const data = await res.json();
      useDB = true;
      products = data.products;
      totalItems = data.total;
      // Cache the initial page
      pageCache[savedPage] = { products: data.products, total: data.total };
      // In DB mode, we don't load 'defaultProducts' from JSON
      loadUserData(false);
      injectLogoutButton();
      renderPage(savedPage, true); // Render immediately, skip fetch
      return;
    }
  } catch (e) {
    console.log("DB load failed, falling back to data.json", e);
  }

  // 2. Fallback to data.json
  useDB = false;
  const response = await fetch('/data.json');
  allProducts = await response.json();
  defaultProducts = JSON.parse(JSON.stringify(allProducts));
  loadUserData(false);
  injectLogoutButton();
  renderPage(savedPage);
}

function logoutUser() {
  const wasAdmin = isAdmin;
  currentUser = null;
  cart = [];
  pageCache = {}; // Clear page cache on logout
  Object.values(imageCache).forEach(url => {
    if (url && url !== 'pending') URL.revokeObjectURL(url);
  });
  imageCache = {}; // Clear image cache
  updateCartUI();
  document.getElementById("product-grid").innerHTML = "";
  const btn = document.getElementById("logout-btn");
  if (btn) btn.style.display = "none";
  
  isAdmin = false;
  const adminBtn = document.getElementById("admin-btn");
  if(adminBtn) adminBtn.style.display = "none";
  const hiddenMgrBtn = document.getElementById("hidden-mgr-btn");
  if(hiddenMgrBtn) hiddenMgrBtn.style.display = "none";
  const syncBtn = document.getElementById("sync-btn");
  if(syncBtn) syncBtn.style.display = "none";
  
  injectLoginUI();
  document.getElementById("login-phone").value = "";

  if (wasAdmin) {
    window.location.href = window.location.pathname;
  }
}

function injectLogoutButton() {
  const btn = document.getElementById("logout-btn");
  if (btn) btn.style.display = "block";
}

function loadUserData(render = true) {
  // Only admin loads modified products. Regular users use default (fresh) data.
  if (currentUser === 'admin' && !useDB) {
    const storedProducts = localStorage.getItem(getStorageKey('cactusProducts'));
    if (storedProducts) {
      try {
        let stored = JSON.parse(storedProducts);

        // Merge schema from defaultProducts (data.json) into stored products
        // This ensures new columns added to data.json appear in the admin's view and are synced.
        if (defaultProducts.length > 0 && stored.length > 0) {
            const freshKeys = Object.keys(defaultProducts[0]);
            stored = stored.map(storedItem => {
                const freshItem = defaultProducts.find(dp => dp.id === storedItem.id);
                freshKeys.forEach(key => {
                    if (storedItem[key] === undefined) {
                        storedItem[key] = freshItem ? freshItem[key] : null;
                    }
                });
                return storedItem;
            });
        }
        allProducts = stored;
      } catch (e) {
        console.error("Error loading products from localStorage:", e);
        allProducts = JSON.parse(JSON.stringify(defaultProducts));
      }
    } else {
      allProducts = JSON.parse(JSON.stringify(defaultProducts));
    }
  } else if (!useDB) {
    allProducts = JSON.parse(JSON.stringify(defaultProducts));
  }
  const storedCart = localStorage.getItem(getStorageKey('cactusCart'));
  if (storedCart) {
    // try {
      cart = JSON.parse(storedCart);
      updateCartUI();
    //   // Remove hidden items from cart on load
    //   const initialCount = cart.length;
    //   cart = cart.filter(item => {
    //     const product = products.find(p => p.id === item.id);
    //     return !product || !product.hidden;
    //   });
    //   if (cart.length !== initialCount) localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
    //   updateCartUI();
    // } catch (e) {
    //   console.error("Error loading cart from localStorage:", e);
    // }
  } else {
    cart = [];
    updateCartUI();
  }
  
  // Sync hidden IDs from cart
  hiddenProductIds.clear();
  cart.forEach(item => hiddenProductIds.add(item.id));

  if (render) renderPage(1);
  localStorage.setItem(getStorageKey('cactusProducts'), JSON.stringify(products));
  updateHiddenCount();
  checkAdminAccess();
}

// Initialize application on page load
window.onload = function () {
  setVersionDisplay();
  
  if (window.location.hash === "#admin") checkAdminAccess();
  else injectLoginUI();

  // Sidebar close listener
  document.addEventListener('click', function(event) {
    // Close help dialog if clicking outside
    const helpDialog = document.getElementById('help-dialog');
    const helpBtn = document.getElementById('help-btn');
    if (helpDialog && helpDialog.style.display !== 'none' && !helpDialog.contains(event.target) && (!helpBtn || !helpBtn.contains(event.target))) {
      helpDialog.style.display = 'none';
    }

    const sidebar = document.getElementById('cart-sidebar');
    const toggleBtn = document.getElementById('cart-toggle-btn');
    
    if (!event.target.isConnected) return;

    if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(event.target) && !toggleBtn.contains(event.target)) {
      toggleCart();
    }
  });
};

// Listen for hash changes to trigger admin check dynamically
window.addEventListener("hashchange", checkAdminAccess);
// ------------------------------------

// 2. Render Products
// --- UPDATED: Render Products with Clickable Images ---
// Dynamically generates HTML for the product grid based on the 'products' array
function renderProducts() {
  renderPage(currentPage);
}

/**
 * Renders a specific page of products.
 * Handles both database-backed pagination and client-side pagination (fallback).
 * @param {number} page - The page number to render.
 * @param {boolean} skipFetch - If true, skips fetching from DB (used when data is preloaded).
 */
async function renderPage(page, skipFetch = false) {
  localStorage.setItem('cactusPage', page);
  currentPage = page;

  if (useDB && !skipFetch) {
    // Check cache first
    if (pageCache[page]) {
      products = pageCache[page].products;
      totalItems = pageCache[page].total;
    } else {
      // Fetch specific page from DB
      const res = await fetch(`/.netlify/functions/get-products?page=${page}&limit=${itemsPerPage}`);
      if (res.ok) {
        const data = await res.json();
        products = data.products;
        totalItems = data.total;
        pageCache[page] = { products: data.products, total: data.total };
      }
    }
  } else if (!useDB) {
    // Client-side pagination
    const visibleProducts = allProducts.filter(p => !p.hidden && !hiddenProductIds.has(p.id));
    totalItems = visibleProducts.length;
    const start = (page - 1) * itemsPerPage;
    products = visibleProducts.slice(start, start + itemsPerPage);
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (page > totalPages) currentPage = totalPages;
  if (page < 1) currentPage = 1;

  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";
  
  products.forEach((product) => {
    // Hide if in cart
    if (hiddenProductIds.has(product.id)) return;

    // Check if scientific name exists
    const sciName = product.scientific
      ? `<div class="scientific-name">${product.scientific}</div>`
      : "";

    let displayImage = product.image;
    if (CACHE_IMG) {
      // Use cached image if available, otherwise trigger cache
      displayImage = (imageCache[product.image] && imageCache[product.image] !== 'pending') 
                           ? imageCache[product.image] 
                           : product.image;
      if (!imageCache[product.image]) cacheImage(product.image);
    }

    grid.innerHTML += `
        <div class="product-card">
            <img src="${displayImage}" class="product-image" alt="${product.name}" 
                 onclick="openImageModal(${product.id})" style="cursor:zoom-in;">
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                ${sciName}
                <div class="product-price">$${Number(product.price).toFixed(2)}</div>
                <button class="add-btn" onclick="addToCart(${product.id})">${translations[currentLang].btnAddCart}</button>
            </div>
        </div>
    `;
  });

  updatePaginationControls(totalItems);
}

function changeItemsPerPage(val) {
  itemsPerPage = parseInt(val);
  localStorage.setItem('cactusLimit', itemsPerPage);
  pageCache = {}; // Invalidate cache since page boundaries changed
  renderPage(1);
}

function updatePaginationControls(totalCount) {
  const container = document.getElementById('pagination-controls');
  if (!container) return;
  
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  
  let html = `<button class="page-btn" onclick="renderPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>${translations[currentLang].prev}</button>`;
  
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="renderPage(${i})">${i}</button>`;
  }
  
  html += `<button class="page-btn" onclick="renderPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>${translations[currentLang].next}</button>`;
  
  // Add Items Per Page Dropdown
  html += `
    <select onchange="changeItemsPerPage(this.value)" style="margin-left: 15px; padding: 8px; border-radius: 4px; border: 1px solid var(--primary);">
      <option value="5" ${itemsPerPage === 5 ? 'selected' : ''}>5 / page</option>
      <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10 / page</option>
      <option value="20" ${itemsPerPage === 20 ? 'selected' : ''}>20 / page</option>
    </select>
  `;
  
  container.innerHTML = html;
}

function cacheImage(url) {
  if (imageCache[url]) return;

  // Manage cache size to prevent memory leaks on mobile
  const keys = Object.keys(imageCache);
  if (keys.length >= MAX_IMG_CACHE) {
    const oldestUrl = keys[0];
    const blobUrl = imageCache[oldestUrl];
    if (blobUrl && blobUrl !== 'pending') URL.revokeObjectURL(blobUrl);
    delete imageCache[oldestUrl];
  }

  imageCache[url] = 'pending';
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      imageCache[url] = URL.createObjectURL(blob);
    })
    .catch(err => {
      delete imageCache[url];
    });
}

// --- NEW: Image Zoom Functions ---

// Opens the full-screen image modal for a specific product
function openImageModal(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;

  if (isAdmin) {
    document.getElementById("new-name").value = product.name;
    document.getElementById("new-price").value = product.price;
    document.getElementById("new-image").value = product.image;
    editingProductId = product.id;
    
    const hideCheck = document.getElementById("hide-check");
    if (hideCheck) {
      hideCheck.checked = !!product.hidden;
    }

    const btn = document.querySelector("#admin-modal .add-btn");
    if (btn) btn.innerText = translations[currentLang].btnUpdateProduct;

    const adminModal = document.getElementById("admin-modal");
    if (adminModal.style.display !== "flex") {
      adminModal.style.display = "flex";
    }
    return;
  }

  const modal = document.getElementById("image-modal");
  const img = document.getElementById("modal-img");
  const btn = document.getElementById("modal-add-btn");

  // Set Image
  if (CACHE_IMG && imageCache[product.image] && imageCache[product.image] !== 'pending') {
    img.src = imageCache[product.image];
  } else {
    img.src = product.image;
  }

  btn.innerText = translations[currentLang].modalAddCart;
  // Configure the button to add THIS specific product
  // We use event.stopPropagation() inside the inline call to ensure logic flows correctly if needed,
  // but here we rely on the container's onclick to close it.
  btn.onclick = function () {
    addToCart(product.id);
    // The modal is closed automatically because this button is inside the div
    // which has onclick="closeImageModal()" (event bubbling).
  };

  modal.style.display = "flex";
}

// Closes the image zoom modal
function closeImageModal() {
  document.getElementById("image-modal").style.display = "none";
}

// 3. Admin / Upload Functions
// Toggles the visibility of the admin product upload modal
function toggleAdminModal() {
  const modal = document.getElementById("admin-modal");
  const isClosed = modal.style.display !== "flex";
  modal.style.display = isClosed ? "flex" : "none";

  if (isClosed) {
    editingProductId = null;
    document.getElementById("new-name").value = "";
    document.getElementById("new-price").value = "";
    document.getElementById("new-image").value = "";
    const hideCheck = document.getElementById("hide-check");
    if (hideCheck) hideCheck.checked = false;
    const btn = document.querySelector("#admin-modal .add-btn");
    if (btn) btn.innerText = translations[currentLang].btnAddInventory;
  }
}

// Adds a new product to the 'products' array and re-renders the grid
function addProduct() {
  const name = document.getElementById("new-name").value;
  const price = parseFloat(document.getElementById("new-price").value);
  const image = document.getElementById("new-image").value;
  const isHidden = document.getElementById("hide-check")?.checked || false;

  if (name && price && image) {
    if (editingProductId) {
      const product = products.find((p) => p.id === editingProductId);
      if (product) {
        product.name = name;
        product.price = price;
        product.image = image;
        product.hidden = isHidden;
        if (isHidden) {
          cart = cart.filter((item) => item.id !== product.id);
          localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
          updateCartUI();
        }
        alert(translations[currentLang].alertUpdated);
      }
    } else {
      const newProduct = {
        id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
        name: name,
        price: price,
        image: image,
        hidden: isHidden,
      };
      products.push(newProduct);
      alert(translations[currentLang].alertAdded);
    }
    localStorage.setItem(getStorageKey('cactusProducts'), JSON.stringify(products));
    renderProducts();
    updateHiddenCount();
    // Close modal
    toggleAdminModal();
    // Clear inputs
    document.getElementById("new-name").value = "";
    document.getElementById("new-price").value = "";
    document.getElementById("new-image").value = "";
    const hideCheck = document.getElementById("hide-check");
    if (hideCheck) hideCheck.checked = false;

    editingProductId = null;
    const btn = document.querySelector("#admin-modal .add-btn");
    if (btn) btn.innerText = translations[currentLang].btnAddInventory;
  } else {
    alert(translations[currentLang].alertFillFields);
  }
}

function openHiddenManager() {
  const list = document.getElementById("hidden-list");
  list.innerHTML = "";
  const hiddenProducts = products.filter(p => p.hidden);
  if (hiddenProducts.length === 0) {
    list.innerHTML = "<em>No hidden products.</em>";
  } else {
    hiddenProducts.forEach(p => {
      list.innerHTML += `<div class="hidden-item"><label><input type="checkbox" class="hidden-toggle" data-id="${p.id}"> Show <strong>${p.name}</strong></label></div>`;
    });
  }
  document.getElementById("hidden-modal").style.display = "flex";
}

function closeHiddenManager() {
  document.getElementById("hidden-modal").style.display = "none";
}

function saveHiddenChanges() {
  const checkboxes = document.querySelectorAll(".hidden-toggle:checked");
  checkboxes.forEach(cb => {
    const id = parseInt(cb.getAttribute("data-id"));
    const product = products.find(p => p.id === id);
    if (product) product.hidden = false;
  });
  localStorage.setItem(getStorageKey('cactusProducts'), JSON.stringify(products));
  renderProducts();
  updateHiddenCount();
  closeHiddenManager();
}

function updateHiddenCount() {
  const count = products.filter(p => p.hidden).length;
  const badge = document.getElementById("hidden-count");
  if (badge) badge.innerText = count;
}

// 4. Cart Functions
// Toggles the visibility of the cart sidebar
function toggleCart() {
  const sidebar = document.getElementById("cart-sidebar");
  sidebar.classList.toggle("open");

  if (sidebar.classList.contains("open")) {
    const helpDialog = document.getElementById('help-dialog');
    if (helpDialog) helpDialog.style.display = 'none';
  } else {
    const paypalContainer = document.getElementById("paypal-button-container");
    if (paypalContainer) paypalContainer.innerHTML = "";
    const checkoutBtn = document.querySelector(".checkout-btn");
    if (checkoutBtn) checkoutBtn.style.display = "";
  }
}

// Adds a product to the cart array and updates the UI
function addToCart(id) {
  const product = products.find((p) => p.id === id);
  cart.push(product);
  localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
  updateCartUI();
  
  hiddenProductIds.add(id);
  renderPage(currentPage);
}

// Re-renders the cart sidebar contents based on the 'cart' array
function updateCartUI() {
  const cartItemsDiv = document.getElementById("cart-items");
  const cartCount = document.getElementById("cart-count");
  const cartTotal = document.getElementById("cart-total");
  const cartFooter = document.getElementById("cart-footer");
  const removeAllBtn = document.querySelector(".remove-all-btn");

  // Reset PayPal container and checkout button visibility on cart update
  const paypalContainer = document.getElementById("paypal-button-container");
  if (paypalContainer) paypalContainer.innerHTML = "";
  const checkoutBtn = document.querySelector(".checkout-btn");
  if (checkoutBtn) checkoutBtn.style.display = "";

  cartCount.innerText = cart.length;

  if (cart.length === 0) {
    cartItemsDiv.innerHTML = `<p data-i18n="cartEmpty">${translations[currentLang].cartEmpty}</p>`;
    cartFooter.style.display = "none";
    if (removeAllBtn) removeAllBtn.style.display = "none";
  } else {
    if (removeAllBtn) removeAllBtn.style.display = "block";
    cartItemsDiv.innerHTML = "";
    let total = 0;
    cart.forEach((item, index) => {
      const itemPrice = Number(item.price);
      total += itemPrice;
      cartItemsDiv.innerHTML += `
                <div class="cart-item">
                    <div>
                        <strong>${item.name}</strong><br>
                        $${itemPrice.toFixed(2)}
                    </div>
                    <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer;">${translations[currentLang].btnRemove}</button>
                </div>
            `;
    });
    cartTotal.innerText = total.toFixed(2);
    cartFooter.style.display = "block";
  }
}

// Removes an item from the cart by index
function removeFromCart(index) {
  const item = cart[index];
  if (item) {
    hiddenProductIds.delete(item.id);
  }
  
  cart.splice(index, 1);
  localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
  updateCartUI();
  renderPage(currentPage);
}

/**
 * Initiates the PayPal checkout process.
 * Dynamically loads the PayPal SDK if not already present and renders the buttons.
 */
function checkout() {
  const checkoutBtn = document.querySelector(".checkout-btn");
  if (checkoutBtn) checkoutBtn.style.display = "none";

  const paypalContainer = document.getElementById("paypal-button-container");
  paypalContainer.innerHTML = "<div style='text-align:center; margin-top:10px;'>Loading...</div>";

  const locale = currentLang === 'es' ? 'es_ES' : 'en_US';
  const scriptId = 'paypal-sdk';
  let script = document.getElementById(scriptId);

  const render = () => {
    paypalContainer.innerHTML = "";
    if (typeof paypal === "undefined" || !paypal || !paypal.Buttons) {
        console.error("PayPal SDK not ready.");
        alert("Payment system loading error. Please try again.");
        if (checkoutBtn) checkoutBtn.style.display = "";
        return;
    }
    
    paypal.Buttons({
      createOrder: function(data, actions) {
        const total = cart.reduce((sum, item) => sum + Number(item.price), 0);
        return actions.order.create({
          purchase_units: [{
            amount: {
              value: total.toFixed(2)
            }
          }]
        });
      },
      onApprove: function(data, actions) {
        return actions.order.capture().then(function(details) {
          cart = [];
          localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
          updateCartUI();
          toggleCart();
          setTimeout(function() {
            alert('Transaction completed by ' + details.payer.name.given_name + '!');
          }, 1000);
        });
      },
      onError: function(err) {
        console.error('PayPal Error:', err);
        alert('An error occurred during payment.');
        if (checkoutBtn) checkoutBtn.style.display = "";
        paypalContainer.innerHTML = "";
      }
    }).render('#paypal-button-container');
  };

  /*
  o use the PayPal SDK for live payments, you need a PayPal Business account. Here is the information on where to go and the associated costs.

1. Where to Sign Up
You need to go to the PayPal Developer Dashboard.

URL: https://developer.paypal.com/
Process:
Click "Log into Dashboard" at the top right.
You can log in with your existing personal PayPal account and upgrade it, or create a new Business Account specifically for your store.
Once logged in, go to "Apps & Credentials" to generate the Client ID needed for your code.
2. How Much Does It Cost?
Setting up the account and using the SDK is free. PayPal makes money only when you successfully sell something.

Monthly Fee: $0.00. There is no monthly subscription cost for the standard "Smart Payment Buttons" integration used in your code.
Setup Fee: $0.00. Generating Client IDs and accessing the API is free.
Transaction Fee: You are charged a percentage of every sale.
Standard Rate (USA): Approximately 2.99% + $0.49 per transaction.
Note: These rates vary by country and currency. International transactions usually have a slightly higher percentage (e.g., +1.50%).
Summary
You do not pay anything upfront. You only pay a small fee deducted automatically from the payment when a customer actually buys a cactus
  */
  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&currency=USD&locale=${locale}`;
    script.onload = render;
    script.onerror = () => {
        paypalContainer.innerHTML = "Error loading payment system.";
        if (checkoutBtn) checkoutBtn.style.display = "";
    };
    document.body.appendChild(script);
  } else {
    render();
  }
}

/**
 * Admin function to sync local JSON data to the remote database.
 * Handles schema mismatch detection and prompts for table recreation if needed.
 */
async function syncDatabase() {
  if (!confirm("Are you sure you want to sync data.json to the database?")) return;
  
  const btn = document.getElementById("sync-btn");
  const originalText = btn.innerText;
  btn.innerText = "Syncing...";
  btn.disabled = true;

  try {
    const response = await fetch('/data.json');
    allProducts = await response.json();
    defaultProducts = JSON.parse(JSON.stringify(allProducts));
    let res = await fetch('/.netlify/functions/seed-data', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: defaultProducts, force: false })
    });

    let text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { error: text || res.statusText };
    }

    if (res.status === 409) {
      const isSchemaMismatch = data.error && data.error.includes("Schema mismatch");
      const promptMsg = isSchemaMismatch 
        ? "Table exists but schema does not match. Delete table and sync?" 
        : "Sync failed (" + (data.error || "Unknown") + "). Delete table and recreate?";

      if (confirm(promptMsg)) {
        res = await fetch('/.netlify/functions/seed-data', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: products, force: true })
        });
        text = await res.text();
        try { data = JSON.parse(text); } catch (e) { data = { error: text }; }
      } else {
        alert("Sync cancelled.");
        return;
      }
    }

    if (!res.ok) throw new Error(data.error || "Unknown error");
    alert("Sync Result: " + (data.message || "Success"));

  } catch (err) {
    alert("Error syncing: " + err.message);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}
