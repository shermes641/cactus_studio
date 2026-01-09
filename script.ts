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

declare const paypal: any;

interface Product {
  id: number;
  name: string;
  price_cents: number;
  image_url: string;
  scientific?: string;
  class?: string;
  quantity?: number;
  notes?: string;
}

interface PageCacheEntry {
  products: Product[];
  total: number;
}

interface Translations {
    [lang: string]: {
        [key: string]: string;
    }
}

/**
 * Calculates the maximum number of cached images based on the available memory.
 * @returns {number} The maximum number of cached images.
 */
const calculateMaxImgCache = () => {
  try {
    const availableMemory = (window.performance as any).memory.totalJSHeapSize - (window.performance as any).memory.usedJSHeapSize;
    const res =  Math.floor(availableMemory * MAX_IMG_CACHE_PERCENT);
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
let cart: Product[] = [];
let isAdmin = false;
let editingProductId: number | null = null;
let currentUser: string | null = null;
let defaultProducts: Product[] = [];
let products: Product[] = [];
let allProducts: Product[] = []; // Used for fallback mode
let useDB = false;
let pageCache: { [key: number]: PageCacheEntry } = {}; // Cache for DB pages: { pageNum: { products, total } }
let imageCache: { [key: string]: string } = {}; // Cache for images: { originalUrl: blobUrl }
let totalItems = 0;
let currentPage = 1;
let itemsPerPage = 10;
const hiddenProductIds = new Set<number>();
let currentFilter = 'All';
const PLANT_CLASSES = ["All", "Opuntia", "Euphorbia", "Mammillaria", "Aizoaceae", "Aloe", "Crassula", "Echeveria", "Haworthia", "Sansevieria", "Sedum", "Sempervivum"];


const translations: Translations = {
    en: {
        logout: "Logout",
        addItem: "Add Item",
        help: "Help",
        cart: "Cart",
        heroTitle: "Rare & Exotic Cacti",
        heroSubtitle: "Delivered safely from our nursery to your doorstep.",
        inventoryTitle: "Current Inventory",
        uploadTitle: "Upload New Cactus",
        labelName: "Cactus Name",
        labelPrice: "Price ($)",
        labelImage: "Image URL",
        helperText: "(For demo, right click any image on Google Images and 'Copy Image Address')",
        btnAddInventory: "Add to Inventory",
        btnUpdateProduct: "Update Product",
        btnCancel: "Cancel",
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
        modalAddCart: "Add to Cart +",
        outOfStock: "Out of Stock"
    },
    es: {
        logout: "Cerrar Sesión",
        addItem: "Agregar Item",
        help: "Ayuda",
        cart: "Carrito",
        heroTitle: "Cactus Raros y Exóticos",
        heroSubtitle: "Entregados con seguridad desde nuestro vivero a tu puerta.",
        inventoryTitle: "Inventario Actual",
        uploadTitle: "Subir Nuevo Cactus",
        labelName: "Nombre del Cactus",
        labelPrice: "Precio ($)",
        labelImage: "URL de Imagen",
        helperText: "(Para demo, clic derecho en cualquier imagen de Google y 'Copiar dirección de imagen')",
        btnAddInventory: "Agregar al Inventario",
        btnUpdateProduct: "Actualizar Producto",
        btnCancel: "Cancelar",
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
        modalAddCart: "Agregar al Carrito +",
        outOfStock: "Agotado"
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
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) langBtn.innerText = currentLang === 'en' ? 'ES' : 'EN';
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && t[key]) (el as HTMLElement).innerText = t[key];
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && t[key]) (el as HTMLInputElement).placeholder = t[key];
    });

    renderPage(currentPage);
    updateCartUI();
    renderFilterControls();
}

/**
 * Toggles the visibility of the help dialog and loads the appropriate content.
 */
function toggleHelp() {
  const dialog = document.getElementById('help-dialog');
  if (!dialog) return;
  if (dialog.style.display === 'none') {
    dialog.style.display = 'block';
    setVersionDisplay();
    const helpFile = currentLang === 'es' ? '/user_es.html' : '/user.html';
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
      const loginModal = document.getElementById("login-modal");
      if (loginModal) loginModal.style.display = "none";
      
      if (products.length === 0) {
        fetchDataAndLoad();
      } else {
        loadUserData();
        injectLogoutButton();
      }
      
      alert(translations[currentLang].alertAccessGranted);
      // Show the admin button
      const adminBtn = document.getElementById("admin-btn");
      if (adminBtn) adminBtn.style.display = "inline-block";
      const syncBtn = document.getElementById("sync-btn");
      if (syncBtn) {
        syncBtn.style.display = "inline-block";
        if (!document.getElementById("reset-schema-btn")) {
          const resetBtn = document.createElement("button");
          resetBtn.id = "reset-schema-btn";
          resetBtn.innerText = "Reset DB";
          resetBtn.className = syncBtn.className;
          resetBtn.style.marginLeft = "10px";
          resetBtn.style.backgroundColor = "#dc3545";
          resetBtn.style.color = "white";
          resetBtn.onclick = resetDatabaseSchema;
          if (syncBtn.parentNode) syncBtn.parentNode.insertBefore(resetBtn, syncBtn.nextSibling);
        } else {
          const resetBtn = document.getElementById("reset-schema-btn");
          if (resetBtn) resetBtn.style.display = "inline-block";
        }
      }
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

function getStorageKey(key: string) {
  return currentUser ? `${key}_${currentUser}` : key;
}

function injectLoginUI() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.style.display = "flex";
  const input = document.getElementById("login-phone");
  if (input) setTimeout(() => input.focus(), 100);
}

function loginUser() {
  const input = document.getElementById("login-phone") as HTMLInputElement;
  const phone = input.value.trim();
  if (!phone) {
    alert(translations[currentLang].alertValidNumber);
    return;
  }
  currentUser = phone;
  const modal = document.getElementById("login-modal");
  if (modal) modal.style.display = "none";
  fetchDataAndLoad();
}

async function fetchDataAndLoad() {
  const savedPage = parseInt(localStorage.getItem('cactusPage') || '1') || 1;
  const savedLimit = parseInt(localStorage.getItem('cactusLimit') || '20') || 20;
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
  try {
    const response = await fetch('/data.json');
    if (!response.ok) throw new Error("Failed to load local data");
    allProducts = await response.json();
    defaultProducts = JSON.parse(JSON.stringify(allProducts));
    loadUserData(false);
    injectLogoutButton();
    renderPage(savedPage);
  } catch (e) {
    console.error("Critical: Failed to load data.json", e);
    const grid = document.getElementById("product-grid");
    if (grid) grid.innerHTML = '<div style="padding:20px; text-align:center; color: #d9534f;"><h3>Connection Error</h3><p>Could not load products. Please ensure the server is running.</p></div>';
  }
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
  const grid = document.getElementById("product-grid");
  if (grid) grid.innerHTML = "";
  const btn = document.getElementById("logout-btn");
  if (btn) btn.style.display = "none";
  
  isAdmin = false;
  const adminBtn = document.getElementById("admin-btn");
  if(adminBtn) adminBtn.style.display = "none";
  const syncBtn = document.getElementById("sync-btn");
  if(syncBtn) syncBtn.style.display = "none";
  const resetBtn = document.getElementById("reset-schema-btn");
  if(resetBtn) resetBtn.style.display = "none";
  
  injectLoginUI();
  const input = document.getElementById("login-phone") as HTMLInputElement;
  if (input) input.value = "";

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
        let stored: Product[] = JSON.parse(storedProducts);

        // Merge schema from defaultProducts (data.json) into stored products
        // This ensures new columns added to data.json appear in the admin's view and are synced.
        if (defaultProducts.length > 0 && stored.length > 0) {
            const freshKeys = Object.keys(defaultProducts[0]) as (keyof Product)[];
            stored = stored.map(storedItem => {
                const freshItem = defaultProducts.find(dp => dp.id === storedItem.id);
                freshKeys.forEach(key => {
                    if ((storedItem as any)[key] === undefined) {
                        (storedItem as any)[key] = freshItem ? (freshItem as any)[key] : null;
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
      cart = JSON.parse(storedCart).filter((item: any) => item);
      updateCartUI();
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
  checkAdminAccess();
}

// Initialize application on page load
window.onload = function () {
  injectLoadingMask();
  setVersionDisplay();
  
  // Inject Filter Container
  const grid = document.getElementById("product-grid");
  if (grid && grid.parentNode) {
    const fc = document.createElement("div");
    fc.id = "filter-container";
    fc.style.fontSize = "xxx-large"; 
    fc.style.marginBottom = "20px";
    grid.parentNode.insertBefore(fc, grid);
    renderFilterControls();
  }

  if (window.location.hash === "#admin") checkAdminAccess();
  else injectLoginUI();

  // Sidebar close listener
  document.addEventListener('click', function(event) {
    // Close help dialog if clicking outside
    const helpDialog = document.getElementById('help-dialog');
    const helpBtn = document.getElementById('help-btn');
    if (helpDialog && helpDialog.style.display !== 'none' && !helpDialog.contains(event.target as Node) && (!helpBtn || !helpBtn.contains(event.target as Node))) {
      helpDialog.style.display = 'none';
    }

    const sidebar = document.getElementById('cart-sidebar');
    const toggleBtn = document.getElementById('cart-toggle-btn');
    
    if (!(event.target as Node).isConnected) return;

    if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(event.target as Node) && toggleBtn && !toggleBtn.contains(event.target as Node)) {
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

function renderFilterControls() {
  const container = document.getElementById("filter-container");
  if (!container) return;

  const label = currentLang === 'es' ? 'Filtrar:' : 'Filter:';
  const allLabel = currentLang === 'es' ? 'Todos' : 'All';

  let html = `<label style="margin-right:10px; font-weight:bold; font-size: xxx-large;">${label}</label>`;
  html += `<select onchange="applyFilter(this.value)" style="padding: 8px; border-radius: 4px; border: 1px solid var(--primary); background: green; font-size: xxx-large;">`;
  
  PLANT_CLASSES.forEach(type => {
      const display = type === 'All' ? allLabel : type;
      html += `<option value="${type}" ${currentFilter === type ? 'selected' : ''}>${display}</option>`;
  });
  html += `</select>`;
  container.innerHTML = html;
}

function applyFilter(type: string) {
  currentFilter = type;
  currentPage = 1;
  pageCache = {};
  renderPage(1);
}

function renderProducts() {
  renderPage(currentPage);
}

/**
 * Renders a specific page of products.
 * Handles both database-backed pagination and client-side pagination (fallback).
 * @param {number} page - The page number to render.
 * @param {boolean} skipFetch - If true, skips fetching from DB (used when data is preloaded).
 */
async function renderPage(page: number, skipFetch = false) {
  localStorage.setItem('cactusPage', page.toString());
  currentPage = page;

  if (useDB && !skipFetch) {
    if (pageCache[page]) {
      // 1. Use Cache immediately (Fast, no mask)
      products = pageCache[page].products;
      totalItems = pageCache[page].total;

      // 2. Background fetch to check for inventory updates (Silent)
      fetch(`/.netlify/functions/get-products?page=${page}&limit=${itemsPerPage}&class=${currentFilter}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            pageCache[page] = { products: data.products, total: data.total };
            // If user is still on the same page, update UI with fresh data
            if (currentPage === page) {
              products = data.products;
              totalItems = data.total;
              renderPage(page, true); // Re-render with fresh data
            }
          }
        })
        .catch(e => console.error("Background stock check failed:", e));
    } else {
      // 3. No Cache: Full fetch with mask
      try {
        showLoadingMask("Loading Products...");
        const res = await fetch(`/.netlify/functions/get-products?page=${page}&limit=${itemsPerPage}&class=${currentFilter}`);
        if (res.ok) {
          const data = await res.json();
          products = data.products;
          totalItems = data.total;
          pageCache[page] = { products: data.products, total: data.total };
        }
      } catch (e) {
        console.error("Error fetching products:", e);
      } finally {
        hideLoadingMask();
      }
    }
  } else if (!useDB) {
    // Client-side pagination
    let visibleProducts = allProducts;
    
    if (currentFilter !== 'All') {
      visibleProducts = visibleProducts.filter(p => {
        if (p.class) return p.class === currentFilter;
        return p.scientific && p.scientific.includes(currentFilter);
      });
    }

    totalItems = visibleProducts.length;
    const start = (page - 1) * itemsPerPage;
    products = visibleProducts.slice(start, start + itemsPerPage);
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (page > totalPages) currentPage = totalPages;
  if (page < 1) currentPage = 1;

  const grid = document.getElementById("product-grid");
  if (grid) {
    grid.innerHTML = "";
    
    products.forEach((product) => {
      // Hide if in cart
      if (hiddenProductIds.has(product.id)) return;

      // Check if scientific name exists
      const sciName = product.scientific
        ? `<div class="scientific-name">${product.scientific}</div>`
        : "";

      let displayImage = product.image_url;
      if (CACHE_IMG) {
        // Use cached image if available, otherwise trigger cache
        displayImage = (imageCache[product.image_url] && imageCache[product.image_url] !== 'pending') 
                            ? imageCache[product.image_url] 
                            : product.image_url;
        if (!imageCache[product.image_url]) cacheImage(product.image_url);
      }

      let stockDisplay = "";
      let btnAttrs = `onclick="addToCart(${product.id})"`;
      let btnText = translations[currentLang].btnAddCart;
      let btnStyle = "";

      if (useDB && product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0) {
        stockDisplay = `<div style="color: red; font-weight: bold; font-size: 0.9em; margin-bottom: 5px;">OUT OF STOCK</div>`;
        btnAttrs = "disabled";
        btnText = translations[currentLang].outOfStock;
        btnStyle = "background-color: #e0e0e0; color: #888; cursor: not-allowed; border-color: #ccc;";
      }

      grid.innerHTML += `
          <div class="product-card">
              <img src="${displayImage}" class="product-image" alt="${product.name}" 
                  onclick="openImageModal(${product.id})" style="cursor:zoom-in;">
              <div class="product-info">
                  <div class="product-name">${product.name}</div>
                  ${sciName}
                  ${product.class ? `<div class="product-class" style="font-size: 0.8em; color: #666;">${product.class}</div>` : ''}
                  ${stockDisplay}
                  <div class="product-price">$${(Number(product.price_cents) / 100).toFixed(2)}</div>
                  <button class="add-btn" ${btnAttrs} style="${btnStyle}">${btnText}</button>
              </div>
          </div>
      `;
    });
  }

  updatePaginationControls(totalItems);
}

function changeItemsPerPage(val: string) {
  itemsPerPage = parseInt(val);
  localStorage.setItem('cactusLimit', itemsPerPage.toString());
  pageCache = {}; // Invalidate cache since page boundaries changed
  renderPage(1);
}

function updatePaginationControls(totalCount: number) {
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

function cacheImage(url: string) {
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
function openImageModal(id: number) {
  const product = products.find((p) => p.id == id);
  if (!product) return;

  if (isAdmin) {
    (document.getElementById("new-name") as HTMLInputElement).value = product.name;
    (document.getElementById("new-price") as HTMLInputElement).value = (product.price_cents / 100).toFixed(2);
    (document.getElementById("new-image") as HTMLInputElement).value = product.image_url;
    editingProductId = product.id;

    const btn = document.querySelector("#admin-modal .add-btn") as HTMLElement;
    if (btn) btn.innerText = translations[currentLang].btnUpdateProduct;

    const adminModal = document.getElementById("admin-modal");
    if (adminModal && adminModal.style.display !== "flex") {
      adminModal.style.display = "flex";
    }
    return;
  }

  const modal = document.getElementById("image-modal");
  const img = document.getElementById("modal-img") as HTMLImageElement;
  const btn = document.getElementById("modal-add-btn") as HTMLButtonElement;

  if (!modal || !img || !btn) return;

  // Set Image
  if (CACHE_IMG && imageCache[product.image_url] && imageCache[product.image_url] !== 'pending') {
    img.src = imageCache[product.image_url];
  } else {
    img.src = product.image_url;
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

  // Reset styles
  btn.disabled = false;
  btn.style.backgroundColor = "";
  btn.style.color = "";
  btn.style.cursor = "";
  btn.style.borderColor = "";

  if (useDB && product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0) {
    btn.innerText = translations[currentLang].outOfStock;
    btn.disabled = true;
    btn.style.backgroundColor = "#e0e0e0";
    btn.style.color = "#888";
    btn.style.cursor = "not-allowed";
    btn.style.borderColor = "#ccc";
    btn.onclick = null;
  }

  modal.style.display = "flex";
}

// Closes the image zoom modal
function closeImageModal() {
  const modal = document.getElementById("image-modal");
  if (modal) modal.style.display = "none";
}

// 3. Admin / Upload Functions
// Toggles the visibility of the admin product upload modal
function toggleAdminModal() {
  const modal = document.getElementById("admin-modal");
  if (!modal) return;
  const isClosed = modal.style.display !== "flex";
  modal.style.display = isClosed ? "flex" : "none";

  if (isClosed) {
    editingProductId = null;
    (document.getElementById("new-name") as HTMLInputElement).value = "";
    (document.getElementById("new-price") as HTMLInputElement).value = "";
    (document.getElementById("new-image") as HTMLInputElement).value = "";
    const btn = document.querySelector("#admin-modal .add-btn") as HTMLElement;
    if (btn) btn.innerText = translations[currentLang].btnAddInventory;
  }
}

// Adds a new product to the 'products' array and re-renders the grid
function addProduct() {
  const name = (document.getElementById("new-name") as HTMLInputElement).value;
  const priceInput = parseFloat((document.getElementById("new-price") as HTMLInputElement).value);
  const price = Math.round(priceInput * 100);
  const image = (document.getElementById("new-image") as HTMLInputElement).value;

  if (name && price && image) {
    if (editingProductId) {
      const product = products.find((p) => p.id === editingProductId);
      if (product) {
        product.name = name;
        product.price_cents = price;
        product.image_url = image;
        alert(translations[currentLang].alertUpdated);
      }
    } else {
      const newProduct: Product = {
        id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
        name: name,
        price_cents: price,
        image_url: image,
      };
      products.push(newProduct);
      alert(translations[currentLang].alertAdded);
    }
    localStorage.setItem(getStorageKey('cactusProducts'), JSON.stringify(products));
    renderProducts();
    // Close modal
    toggleAdminModal();
    // Clear inputs
    (document.getElementById("new-name") as HTMLInputElement).value = "";
    (document.getElementById("new-price") as HTMLInputElement).value = "";
    (document.getElementById("new-image") as HTMLInputElement).value = "";

    editingProductId = null;
    const btn = document.querySelector("#admin-modal .add-btn") as HTMLElement;
    if (btn) btn.innerText = translations[currentLang].btnAddInventory;
  } else {
    alert(translations[currentLang].alertFillFields);
  }
}

// --- Loading Mask Helpers ---
function injectLoadingMask() {
  if (document.getElementById('loading-mask')) return;

  const style = document.createElement('style');
  style.innerHTML = `
    #loading-mask {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(81, 134, 97, 0.9);
        z-index: 10000;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
    .cactus-spinner {
        width: 300px;
        height: auto;
        border-radius: 50%;
    }
    #loading-text {
        margin-top: 20px;
        font-size: 1.5rem;
        font-weight: bold;
        color: #2c3e50;
        font-family: sans-serif;
    }
  `;
  document.head.appendChild(style);

  const mask = document.createElement('div');
  mask.id = 'loading-mask';
  mask.innerHTML = '<img src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGhobHJza2x6c3I0NmFoYjFteHRjcHJocTQ3dXVwcDd2Y2gyN3hwYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2XPiOKpTiLOG4NeXm7/giphy.gif" class="cactus-spinner" alt="Loading..."><div id="loading-text">Processing...</div>';
  document.body.appendChild(mask);
}

function showLoadingMask(text: string) {
  const mask = document.getElementById('loading-mask');
  const txt = document.getElementById('loading-text');
  if (mask && txt) {
    txt.innerText = text || "Loading...";
    mask.style.display = 'flex';
  }
}

function hideLoadingMask() {
  const mask = document.getElementById('loading-mask');
  if (mask) {
    mask.style.display = 'none';
  }
}

// 4. Cart Functions
// Toggles the visibility of the cart sidebar
function toggleCart() {
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

// Adds a product to the cart array and updates the UI
async function addToCart(id: number) {
  let product = products.find((p) => p.id == id);
  if (!product) return;

  // Fetch fresh data from DB to ensure we don't add out-of-stock items
  if (useDB) {
    try {
      const res = await fetch(`/.netlify/functions/get-products?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.products && data.products.length > 0) {
          const freshProduct = data.products[0];
          // Update local product state
          product.quantity = freshProduct.quantity;
          // Update the product in the main list so UI stays consistent
          const idx = products.findIndex(p => p.id == id);
          if (idx !== -1) products[idx] = freshProduct;
        }
      }
    } catch (e) {
      console.error("Error verifying stock:", e);
    }
  }

  // Check inventory before adding
  if (useDB && product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0) {
    alert(translations[currentLang].outOfStock);
    product.quantity = 0; // Update cache to reflect out of stock
    renderPage(currentPage, true); // Re-render to update UI
    return;
  }

  cart.push(product);
  localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
  updateCartUI();
  
  hiddenProductIds.add(product.id);
  renderPage(currentPage);
}

// Re-renders the cart sidebar contents based on the 'cart' array
function updateCartUI() {
  const cartItemsDiv = document.getElementById("cart-items");
  const cartCount = document.getElementById("cart-count");
  const cartTotal = document.getElementById("cart-total");
  const cartFooter = document.getElementById("cart-footer");
  const removeAllBtn = document.querySelector(".remove-all-btn") as HTMLElement;

  // Reset PayPal container and checkout button visibility on cart update
  const paypalContainer = document.getElementById("paypal-button-container");
  if (paypalContainer) paypalContainer.innerHTML = "";
  const checkoutBtn = document.querySelector(".checkout-btn") as HTMLElement;
  if (checkoutBtn) checkoutBtn.style.display = "";

  if (cartCount) cartCount.innerText = cart.length.toString();

  if (cartItemsDiv && cartFooter && cartTotal) {
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = `<p data-i18n="cartEmpty">${translations[currentLang].cartEmpty}</p>`;
        cartFooter.style.display = "none";
        if (removeAllBtn) removeAllBtn.style.display = "none";
    } else {
        if (removeAllBtn) removeAllBtn.style.display = "block";
        cartItemsDiv.innerHTML = "";
        let total = 0;
        cart.forEach((item, index) => {
        if (!item) return;
        const itemPrice = Number(item.price_cents) / 100;
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
}

// Removes an item from the cart by index
function removeFromCart(index: number) {
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
 * Handles logic when payment fails or is cancelled.
 * Clears cache, reloads data, and removes out-of-stock items from cart.
 */
async function handlePaymentReset() {
  // 1. Clear Image Cache
  Object.values(imageCache).forEach(url => {
    if (url && url !== 'pending') URL.revokeObjectURL(url);
  });
  imageCache = {};

  // 2. Reload Data (fetches fresh quantity)
  await fetchDataAndLoad();

  // 3. Check Cart for Out-of-Stock Items
  const initialCount = cart.length;
  cart = cart.filter(item => {
    const freshProduct = products.find(p => p.id === item.id);
    // If product is visible and has 0 quantity, remove it
    if (freshProduct && freshProduct.quantity === 0) return false;
    return true;
  });

  if (cart.length !== initialCount) {
    localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
    updateCartUI();
    alert("Some items were removed from your cart because they are no longer available.");
  }
}

/**
 * Initiates the PayPal checkout process.
 * Dynamically loads the PayPal SDK if not already present and renders the buttons.
 */
async function checkout() {
  const checkoutBtn = document.querySelector(".checkout-btn") as HTMLButtonElement;

  // Check inventory before proceeding
  if (useDB && cart.length > 0) {
    if (checkoutBtn) {
      checkoutBtn.innerText = "Checking Stock...";
      checkoutBtn.disabled = true;
    }

    let outOfStockList: string[] = [];
    let outOfStockIds = new Set<number>();
    let hasChanges = false;

    await Promise.all(cart.map(async (item) => {
      try {
        const res = await fetch(`/.netlify/functions/get-products?id=${item.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.products && data.products.length > 0) {
            const fresh = data.products[0];
            // Update visible products cache
            const p = products.find(p => p.id === item.id);
            if (p) p.quantity = fresh.quantity;

            if (fresh.quantity <= 0) {
              outOfStockList.push(item.name);
              outOfStockIds.add(item.id);
              hasChanges = true;
            }
          }
        }
      } catch (e) {
        console.error("Stock check error:", e);
      }
    }));

    if (hasChanges) {
      cart = cart.filter(item => !outOfStockIds.has(item.id));
      localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
      updateCartUI();
      renderPage(currentPage, true);
      if (checkoutBtn) {
        checkoutBtn.innerText = translations[currentLang].btnCheckout;
        checkoutBtn.disabled = false;
      }
      alert(`The following items are out of stock and have been removed from your cart:\n\n- ${outOfStockList.join('\n- ')}\n\nPlease review your cart and try again.`);
      return;
    }
    
    if (checkoutBtn) {
        checkoutBtn.innerText = translations[currentLang].btnCheckout;
        checkoutBtn.disabled = false;
    }
  }

  if (checkoutBtn) checkoutBtn.style.display = "none";

  const paypalContainer = document.getElementById("paypal-button-container");
  if (!paypalContainer) return;
  paypalContainer.innerHTML = "<div style='text-align:center; margin-top:10px;'>Loading...</div>";

  let CLIENT_ID;
  try {
    const res = await fetch('/.netlify/functions/get-paypal-client-id');
    if (res.ok) {
      const data = await res.json();
      CLIENT_ID = data.clientId;
    }
  } catch (e) {
    console.error("Error fetching PayPal Client ID:", e);
  }

  if (!CLIENT_ID && window.env) CLIENT_ID = window.env.PAYPAL_SANDBOX_CLIENT_ID;

  const locale = currentLang === 'es' ? 'es_ES' : 'en_US';
  const scriptId = 'paypal-sdk';
  let script = document.getElementById(scriptId) as HTMLScriptElement;

  const render = () => {
    paypalContainer.innerHTML = "";
    if (typeof paypal === "undefined" || !paypal || !paypal.Buttons) {
        console.error("PayPal SDK not ready.");
        alert("Payment system loading error. Please try again.");
        if (checkoutBtn) checkoutBtn.style.display = "";
        return;
    }
    
    let orderCreated = false;

    paypal.Buttons({
      createOrder: async function(data: any, actions: any) {
        orderCreated = false;
        // 1. Pre-flight Inventory Check (Right when clicked)
        let outOfStockList: string[] = [];
        let outOfStockIds = new Set<number>();
        
        try {
          await Promise.all(cart.map(async (item) => {
            const res = await fetch(`/.netlify/functions/get-products?id=${item.id}`);
            if (res.ok) {
              const data = await res.json();
              if (data.products && data.products.length > 0) {
                const fresh = data.products[0];
                if (fresh.quantity <= 0) {
                  outOfStockList.push(item.name);
                  outOfStockIds.add(item.id);
                }
              }
            }
          }));
        } catch (e) { console.error("Stock check error", e); }

        if (outOfStockList.length > 0) {
          cart = cart.filter(item => !outOfStockIds.has(item.id));
          localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
          updateCartUI();
          renderPage(currentPage, true);
          alert(`The following items are out of stock and have been removed from your cart:\n\n- ${outOfStockList.join('\n- ')}\n\nPlease review your cart and try again.`);
          // Throwing error to stop PayPal flow. This will be caught by onError.
          throw new Error("PRE_CHECKOUT_OOS");
        }

        return fetch('/.netlify/functions/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart: cart })
        })
        .then(async res => {
          if (!res.ok) {
            const text = await res.text();
            try {
              const json = JSON.parse(text);
              return Promise.reject(new Error(json.error || "PayPal Order Error"));
            } catch (e) {
              return Promise.reject(new Error(text || res.statusText));
            }
          }
          return res.json();
        })
        .then(data => {
          orderCreated = true;
          return data.id;
        });
      },
      onApprove: function(data: any, actions: any) {
        return actions.order.capture().then(function(details: any) {
          // Record the order in the database
          return fetch('/.netlify/functions/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: data.orderID,
              details: details,
              cart: cart
            })
          }).then(() => {
            cart = [];
            localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
            updateCartUI();
            toggleCart();
            setTimeout(function() {
              alert('Transaction completed by ' + details.payer.name.given_name + '!');
            }, 1000);
          }).catch(err => {
            console.error("Error recording order:", err);
            alert('Payment successful, but there was an error saving the receipt.');
          });
        });
      },
      onError: function(err: any) {
        // Handle Pre-Checkout OOS specifically (UI already updated, just reset view)
        if (String(err).includes("PRE_CHECKOUT_OOS")) {
            if (checkoutBtn) {
                checkoutBtn.style.display = "";
                checkoutBtn.innerText = translations[currentLang].btnCheckout;
                checkoutBtn.disabled = false;
            }
            paypalContainer.innerHTML = "";
            return;
        }

        console.error('PayPal Error:', err);
        if (orderCreated) {
            fetch('/.netlify/functions/cancel-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cart: cart })
            }).then(() => handlePaymentReset());
        }
        
        alert('An error occurred during payment.');
        if (checkoutBtn) checkoutBtn.style.display = "";
        paypalContainer.innerHTML = "";
      },
      onCancel: function(data: any) {
        if (orderCreated) {
            fetch('/.netlify/functions/cancel-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cart: cart })
            }).then(() => handlePaymentReset());
        }

        alert("Payment Cancelled");
        if (checkoutBtn) checkoutBtn.style.display = "";
        paypalContainer.innerHTML = "";
      }
    }).render('#paypal-button-container');
  };

  if (!script) {
    if (!CLIENT_ID) {
      alert("Payment configuration missing (Client ID).");
      if (checkoutBtn) checkoutBtn.style.display = "";
      paypalContainer.innerHTML = "";
      return;
    }
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
  
  showLoadingMask("Syncing Database...");

  const btn = document.getElementById("sync-btn") as HTMLButtonElement;
  const originalText = btn.innerText;
  btn.innerText = "Syncing...";
  btn.disabled = true;

  try {
    const response = await fetch('/data.json');
    allProducts = await response.json();
    defaultProducts = JSON.parse(JSON.stringify(allProducts));
    
    // 1. Sync Products (Fix columns, add new items)
    let res = await fetch('/.netlify/functions/seed-data', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: defaultProducts, resetInventory: false })
    });

    let text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { error: text || res.statusText };
    }

    if (!res.ok) throw new Error(data.error || "Unknown error");
    alert("Sync Result: " + (data.message || "Success"));

    // 2. Prompt for Inventory Reset
    if (confirm("Do you want to update the inventory table? (This will DELETE all events and reset quantity to 1)")) {
        res = await fetch('/.netlify/functions/seed-data', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: defaultProducts, resetInventory: true })
        });
        text = await res.text();
        try { data = JSON.parse(text); } catch (e) { data = { error: text }; }
        
        if (!res.ok) throw new Error(data.error || "Inventory reset failed");
        alert("Inventory Result: " + (data.message || "Success"));
    }

  } catch (err: any) {
    alert("Error syncing: " + err.message);
  } finally {
    hideLoadingMask();
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

/**
 * Admin function to reset the database schema.
 * Drops all tables and recreates them.
 */
async function resetDatabaseSchema() {
  if (!confirm("DANGER: This will DROP ALL TABLES and reset the database schema. All data will be lost. Are you sure?")) return;
  
  showLoadingMask("Resetting Schema...");

  const btn = document.getElementById("reset-schema-btn") as HTMLButtonElement;
  const originalText = btn ? btn.innerText : "Reset DB";
  if (btn) {
    btn.innerText = "Resetting...";
    btn.disabled = true;
  }

  try {
    const res = await fetch('/.netlify/functions/reset-schema', { method: 'POST' });
    let text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { error: text || res.statusText }; }

    if (!res.ok) throw new Error(data.error || "Unknown error");
    
    hideLoadingMask();
    alert("Schema Reset Successful: " + (data.message || "Tables recreated."));
    window.location.reload();
  } catch (err: any) {
    hideLoadingMask();
    console.error(err);
    alert("Error resetting schema: " + err.message);
    if (btn) {
      btn.innerText = originalText;
      btn.disabled = false;
    }
  }
}