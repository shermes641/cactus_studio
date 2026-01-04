// State for the shopping cart
let cart = [];
let isAdmin = false;
let editingProductId = null;
let currentUser = null;
let defaultProducts = [];
let products = [];

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

// --- SECURITY / ADMIN CHECK LOGIC ---
// Simple hash-based admin check. If URL ends in #admin, prompts for password.
function checkAdminAccess() {
  if (isAdmin) return;
  // Check if URL ends with #admin
  if (window.location.hash === "#admin") {
    const password = prompt("Enter Admin Password:");
    if (password === "LILY") {
      isAdmin = true;
      currentUser = "admin";
      if (document.getElementById("login-modal")) document.getElementById("login-modal").style.display = "none";
      loadUserData();
      injectLogoutButton();
      alert("Admin access granted.");
      // Show the admin button
      document.getElementById("admin-btn").style.display = "inline-block";
      const hiddenBtn = document.getElementById("hidden-mgr-btn");
      if (hiddenBtn) hiddenBtn.style.display = "inline-block";
    } else {
      alert("Incorrect Password.");
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
}

function loginUser() {
  const phone = document.getElementById("login-phone").value.trim();
  if (!phone) {
    alert("Please enter a valid number.");
    return;
  }
  currentUser = phone;
  document.getElementById("login-modal").style.display = "none";
  loadUserData();
  injectLogoutButton();
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
  const storedCart = localStorage.getItem(getStorageKey('cactusCart'));
  if (storedCart) {
    try {
      cart = JSON.parse(storedCart);
      // Remove hidden items from cart on load
      const initialCount = cart.length;
      cart = cart.filter(item => {
        const product = products.find(p => p.id === item.id);
        return !product || !product.hidden;
      });
      if (cart.length !== initialCount) localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
      updateCartUI();
    } catch (e) {
      console.error("Error loading cart from localStorage:", e);
    }
  } else {
    cart = [];
    updateCartUI();
  }
  renderProducts();
  localStorage.setItem(getStorageKey('cactusProducts'), JSON.stringify(products));
  updateHiddenCount();
  checkAdminAccess();
}

// Initialize application on page load
window.onload = function () {
  setVersionDisplay();
  fetch('/data.json')
    .then(response => response.json())
    .then(data => {
      products = data;
      defaultProducts = JSON.parse(JSON.stringify(products));
      
      if (window.location.hash === "#admin") loadUserData();
      else injectLoginUI();
    })
    .catch(err => console.error("Error loading products:", err));
};

// Listen for hash changes to trigger admin check dynamically
window.addEventListener("hashchange", checkAdminAccess);
// ------------------------------------

// 2. Render Products
// --- UPDATED: Render Products with Clickable Images ---
// Dynamically generates HTML for the product grid based on the 'products' array
function renderProducts() {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";
  products.forEach((product) => {
    if (product.hidden) return;
    // Check if scientific name exists
    const sciName = product.scientific
      ? `<div class="scientific-name">${product.scientific}</div>`
      : "";

    grid.innerHTML += `
        <div class="product-card">
            <!-- Added onclick event here for zooming -->
            <img src="${product.image}" class="product-image" alt="${
      product.name
    }" 
                 onclick="openImageModal(${
                   product.id
                 })" style="cursor:zoom-in;">
            
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                ${sciName}
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <button class="add-btn" onclick="addToCart(${
                  product.id
                })">Add to Cart</button>
            </div>
        </div>
    `;
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
    if (btn) btn.innerText = "Update Product";

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
    if (btn) btn.innerText = "Add to Inventory";
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
        alert("Cactus updated!");
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
      alert("Cactus added to inventory!");
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
    if (btn) btn.innerText = "Add to Inventory";
  } else {
    alert("Please fill in all fields.");
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
}

// Adds a product to the cart array and updates the UI
function addToCart(id) {
  const product = products.find((p) => p.id === id);
  cart.push(product);
  localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
  updateCartUI();
  toggleCart();
}

// Re-renders the cart sidebar contents based on the 'cart' array
function updateCartUI() {
  const cartItemsDiv = document.getElementById("cart-items");
  const cartCount = document.getElementById("cart-count");
  const cartTotal = document.getElementById("cart-total");
  const cartFooter = document.getElementById("cart-footer");

  cartCount.innerText = cart.length;

  if (cart.length === 0) {
    cartItemsDiv.innerHTML = "<p>Your cart is empty.</p>";
    cartFooter.style.display = "none";
  } else {
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
                    <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer;">Remove</button>
                </div>
            `;
    });
    cartTotal.innerText = total.toFixed(2);
    cartFooter.style.display = "block";
  }
}

// Removes an item from the cart by index
function removeFromCart(index) {
  cart.splice(index, 1);
  localStorage.setItem(getStorageKey('cactusCart'), JSON.stringify(cart));
  updateCartUI();
}

// Placeholder for checkout functionality
function checkout() {
  alert("This would go to payment!");
}
