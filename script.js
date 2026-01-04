// State for the shopping cart
let cart = [];
let isAdmin = false;
let editingProductId = null;
let currentUser = null;
let defaultProducts = [];
let products = [];
let currentPage = 1;
const itemsPerPage = 20;
const hiddenProductIds = new Set();

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

// At the top of your /script.js file
const APP_VERSION = '1.0.0';

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

// Since your script tag is at the end of the <body>,
// the DOM will be ready, and you can call the function directly.
setVersionDisplay();
applyTranslations();

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'es' : 'en';
    localStorage.setItem('cactusLang', currentLang);

    // Close help dialog if open
    const helpDialog = document.getElementById('help-dialog');
    if (helpDialog && helpDialog.style.display !== 'none') {
        helpDialog.style.display = 'none';
    }

    // Close cart sidebar if open
    const sidebar = document.getElementById("cart-sidebar");
    if (sidebar && sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
    }

    applyTranslations();
}

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

function fetchDataAndLoad() {
  fetch('/data.json')
    .then(response => response.json())
    .then(data => {
      products = data;
      defaultProducts = JSON.parse(JSON.stringify(products));
      loadUserData();
      injectLogoutButton();
    })
    .catch(err => console.error("Error loading products:", err));
}

function logoutUser() {
  const wasAdmin = isAdmin;
  currentUser = null;
  cart = [];
  updateCartUI();
  document.getElementById("product-grid").innerHTML = "";
  const btn = document.getElementById("logout-btn");
  if (btn) btn.style.display = "none";
  
  isAdmin = false;
  const adminBtn = document.getElementById("admin-btn");
  if(adminBtn) adminBtn.style.display = "none";
  const hiddenMgrBtn = document.getElementById("hidden-mgr-btn");
  if(hiddenMgrBtn) hiddenMgrBtn.style.display = "none";
  
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

function loadUserData() {
  // Only admin loads modified products. Regular users use default (fresh) data.
  if (currentUser === 'admin') {
    const storedProducts = localStorage.getItem(getStorageKey('cactusProducts'));
    if (storedProducts) {
      try {
        products = JSON.parse(storedProducts);
      } catch (e) {
        console.error("Error loading products from localStorage:", e);
        products = JSON.parse(JSON.stringify(defaultProducts));
      }
    } else {
      products = JSON.parse(JSON.stringify(defaultProducts));
    }
  } else {
    products = JSON.parse(JSON.stringify(defaultProducts));
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

  renderProducts();
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
    if (helpDialog && helpDialog.style.display !== 'none') {
      if (!helpDialog.contains(event.target) && (!helpBtn || !helpBtn.contains(event.target))) {
        helpDialog.style.display = 'none';
      }
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

function renderPage(page) {
  // Filter: Not hidden by admin AND not in cart (hiddenProductIds)
  const visibleProducts = products.filter(p => !p.hidden && !hiddenProductIds.has(p.id));
  
  const totalPages = Math.ceil(visibleProducts.length / itemsPerPage) || 1;
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  
  currentPage = page;
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const productsToShow = visibleProducts.slice(start, end);

  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";
  
  productsToShow.forEach((product) => {
    // Check if scientific name exists
    const sciName = product.scientific
      ? `<div class="scientific-name">${product.scientific}</div>`
      : "";

    grid.innerHTML += `
        <div class="product-card">
            <img src="${product.image}" class="product-image" alt="${product.name}" 
                 onclick="openImageModal(${product.id})" style="cursor:zoom-in;">
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                ${sciName}
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <button class="add-btn" onclick="addToCart(${product.id})">${translations[currentLang].btnAddCart}</button>
            </div>
        </div>
    `;
  });

  updatePaginationControls(visibleProducts.length);
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
  
  container.innerHTML = html;
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
  img.src = product.image;

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
      total += item.price;
      cartItemsDiv.innerHTML += `
                <div class="cart-item">
                    <div>
                        <strong>${item.name}</strong><br>
                        $${item.price.toFixed(2)}
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

// Placeholder for checkout functionality
function checkout() {
  alert(translations[currentLang].alertPayment);
}
