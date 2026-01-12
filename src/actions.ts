//force build
import { state } from './state.js';
import { translations, PLANT_CLASSES } from './constants.js';
import { getStorageKey, showLoadingMask, hideLoadingMask } from './utils.js';
import { updateCartUI, injectLogoutButton, injectLoginUI, toggleAdminModal, updatePaginationControls, groupSidebarElements, setupDropZone, ensureAdminFieldsExist, renderFilterControls, showPromptModal } from './ui.js';
import { Product } from './types.js';

declare const paypal: any;
declare const window: any;

export async function uploadImagesToCloudinary(force: boolean = false) {
  if (!force && !confirm('Upload all product images to Cloudinary and update database? This may take several minutes.')) return;
  
  const batchSize = 20; // Process 20 products per request
  let offset = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let allFailures: any[] = [];
  let hasMore = true;
  
  showLoadingMask('Starting upload...');
  
  try {
    while (hasMore) {
      const res = await fetch('/.netlify/functions/upload-images-to-cloudinary', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force, offset, limit: batchSize })
      });
      
      const data = await res.json().catch(() => null);
      
      if (!res.ok) {
        hideLoadingMask();
        const err = (data && data.error) ? data.error : res.statusText;
        alert('Image upload failed: ' + err);
        return;
      }
      
      totalUpdated += data.updated || 0;
      totalSkipped += data.skipped || 0;
      if (data.failures && data.failures.length > 0) {
        allFailures = allFailures.concat(data.failures);
      }
      
      hasMore = data.hasMore;
      offset = data.processed || (offset + batchSize);
      
      // Update progress
      showLoadingMask(`Uploading images... ${data.processed || offset} / ${data.total || '?'} processed`);
      
      // Small delay to avoid overwhelming the server
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    hideLoadingMask();
    
    if (totalUpdated === 0 && allFailures.length > 0) {
      alert(`Upload failed for all images.\nFirst error: ${allFailures[0].error}\n\nPlease check your Cloudinary Cloud Name and Upload Preset.`);
    } else if (totalUpdated === 0 && totalSkipped > 0) {
      if (confirm(`No images uploaded. ${totalSkipped} images were skipped because they already have Cloudinary URLs.\n\nDo you want to FORCE re-upload all images?`)) {
        await uploadImagesToCloudinary(true);
        return;
      }
    } else {
      alert(`Image upload completed!\nUpdated: ${totalUpdated} images\nSkipped: ${totalSkipped}\nFailures: ${allFailures.length}`);
    }
    
    // Refresh product data
    try { fetchDataAndLoad(); } catch (e) { /* ignore */ }
  } catch (e: any) {
    hideLoadingMask();
    console.error('Image upload error', e);
    alert('Image upload error: ' + (e && e.message ? e.message : String(e)));
  }
}

export function toggleLanguage() {
    const nextLang = state.currentLang === 'en' ? 'es' : 'en';
    const msg = translations[state.currentLang].alertLangChange;

    if (confirm(msg)) {
      state.currentLang = nextLang;
      localStorage.setItem('cactusLang', state.currentLang);
      logoutUser();
      window.location.reload();
    }
  }

export async function loginUserEmail() {
  const emailInput = document.getElementById("login-email") as HTMLInputElement;
  const passwordInput = document.getElementById("login-password") as HTMLInputElement;
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert(translations[state.currentLang].alertValidNumber || "Email and password required");
    return;
  }

  showLoadingMask("Logging in...");

  try {
    const res = await fetch("/.netlify/functions/login-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      hideLoadingMask();
      alert(data.error || "Login failed");
      return;
    }

    // store user in state
    state.currentUser = email;
    state.currentUserData = data.user;
    // set admin flag from server
    state.isAdmin = !!(data.user && data.user.is_admin);
    localStorage.setItem("currentUserEmail", email);
    localStorage.setItem("currentUserData", JSON.stringify(data.user));
    
    // Persist admin session if admin
    if (state.isAdmin) {
      localStorage.setItem("adminSession", "true");
    }

    const authContainer = document.getElementById("auth-container");
    if (authContainer) authContainer.style.display = "none";

    // Fetch server-side user data (cart/shipping) and merge with guest cart and user cart
    try {
      const serverRes = await fetch('/.netlify/functions/get-user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const serverJson = serverRes.ok ? await serverRes.json() : null;
      const serverCart = serverJson && serverJson.user ? (serverJson.user.cart || []) : [];
      const serverShipping = serverJson && serverJson.user ? serverJson.user.shipping_addr : null;

      const guestKey = getStorageKey('cactusCart', null);
      const userKey = getStorageKey('cactusCart', state.currentUser);
      const guestRaw = localStorage.getItem(guestKey);
      const userRaw = localStorage.getItem(userKey);

      const guestCart = guestRaw ? JSON.parse(guestRaw) : [];
      const userCart = userRaw ? JSON.parse(userRaw) : [];

      // Merge carts: serverCart < userCart < guestCart (guest has priority additions)
      const mergedMap: { [id: number]: any } = {};
      [...serverCart, ...userCart, ...guestCart].forEach((item: any) => {
        if (!item || !item.id) return;
        const id = Number(item.id);
        if (!mergedMap[id]) mergedMap[id] = { ...item };
        else {
          const existing = mergedMap[id];
          existing.quantity = (existing.quantity || 0) + (item.quantity || 1);
        }
      });
      const merged = Object.values(mergedMap);
      state.cart = merged;
      localStorage.setItem(userKey, JSON.stringify(state.cart));
      updateCartUI();

      // If server shipping exists but user doesn't have one locally, populate
      if ((!state.currentUserData || !state.currentUserData.shipping_addr) && serverShipping) {
        state.currentUserData = state.currentUserData || {};
        state.currentUserData.shipping_addr = serverShipping;
        localStorage.setItem('currentUserData', JSON.stringify(state.currentUserData));
      }

      // Persist merged result back to server
      await fetch('/.netlify/functions/save-user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cart: state.cart, shipping_addr: state.currentUserData ? state.currentUserData.shipping_addr : null })
      });
    } catch (e) {
      console.warn('Server sync failed on login:', e);
    }

    await fetchDataAndLoad();
    
    // If user is admin, show admin panel
    if (state.isAdmin) {
      const adminBtn = document.getElementById("admin-btn");
      if (adminBtn) adminBtn.style.display = "inline-block";
      const syncBtn = document.getElementById("sync-btn");
      if (syncBtn) {
        syncBtn.style.display = "inline-block";
        let uploadImagesBtn = document.getElementById("upload-images-btn");
        if (!uploadImagesBtn) {
          uploadImagesBtn = document.createElement("button");
          uploadImagesBtn.id = "upload-images-btn";
          uploadImagesBtn.innerText = "Upload Imgs";
          uploadImagesBtn.className = syncBtn.className;
          uploadImagesBtn.style.marginLeft = "10px";
          uploadImagesBtn.style.backgroundColor = "#17a2b8";
          uploadImagesBtn.style.color = "white";
          uploadImagesBtn.onclick = () => uploadImagesToCloudinary();
          if (syncBtn.parentNode) syncBtn.parentNode.insertBefore(uploadImagesBtn, syncBtn.nextSibling);
        }
        uploadImagesBtn.style.display = "inline-block";
      }
      const migrateBtn = document.getElementById("run-migrate-btn");
      if (migrateBtn) migrateBtn.style.display = "inline-block";
    }
    
    hideLoadingMask();
  } catch (e) {
    hideLoadingMask();
    console.error("Login error:", e);
    alert("Login failed: " + (e instanceof Error ? e.message : "Unknown error"));
  }
}

export async function registerUser() {
  const nameInput = document.getElementById("register-name") as HTMLInputElement;
  const emailInput = document.getElementById("register-email") as HTMLInputElement;
  const passwordInput = document.getElementById("register-password") as HTMLInputElement;
  const confirmInput = document.getElementById("register-password-confirm") as HTMLInputElement;
  const addressInput = document.getElementById("register-address") as HTMLInputElement;

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const passwordConfirm = confirmInput.value.trim();
  const shipping_addr = addressInput.value.trim();

  if (!email || !password) {
    alert("Email and password are required");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }

  if (password !== passwordConfirm) {
    alert("Passwords do not match");
    return;
  }

  showLoadingMask("Registering...");

  try {
    const res = await fetch("/.netlify/functions/register-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || null, shipping_addr: shipping_addr || null })
    });

    const data = await res.json();

    if (!res.ok) {
      hideLoadingMask();
      alert(data.error || "Registration failed");
      return;
    }

    hideLoadingMask();
    alert("Registration successful! Please login.");
    toggleRegisterForm();

    // Clear form
    nameInput.value = "";
    emailInput.value = "";
    passwordInput.value = "";
    confirmInput.value = "";
    addressInput.value = "";
  } catch (e) {
    hideLoadingMask();
    console.error("Registration error:", e);
    alert("Registration failed: " + (e instanceof Error ? e.message : "Unknown error"));
  }
}

export function toggleRegisterForm() {
  const loginForm = document.getElementById("login-modal") as HTMLElement;
  const registerForm = document.getElementById("register-modal") as HTMLElement;
  
  if (!loginForm || !registerForm) return;

  const loginVisible = loginForm.style.display !== "none";
  loginForm.style.display = loginVisible ? "none" : "block";
  registerForm.style.display = loginVisible ? "block" : "none";
}

export function removeAllFromCart() {
    if (!state.cart || !state.cart.length) return;
    for (let i = state.cart.length - 1; i >= 0; i--) {
        removeFromCart(i);
    }
}

export async function runMigration() {
  if (!confirm('Run non-destructive DB migration now?')) return;
  showLoadingMask('Running migration...');
  try {
    const res = await fetch('/.netlify/functions/migrate-schema', { method: 'POST' });
    const data = await res.json().catch(() => null);
    hideLoadingMask();
    if (!res.ok) {
      const err = (data && data.error) ? data.error : res.statusText;
      alert('Migration failed: ' + err);
      return;
    }
    const actions = data && data.actions ? data.actions : [];
    alert('Migration completed. Actions:\n' + actions.join('\n'));
    // Optionally refresh product data and admin UI
    try { fetchDataAndLoad(); } catch (e) { /* ignore */ }
  } catch (e: any) {
    hideLoadingMask();
    console.error('Migration error', e);
    alert('Migration error: ' + (e && e.message ? e.message : String(e)));
  }
}

export function loginUser() {
  const input = document.getElementById("login-phone") as HTMLInputElement;
  const phone = input.value.trim();
  if (!phone) {
    alert(translations[state.currentLang].alertValidNumber);
    return;
  }
  state.currentUser = phone;
  const modal = document.getElementById("login-modal");
  if (modal) modal.style.display = "none";
  fetchDataAndLoad();
}

export async function fetchDataAndLoad() {
  groupSidebarElements();
  const savedPage = parseInt(localStorage.getItem('cactusPage') || '1') || 1;
  const savedLimit = parseInt(localStorage.getItem('cactusLimit') || '20') || 20;
  state.itemsPerPage = savedLimit;
  state.currentPage = savedPage;
  state.pageCache = {};

  try {
    const res = await fetch(`/.netlify/functions/get-products?page=${savedPage}&limit=${savedLimit}`);
    if (res.ok) {
      const data = await res.json();
      state.useDB = true;
      state.products = data.products;
      state.totalItems = data.total;
      state.pageCache[savedPage] = { products: data.products, total: data.total };
      loadUserData(false);
      injectLogoutButton();
      renderPage(savedPage, true);
      return;
    }
  } catch (e) {
    console.log("DB load failed, falling back to data.json", e);
  }
}

export function logoutUser() {
  const wasAdmin = state.isAdmin;
  const currentUser = state.currentUser;
  const currentUserData = state.currentUserData;
  state.currentUser = null;
  state.cart = [];
  state.pageCache = {};
  updateCartUI();
  const grid = document.getElementById("product-grid");
  if (grid) grid.innerHTML = "";
  const btn = document.getElementById("logout-btn");
  if (btn) btn.style.display = "none";
  
  state.isAdmin = false;
  const adminBtn = document.getElementById("admin-btn");
  if(adminBtn) adminBtn.style.display = "none";
  const syncBtn = document.getElementById("sync-btn");
  if(syncBtn) syncBtn.style.display = "none";
  const migrateBtn = document.getElementById("run-migrate-btn");
  if(migrateBtn) migrateBtn.style.display = "none";
  const uploadImagesBtn = document.getElementById("upload-images-btn");
  if(uploadImagesBtn) uploadImagesBtn.style.display = "none";
  const resetBtn = document.getElementById("reset-schema-btn");
  if(resetBtn) resetBtn.style.display = "none";
  
  // Clear admin session from localStorage
  localStorage.removeItem("adminSession");
  localStorage.removeItem("currentUserEmail");
  localStorage.removeItem("currentUserData");
  
  // Persist current cart and shipping to server (best-effort)
  try {
    if (currentUser) {
      const userKey = getStorageKey('cactusCart', currentUser);
      const cart = JSON.parse(localStorage.getItem(userKey) || '[]');
      const shipping = currentUserData ? currentUserData.shipping_addr : null;
      fetch('/.netlify/functions/save-user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser, cart, shipping_addr: shipping })
      }).catch(e => console.warn('Failed to persist on logout', e));
    }

  } catch (e) { console.warn('Logout persist failed', e); }

  injectLoginUI();
  // Clear login/register inputs (preserve stored localStorage for later reuse)
  state.currentUserData = null;
  const emailInput = document.getElementById("login-email") as HTMLInputElement;
  const passInput = document.getElementById("login-password") as HTMLInputElement;
  if (emailInput) emailInput.value = "";
  if (passInput) passInput.value = "";
  const nameInput = document.getElementById("register-name") as HTMLInputElement;
  const regEmail = document.getElementById("register-email") as HTMLInputElement;
  const regPass = document.getElementById("register-password") as HTMLInputElement;
  const regConfirm = document.getElementById("register-password-confirm") as HTMLInputElement;
  const regAddr = document.getElementById("register-address") as HTMLInputElement;
  if (nameInput) nameInput.value = "";
  if (regEmail) regEmail.value = "";
  if (regPass) regPass.value = "";
  if (regConfirm) regConfirm.value = "";
  if (regAddr) regAddr.value = "";

  if (wasAdmin) {
    window.location.href = window.location.pathname;
  }
}

export function loadUserData(render = true) {
  if (state.currentUser === 'admin' && !state.useDB) {
    const storedProducts = localStorage.getItem(getStorageKey('cactusProducts', state.currentUser));
    if (storedProducts) {
      try {
        let stored: Product[] = JSON.parse(storedProducts);
        if (state.defaultProducts.length > 0 && stored.length > 0) {
            const freshKeys = Object.keys(state.defaultProducts[0]) as (keyof Product)[];
            stored = stored.map(storedItem => {
                const freshItem = state.defaultProducts.find(dp => dp.id === storedItem.id);
                freshKeys.forEach(key => {
                    if ((storedItem as any)[key] === undefined) {
                        (storedItem as any)[key] = freshItem ? (freshItem as any)[key] : null;
                    }
                });
                return storedItem;
            });
        }
        state.allProducts = stored;
      } catch (e) {
        console.error("Error loading products from localStorage:", e);
        state.allProducts = JSON.parse(JSON.stringify(state.defaultProducts));
      }
    } else {
      state.allProducts = JSON.parse(JSON.stringify(state.defaultProducts));
    }
  } else if (!state.useDB) {
    state.allProducts = JSON.parse(JSON.stringify(state.defaultProducts));
  }
  const storedCart = localStorage.getItem(getStorageKey('cactusCart', state.currentUser));
  if (storedCart) {
      state.cart = JSON.parse(storedCart).filter((item: any) => item);
      updateCartUI();
  } else {
    state.cart = [];
    updateCartUI();
  }

  state.hiddenProductIds.clear();
  state.cart.forEach(item => state.hiddenProductIds.add(item.id));

  if (render) renderPage(1);
  localStorage.setItem(getStorageKey('cactusProducts', state.currentUser), JSON.stringify(state.products));
  //checkAdminAccess();
}

export function applyFilter(type: string) {
  state.currentFilter = type;
  state.currentPage = 1;
  state.pageCache = {};
  renderPage(1);
}

export async function renderPage(page: number, skipFetch = false) {
  localStorage.setItem('cactusPage', page.toString());
  state.currentPage = page;

  if (state.useDB && !skipFetch) {
    if (state.pageCache[page]) {
      state.products = state.pageCache[page].products;
      state.totalItems = state.pageCache[page].total;

      fetch(`/.netlify/functions/get-products?page=${page}&limit=${state.itemsPerPage}&class=${state.currentFilter}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            state.pageCache[page] = { products: data.products, total: data.total };
            if (state.currentPage === page) {
              state.products = data.products;
              state.totalItems = data.total;
              renderPage(page, true);
            }
          }
        })
        .catch(e => console.error("Background stock check failed:", e));
    } else {
      try {
        showLoadingMask("Loading Products...");
        const res = await fetch(`/.netlify/functions/get-products?page=${page}&limit=${state.itemsPerPage}&class=${state.currentFilter}`);
        if (res.ok) {
          const data = await res.json();
          state.products = data.products;
          state.totalItems = data.total;
          state.pageCache[page] = { products: data.products, total: data.total };
        }
      } catch (e) {
        console.error("Error fetching products:", e);
      } finally {
        hideLoadingMask();
      }
    }
  } else if (!state.useDB) {
    let visibleProducts = state.allProducts;
    
    if (state.currentFilter !== 'All') {
      visibleProducts = visibleProducts.filter(p => {
        if (p.class) return p.class === state.currentFilter;
        return p.scientific && p.scientific.includes(state.currentFilter);
      });
    }

    state.totalItems = visibleProducts.length;
    const start = (page - 1) * state.itemsPerPage;
    state.products = visibleProducts.slice(start, start + state.itemsPerPage);
  }

  const totalPages = Math.ceil(state.totalItems / state.itemsPerPage) || 1;
  if (page > totalPages) state.currentPage = totalPages;
  if (page < 1) state.currentPage = 1;

  if (state.products) {
    state.products.sort((a, b) => {
      const aQty = (state.useDB && a.quantity !== undefined && a.quantity !== null) ? Number(a.quantity) : 1;
      const bQty = (state.useDB && b.quantity !== undefined && b.quantity !== null) ? Number(b.quantity) : 1;
      const aOOS = aQty <= 0;
      const bOOS = bQty <= 0;
      if (aOOS === bOOS) return 0;
      return aOOS ? 1 : -1;
    });
  }

  const grid = document.getElementById("product-grid");
  if (grid) {
    grid.classList.add('fade-out');
    await new Promise(resolve => setTimeout(resolve, 500));

    grid.innerHTML = "";
    
    state.products.forEach((product) => {
      if (state.hiddenProductIds.has(product.id)) return;

      const sciName = product.scientific
        ? `<div class="scientific-name">${product.scientific}</div>`
        : "";

      let displayImage = product.image_url;

      let stockDisplay = "";
      let btnAttrs = `onclick="addToCart(${product.id})"`;
      let btnText = translations[state.currentLang].btnAddCart;
      let btnStyle = "";

      if (state.useDB && product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0) {
        stockDisplay = `<div style="color: red; font-weight: bold; font-size: 0.9em; margin-bottom: 5px;">OUT OF STOCK</div>`;
        btnAttrs = "disabled";
        btnText = translations[state.currentLang].outOfStock;
        btnStyle = "background-color: #e0e0e0; color: #888; cursor: not-allowed; border-color: #ccc;";
      }

      grid.innerHTML += `
          <div class="product-card">
              <picture>
                <source media="(max-width: 600px)" srcset="${displayImage}?w=300,q=auto,f_webp" type="image/webp">
                <source media="(max-width: 900px)" srcset="${displayImage}?w_400,q_auto,f_webp" type="image/webp">
                <img src="${displayImage}?w=500,q_auto" 
                     srcset="${displayImage}?w=300,q_auto 300w, ${displayImage}?w=400,q_auto 400w, ${displayImage}?w=500,q_auto 500w"
                     sizes="(max-width: 600px) 300px, (max-width: 900px) 400px, 500px"
                     class="product-image" 
                     alt="${product.name}" 
                     loading="lazy"
                     onclick="openImageModal(${product.id})" 
                     style="cursor:zoom-in;">
              </picture>
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
    setTimeout(() => grid.classList.remove('fade-out'), 50);
  }

  updatePaginationControls(state.totalItems);
}

export function changeItemsPerPage(val: string) {
  state.itemsPerPage = parseInt(val);
  localStorage.setItem('cactusLimit', state.itemsPerPage.toString());
  state.pageCache = {};
  renderPage(1);
}

export async function addProduct() {
  const name = (document.getElementById("new-name") as HTMLInputElement).value;
  const priceInput = parseFloat((document.getElementById("new-price") as HTMLInputElement).value);
  const price = Math.round(priceInput * 100);
  let image = (document.getElementById("new-image") as HTMLInputElement).value;
  const scientific = (document.getElementById("new-scientific") as HTMLInputElement)?.value || "";
  const productClass = (document.getElementById("new-class") as HTMLSelectElement)?.value || "None";
  const notes = (document.getElementById("new-notes") as HTMLTextAreaElement)?.value || "";

  if (state.pendingUploadFile) {
      showLoadingMask("Uploading image...");
      try {
        const configRes = await fetch('/.netlify/functions/get-cloudinary-config');
        if (!configRes.ok) throw new Error("Failed to get Cloudinary config");
        const config = await configRes.json();
        
        const formData = new FormData();
        formData.append("file", state.pendingUploadFile);
        formData.append("upload_preset", config.uploadPreset);
        
        if (image && image.includes('cloudinary.com')) {
            const matches = image.match(/\/upload\/(?:v\d\/)?(.)\.[^.]$/);
            if (matches && matches[1]) formData.append("public_id", matches[1]);
        }

        const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        image = data.secure_url;
      } catch (e: any) {
          hideLoadingMask();
          alert("Image upload failed: "  + e.message);
          return;
      }
      hideLoadingMask();
  }

  if (name && price && image) {
    if (state.editingProductId) {
      const product = state.products.find((p) => p.id === state.editingProductId);
      if (product) {
        product.name = name;
        product.price_cents = price;
        product.image_url = image;
        product.scientific = scientific;
        product.class = productClass;
        product.notes = notes;

        if (state.useDB) {
          await fetch('/.netlify/functions/update-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: product.id, name, price_cents: price, image_url: image, scientific, class: productClass, notes })
          }).catch(e => console.error("Failed to update DB", e));
        }

        alert(translations[state.currentLang].alertUpdated);
      }
    } else {
      const newProduct: Product = {
        id: state.products.length > 0 ? Math.max(...state.products.map(p => p.id)) + 1 : 1,
        name: name,
        price_cents: price,
        image_url: image,
        quantity: 1,
        scientific: scientific,
        class: productClass,
        notes: notes,
      };

      if (state.useDB) {
        try {
          const res = await fetch('/.netlify/functions/update-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, price_cents: price, image_url: image, scientific, class: productClass, notes })
          });
          
          if (!res.ok) {
            const err = await res.text();
            throw new Error(err || res.statusText);
          }

          const data = await res.json();
          if (data.id) newProduct.id = Number(data.id);
        } catch (e: any) { 
          console.error("Failed to add to DB", e);
          alert("Failed to save to database: " + e.message);
          return;
        }
      }

      state.products.push(newProduct);
      alert(translations[state.currentLang].alertAdded);
    }
    localStorage.setItem(getStorageKey('cactusProducts', state.currentUser), JSON.stringify(state.products));
    renderPage(state.currentPage); // renderProducts alias
    toggleAdminModal();
    (document.getElementById("new-name") as HTMLInputElement).value = "";
    (document.getElementById("new-price") as HTMLInputElement).value = "";
    (document.getElementById("new-image") as HTMLInputElement).value = "";
    (document.getElementById("new-scientific") as HTMLInputElement).value = "";
    (document.getElementById("new-class") as HTMLSelectElement).selectedIndex = 0;
    (document.getElementById("new-notes") as HTMLTextAreaElement).value = "";
    setupDropZone("");
    state.editingProductId = null;
    const btn = document.querySelector("#admin-modal .add-btn") as HTMLElement;
    if (btn) btn.innerText = translations[state.currentLang].btnAddInventory;
  } else {
    alert(translations[state.currentLang].alertFillFields);
  }
}

export async function addToCart(id: number) {
  let product = state.products.find((p) => p.id == id);
  if (!product) return;

  if (state.useDB) {
    try {
      const res = await fetch(`/.netlify/functions/get-products?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.products && data.products.length > 0) {
          const freshProduct = data.products[0];
          product.quantity = freshProduct.quantity;
          const idx = state.products.findIndex(p => p.id == id);
          if (idx !== -1) state.products[idx] = freshProduct;
        }
      }
    } catch (e) {
      console.error("Error verifying stock:", e);
    }
  }

  if (state.useDB && product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0) {
    alert(translations[state.currentLang].outOfStock);
    product.quantity = 0;
    renderPage(state.currentPage, true);
    return;
  }

  state.cart.push(product);
  localStorage.setItem(getStorageKey('cactusCart', state.currentUser), JSON.stringify(state.cart));
  updateCartUI();
  
  state.hiddenProductIds.add(product.id);
  renderPage(state.currentPage);
}

export function removeFromCart(index: number) {
  const item = state.cart[index];
  if (item) {
    state.hiddenProductIds.delete(item.id);
  }

  state.cart.splice(index, 1);
  localStorage.setItem(getStorageKey('cactusCart', state.currentUser), JSON.stringify(state.cart));
  updateCartUI();
  renderPage(state.currentPage);
}

export async function handlePaymentReset() {
  await fetchDataAndLoad();

  const initialCount = state.cart.length;
  state.cart = state.cart.filter(item => {
    const freshProduct = state.products.find(p => p.id === item.id);
    if (freshProduct && freshProduct.quantity === 0) return false;
    return true;
  });

  if (state.cart.length !== initialCount) {
    localStorage.setItem(getStorageKey('cactusCart', state.currentUser), JSON.stringify(state.cart));
    updateCartUI();
    alert("Some items were removed from your cart because they are no longer available.");
  }
}

export async function checkout() {
  const checkoutBtn = document.querySelector(".checkout-btn") as HTMLButtonElement;

  if (state.useDB && state.cart.length > 0) {
    if (checkoutBtn) {
      checkoutBtn.innerText = "Checking Stock...";
      checkoutBtn.disabled = true;
    }

    let outOfStockList: string[] = [];
    let outOfStockIds = new Set<number>();
    let hasChanges = false;

    await Promise.all(state.cart.map(async (item) => {
      try {
        const res = await fetch(`/.netlify/functions/get-products?id=${item.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.products && data.products.length > 0) {
            const fresh = data.products[0];
            const p = state.products.find(p => p.id === item.id);
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
      state.cart = state.cart.filter(item => !outOfStockIds.has(item.id));
      localStorage.setItem(getStorageKey('cactusCart', state.currentUser), JSON.stringify(state.cart));
      updateCartUI();
      renderPage(state.currentPage, true);
      if (checkoutBtn) {
        checkoutBtn.innerText = translations[state.currentLang].btnCheckout;
        checkoutBtn.disabled = false;
      }
      alert(`The following items are out of stock and have been removed from your cart:\n\n- ${outOfStockList.join('\n- ')}\n\nPlease review your cart and try again.`);
      return;
    }
    
    if (checkoutBtn) {
        checkoutBtn.innerText = translations[state.currentLang].btnCheckout;
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

  if (!CLIENT_ID && (window as any).env) CLIENT_ID = (window as any).env.PAYPAL_SANDBOX_CLIENT_ID;

  const locale = state.currentLang === 'es' ? 'es_ES' : 'en_US';
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
        let outOfStockList: string[] = [];
        let outOfStockIds = new Set<number>();
        
        try {
          await Promise.all(state.cart.map(async (item) => {
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
          state.cart = state.cart.filter(item => !outOfStockIds.has(item.id));
          localStorage.setItem(getStorageKey('cactusCart', state.currentUser), JSON.stringify(state.cart));
          updateCartUI();
          renderPage(state.currentPage, true);
          alert(`The following items are out of stock and have been removed from your cart:\n\n- ${outOfStockList.join('\n- ')}\n\nPlease review your cart and try again.`);
          throw new Error("PRE_CHECKOUT_OOS");
        }

        return fetch('/.netlify/functions/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart: state.cart })
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
          return fetch('/.netlify/functions/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: data.orderID,
              details: details,
              cart: state.cart
            })
          }).then(() => {
            state.cart = [];
            localStorage.setItem(getStorageKey('cactusCart', state.currentUser), JSON.stringify(state.cart));
            updateCartUI();
            // toggleCart(); // Circular dep if imported, but we can rely on window or just import it.
            // Since toggleCart is in UI, and we import UI, we can call it.
            const { toggleCart } = require('./ui');
            toggleCart();
            setTimeout(function() {
              alert('Transaction completed by ' + details.payer.name.given_name + '!');
            }, 500);
          }).catch(err => {
            console.error("Error recording order:", err);
            alert('Payment successful, but there was an error saving the receipt.');
          });
        });
      },
      onError: function(err: any) {
        if (String(err).includes("PRE_CHECKOUT_OOS")) {
            if (checkoutBtn) {
                checkoutBtn.style.display = "";
                checkoutBtn.innerText = translations[state.currentLang].btnCheckout;
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
              body: JSON.stringify({ cart: state.cart })
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
              body: JSON.stringify({ cart: state.cart })
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

export async function syncDatabase() {
  if (!confirm("Are you sure you want to sync data.json to the database?")) return;
  
  showLoadingMask("Syncing Database...");

  const btn = document.getElementById("sync-btn") as HTMLButtonElement;
  const originalText = btn.innerText;
  btn.innerText = "Syncing...";
  btn.disabled = true;

  try {
    const response = await fetch('/data.json');
    state.allProducts = await response.json();
    state.defaultProducts = JSON.parse(JSON.stringify(state.allProducts));
    
    let res = await fetch('/.netlify/functions/seed-data', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: state.defaultProducts, resetInventory: false })
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

    if (confirm("Do you want to update the inventory table? (This will DELETE all events and reset quantity to 1)")) {
        res = await fetch('/.netlify/functions/seed-data', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: state.defaultProducts, resetInventory: true })
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

export async function resetDatabaseSchema() {
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

export function openImageModal(id: number) {
  const product = state.products.find((p) => p.id == id);
  if (!product) return;

  if (state.isAdmin) {
    ensureAdminFieldsExist();
    (document.getElementById("new-name") as HTMLInputElement).value = product.name;
    (document.getElementById("new-price") as HTMLInputElement).value = (product.price_cents / 100).toFixed(2);
    (document.getElementById("new-image") as HTMLInputElement).value = product.image_url;
    (document.getElementById("new-scientific") as HTMLInputElement).value = product.scientific || "";
    (document.getElementById("new-class") as HTMLSelectElement).value = product.class || "None";
    (document.getElementById("new-notes") as HTMLTextAreaElement).value = product.notes || "";
    setupDropZone(product.image_url);
    state.editingProductId = product.id;

    const btn = document.querySelector("#admin-modal .add-btn") as HTMLElement;
    if (btn) btn.innerText = translations[state.currentLang].btnUpdateProduct;

    const title = document.querySelector("#admin-modal h2") as HTMLElement;
    if (title) title.innerText = "Edit Cactus";

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
  let src = product.image_url || '';

  if (src.includes('cloudinary.com')) {
    src = src
      .replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/')
      .replace('http://', 'https://');
  }

  img.src = src;

  btn.innerText = translations[state.currentLang].modalAddCart;
  btn.onclick = function () {
    addToCart(product.id);
  };

  // Reset styles
  btn.disabled = false;
  btn.style.backgroundColor = "";
  btn.style.color = "";
  btn.style.cursor = "";
  btn.style.borderColor = "";

  if (state.useDB && product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0) {
    btn.innerText = translations[state.currentLang].outOfStock;
    btn.disabled = true;
    btn.style.backgroundColor = "#e0e0e0";
    btn.style.color = "#888";
    btn.style.cursor = "not-allowed";
    btn.style.borderColor = "#ccc";
    btn.onclick = null;
  }

  modal.style.display = "flex";
}

// Legacy functions to satisfy script.ts imports
export function openCloudinaryUpload() {
  console.warn("openCloudinaryUpload is deprecated");
}
export async function uploadToCloudinary(event: any) {
  console.warn("uploadToCloudinary is deprecated");
}

export async function identifyPlant(imageUrl: string) {
  showLoadingMask("Identifying plant...");
  
  let data: any = null;
  let usedApi = 'Kindwise';
  const failedApis: string[] = [];

  try {
    try {
      //throw new Error('test'); // force error to skip Kindwise for now
      const res = await fetch('/.netlify/functions/identify-plant-kindwise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || res.statusText);
      data = json;
    } catch (e) {
      console.error("Kindwise identification failed, trying OpenAI:", e);
      failedApis.push('Kindwise');
      usedApi = 'ChatGPT';
      try {
        const res = await fetch('/.netlify/functions/identify-plant-openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl })
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || res.statusText);
        data = json;
      } catch (e2) {
        console.error("ChatGPT identification failed, trying Ollama:", e2);
        failedApis.push('ChatGPT');
        usedApi = 'Ollama';
        try {
            const res = await fetch('/.netlify/functions/identify-plant-ollama', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl })
            });
            const json = await res.json();
            if (!res.ok || json.error) throw new Error(json.error || res.statusText);
            data = json;
        } catch (e3) {
            console.error("Ollama identification failed, trying Gemini:", e3);
            failedApis.push('Ollama');
            usedApi = 'Gemini';
            try {
                const res = await fetch('/.netlify/functions/identify-plant-gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageUrl })
                });
                const json = await res.json();
                if (!res.ok || json.error) throw new Error(json.error || res.statusText);
                data = json;
            } catch (e4) {
                console.error("Gemini identification failed, trying Grok:", e4);
                failedApis.push('Gemini');
                usedApi = 'Grok';
                try {
                    const res = await fetch('/.netlify/functions/identify-plant-grok', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl })
                    });
                    data = await res.json();
                    if (data.error) console.error("Grok identification failed:", data.error);
                } catch (e5) {
                    console.error("Grok identification failed:", e5);
                    data = { error: e5 instanceof Error ? e5.message : String(e5) };
                }
            }
        }
      }
    }

    hideLoadingMask();
    
    if (data && data.error) {
        failedApis.push(usedApi);
        const uniqueFailed = [...new Set(failedApis)];

        const promptText = "Can you identify this plant? Please provide the only Scientific Name: and Class: only as text";
        
        const copyToClipboard = async () => {
            showLoadingMask("Copying to clipboard...");
            try {
let blob: Blob;

// Load image
if (imageUrl.startsWith('data:')) {
    blob = await (await fetch(imageUrl)).blob();
} else {
    const resp = await fetch(imageUrl);
    blob = await resp.blob();
}

// Ensure PNG (Gemini is safest with PNG)
if (blob.type !== 'image/png') {
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await new Promise<void>(r => (img.onload = () => r()));

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    blob = await new Promise<Blob>(r =>
        canvas.toBlob(b => r(b!), 'image/png')
    );
}

// Minimal HTML — TEXT ONLY
const htmlBlob = new Blob(
    [promptText + '<br>'],
    { type: 'text/html' }
);

// Plain text fallback
const textBlob = new Blob(
    [promptText],
    { type: 'text/plain' }
);

// Clipboard payload tuned for Gemini
const item = new ClipboardItem({
    'image/png': blob,
    'text/html': htmlBlob,
    'text/plain': textBlob
});

await navigator.clipboard.write([item]);

            } catch (e) {
                console.error("Clipboard write failed", e);
                navigator.clipboard.writeText(promptText).catch(() => {});
            } finally {
                hideLoadingMask();
            }
        };

        const webAis: {[key: string]: string} = {
            'ChatGPT': 'https://chatgpt.com',
            'Gemini': 'https://gemini.google.com/app',
            'Grok': 'https://grok.com'
        };

        const options = uniqueFailed.filter(api => webAis[api]);

        if (options.length > 0) {
            let msg = `Identification failed with: ${uniqueFailed.join(', ')}.\n\nSelect a service to open manually (Prompt & Image will be copied):\n`;
            options.forEach((api, i) => {
                msg += `${i + 1}. ${api}\n`;
            });

            const selection = prompt(msg);
            if (selection) {
                const index = parseInt(selection) - 1;
                if (index >= 0 && index < options.length) {
                    const selectedApi = options[index];
                    await copyToClipboard();
                    window.open(webAis[selectedApi], '_blank');

                    const pasted = await showPromptModal("Paste the AI response here to parse Class and Scientific Name:", "", promptText, imageUrl);
                    if (pasted) {
                        const cleanStr = (s: string) => s.replace(/[*`]/g, '').trim();
                        
                        const classMatch = pasted.match(/(?:Class|Genus)[\s*:]+((?:(?!(?:Scientific|Scientific Name)[\s*:]).)+)/i);
                        const sciMatch = pasted.match(/(?:Scientific Name|Scientific)[\s*:]+((?:(?!(?:Class|Genus)[\s*:]).)+)/i);
                        
                        const extractedClass = classMatch ? cleanStr(classMatch[1]) : null;
                        const extractedSci = sciMatch ? cleanStr(sciMatch[1]) : null;

                        if (extractedClass || extractedSci) {
                             const cls = document.getElementById('new-class') as HTMLSelectElement;
                             const sci = document.getElementById('new-scientific') as HTMLInputElement;

                             if (extractedClass && cls) {
                                let exists = false;
                                for (let i = 0; i < cls.options.length; i++) {
                                    if (cls.options[i].value === extractedClass) {
                                        exists = true;
                                        break;
                                    }
                                }

                                if (!exists) {
                                    if (confirm(`Class '${extractedClass}' is not in the list. Add it to the database?`)) {
                                        try {
                                            await fetch('/.netlify/functions/add-plant-class', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ name: extractedClass })
                                            });
                                            state.plantClasses.push(extractedClass);
                                            const opt = document.createElement('option');
                                            opt.value = extractedClass;
                                            opt.innerText = extractedClass;
                                            cls.appendChild(opt);
                                            renderFilterControls();
                                        } catch (e) { console.error(e); alert("Failed to add class"); }
                                    }
                                }
                                cls.value = extractedClass;
                                cls.dispatchEvent(new Event('change'));
                             }

                             if (extractedSci && sci) {
                                 sci.value = extractedSci;
                             }
                        }
                    }
                }
            }
        } else if (usedApi === 'Ollama') {
            alert(`Identification failed (${usedApi}): ${data.error}\n\nEnsure Ollama is running locally (port 11434) with a vision model (e.g. 'llava').`);
        } else {
            alert(`Identification failed (${usedApi}): ` + data.error);
        }
        return;
    }

    if (data.class && data.scientific) {
       if (data.class === 'Unknown' || data.scientific === 'Unknown') {
           alert(`The AI (${usedApi}) analyzed the image but could not identify the plant.`);
           return;
       }

       if (confirm(`Identified by ${usedApi}:\nClass: ${data.class}\nScientific: ${data.scientific}\n\nDo you want to use these values?`)) {
          const cls = document.getElementById('new-class') as HTMLSelectElement;
          const sci = document.getElementById('new-scientific') as HTMLInputElement;
          
          if (cls) { 
            let exists = false;
            for (let i = 0; i < cls.options.length; i++) {
                if (cls.options[i].value === data.class) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                if (confirm(`Class '${data.class}' is not in the list. Add it to the database?`)) {
                    try {
                        await fetch('/.netlify/functions/add-plant-class', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: data.class })
                        });
                        state.plantClasses.push(data.class);
                        const opt = document.createElement('option');
                        opt.value = data.class;
                        opt.innerText = data.class;
                        cls.appendChild(opt);
                        renderFilterControls();
                    } catch (e) { console.error(e); alert("Failed to add class"); return; }
                } else {
                    return;
                }
            }

            cls.value = data.class; 
            cls.dispatchEvent(new Event('change')); 
          }
          if (sci) sci.value = data.scientific;
       }
    } else {
        alert("Could not identify plant.");
    }
  } catch (e) { hideLoadingMask(); console.error(e); alert("Identification error"); }
}

export async function fetchPlantClasses() {
  try {
    const res = await fetch('/.netlify/functions/get-plant-classes');
    if (res.ok) {
      const classes = await res.json();
      state.plantClasses = ['All', ...classes];
      renderFilterControls();
    }
  } catch (e) {
    console.error("Failed to fetch plant classes", e);
  }
}
