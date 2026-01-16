//force build
import { state } from './state.js';
import { translations } from './constants.js';
import { getStorageKey, showLoadingMask, hideLoadingMask, showPromptModal } from './utils.js';
import { updateCartUI, injectLogoutButton, injectLoginUI, toggleAdminModal, toggleProfileModal, updatePaginationControls, groupSidebarElements, setupDropZone, ensureAdminFieldsExist, renderFilterControls, toggleForgotPasswordForm, updateHamburgerUserInfo, injectAdminButtons, removeAdminButtons, toggleCart, setupPasswordStrengthMeter } from './ui.js';
import { Product, Discount } from './types.js';

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
      window.location.reload();
    }
  }

export async function loginUserEmail() {
  const emailInput = document.getElementById("login-email") as HTMLInputElement;
  const passwordInput = document.getElementById("login-password") as HTMLInputElement;
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert(translations[state.currentLang].alertEmailPasswordRequired);
    return;
  }

  showLoadingMask(translations[state.currentLang].loadingLogin);

  try {
    const res = await fetch("/.netlify/functions/login-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      hideLoadingMask();
      
      if (res.status === 403 && data.notVerified) {
        if (confirm(translations[state.currentLang].alertVerifyEmail)) {
          showLoadingMask(translations[state.currentLang].loadingSending);
          try {
            const resendRes = await fetch("/.netlify/functions/resend-verification", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email })
            });
            const resendData = await resendRes.json();
            hideLoadingMask();
            
            if (resendRes.ok) {
              if (resendData.verificationLink) {
                await showPromptModal("TEST MODE: Verification Link", resendData.verificationLink, resendData.verificationLink, null, resendData.emailBody);
              } else {
                alert(translations[state.currentLang].alertVerificationSent);
              }
            } else {
              alert(resendData.error || "Failed to send verification code");
            }
          } catch (e) {
            hideLoadingMask();
            alert(translations[state.currentLang].alertNetworkError);
          }
        }
        return;
      }

      alert(data.error || translations[state.currentLang].alertLoginFailed);
      return;
    }

    const profileBtn = document.getElementById("profile-btn");
    if (profileBtn) {
      profileBtn.style.display = "block";
      profileBtn.classList.remove("hidden");
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

    updateHamburgerUserInfo(state.currentUser, state.isAdmin);

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
      injectAdminButtons();
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
    alert(translations[state.currentLang].alertEmailPasswordRequired);
    return;
  }

  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
  if (!passwordRegex.test(password)) {
    alert(translations[state.currentLang].alertPasswordRequirements);
    return;
  }

  if (password !== passwordConfirm) {
    alert(translations[state.currentLang].alertPasswordsDoNotMatch);
    return;
  }

  showLoadingMask(translations[state.currentLang].loadingRegister);

  try {
    const res = await fetch("/.netlify/functions/register-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || null, shipping_addr: shipping_addr || null })
    });

    const data = await res.json();

    if (!res.ok) {
      hideLoadingMask();
      alert(data.error || translations[state.currentLang].alertRegistrationFailed);
      return;
    }

    hideLoadingMask();
    
    if (data.verificationLink) {
      await showPromptModal("TEST MODE: Verification Link", data.verificationLink, data.verificationLink, null, data.emailBody);
    } else {
      alert(translations[state.currentLang].alertRegistrationSuccess);
    }
    
    toggleRegisterForm();

    // Clear form
    nameInput.value = "";
    emailInput.value = "";
    passwordInput.value = "";
    confirmInput.value = "";
    addressInput.value = "";

    // Reset strength meter
    passwordInput.dispatchEvent(new Event('input'));
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

  if (loginVisible) {
    setTimeout(() => setupPasswordStrengthMeter(), 100);
  }
}

export async function applyDiscountCode() {
    const input = document.getElementById('discount-code-input') as HTMLInputElement;
    if (!input) return;
    const code = input.value.trim().toUpperCase();
    if (!code) return;

    try {
        const emailParam = state.currentUser ? `&email=${encodeURIComponent(state.currentUser)}` : '';
        const res = await fetch(`/.netlify/functions/validate-discount?code=${code}${emailParam}`);
        const data = await res.json();

        if (!res.ok) {
            let msg = data.error;
            const t = translations[state.currentLang];
            if (msg === 'You have no active discounts') msg = t.alertNoActiveDiscounts;
            else if (msg === 'Discount code not found in your account') msg = t.alertDiscountNotAssigned;
            else if (msg === 'Discount code is not active') msg = t.alertDiscountNotActive;
            else if (msg === 'Discount code not found') msg = t.alertDiscountInvalid;
            
            alert(msg || t.alertDiscountInvalid);
            input.value = '';
            state.activeDiscount = null;
        } else {
            state.activeDiscount = data.discount as Discount;
            alert(translations[state.currentLang].alertDiscountApplied || 'Discount applied!');
        }
        updateCartUI();
    } catch (e) {
        console.error('Discount validation error:', e);
        alert(translations[state.currentLang].errorValidatingDiscount);
        state.activeDiscount = null;
        updateCartUI();
    }
}

export function removeDiscount(e?: Event) {
    if (e) e.stopPropagation();
    state.activeDiscount = null;
    updateCartUI();
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
  const { currentUser, currentUserData } = state;
  state.currentUser = null;
  state.cart = [];
  state.pageCache = {};
  updateCartUI();
  const grid = document.getElementById("product-grid");
  if (grid) grid.innerHTML = "";
  const noRes = document.getElementById("no-results-message");
  if (noRes) noRes.remove();
  const btn = document.getElementById("logout-btn");
  if (btn) btn.style.display = "none";
  
  state.isAdmin = false;
  
  updateHamburgerUserInfo(null, false);
  
  removeAdminButtons();
  const profileBtn = document.getElementById("profile-btn");
  if(profileBtn) {
    profileBtn.style.display = "none";
    profileBtn.classList.add("hidden");
  }
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

export function handleSearch(query: string) {
  const prev = state.searchQuery;
  state.searchQuery = query;
  
  const prevEffective = prev.length >= 2;
  const currentEffective = query.length >= 2;
  
  if (prevEffective || currentEffective) {
      state.currentPage = 1;
      state.pageCache = {};
      renderPage(1, false, true);
  }
}

export async function renderPage(page: number, skipFetch = false, suppressLoading = false) {
  localStorage.setItem('cactusPage', page.toString());
  state.currentPage = page;

  if (state.useDB && !skipFetch) {
    if (state.pageCache[page]) {
      state.products = state.pageCache[page].products;
      state.totalItems = state.pageCache[page].total;

      const searchParam = state.searchQuery.length >= 2 ? `&search=${encodeURIComponent(state.searchQuery)}` : '';
      fetch(`/.netlify/functions/get-products?page=${page}&limit=${state.itemsPerPage}&class=${state.currentFilter}${searchParam}`)
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
        if (!suppressLoading) showLoadingMask("Loading Products...");
        const searchParam = state.searchQuery.length >= 2 ? `&search=${encodeURIComponent(state.searchQuery)}` : '';
        const res = await fetch(`/.netlify/functions/get-products?page=${page}&limit=${state.itemsPerPage}&class=${state.currentFilter}${searchParam}`);
        if (res.ok) {
          const data = await res.json();
          state.products = data.products;
          state.totalItems = data.total;
          state.pageCache[page] = { products: data.products, total: data.total };
        }
      } catch (e) {
        console.error("Error fetching products:", e);
      } finally {
        if (!suppressLoading) hideLoadingMask();
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

    if (state.searchQuery.length >= 2) {
        const q = state.searchQuery.toLowerCase();
        visibleProducts = visibleProducts.filter(p => {
            const price = (p.price_cents / 100).toFixed(2);
            const sku = `BOT-${p.id}-STD`.toLowerCase();
            return p.name.toLowerCase().includes(q) || 
                   price.includes(q) ||
                   sku.includes(q);
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
    
    const existingMsg = document.getElementById('no-results-message');
    if (existingMsg) existingMsg.remove();
    
    if (state.products.length === 0) {
      const msgDiv = document.createElement('div');
      msgDiv.id = 'no-results-message';
      // msgDiv.style.cssText = "position: fixed; bottom: 20px; left: 20px; background: white; padding: 20px; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1000; max-width: 300px;";
      msgDiv.innerHTML = `
          <h3 class="no-results-title">${translations[state.currentLang].noResultsTitle}</h3>
          <p class="no-results-text">${translations[state.currentLang].noResultsText}</p>
      `;
      document.body.appendChild(msgDiv);
    }

    state.products.forEach((product) => {
      // if (state.hiddenProductIds.has(product.id)) return;

      const sciName = product.scientific
        ? `<span class="scientific-name">${product.scientific}</span>`
        : "";

      const classDisplay = product.class
        ? `<span class="product-class">${product.class}</span>`
        : "";

      const metaRow = (sciName || classDisplay)
        ? `<div class="product-meta-row">
             ${sciName}
             ${classDisplay}
           </div>`
        : "";

      const skuDisplay = product.sku
        ? `<span class="product-sku">SKU: ${product.sku}</span>`
        : "";

      let matchInfo = "";
      if (state.searchQuery && state.searchQuery.length >= 2) {
        const q = state.searchQuery.toLowerCase();
        const matches: string[] = [];
        const t = translations[state.currentLang];

        if (product.name.toLowerCase().includes(q)) matches.push(t.labelMatchName);
        if (product.scientific && product.scientific.toLowerCase().includes(q)) matches.push(t.labelMatchSci);
        
        const price = (Number(product.price_cents) / 100).toFixed(2);
        if (price.includes(q)) matches.push(t.labelMatchPrice);
        
        const genSku = `BOT-${product.id}-STD`.toLowerCase();
        if ((product.sku && product.sku.toLowerCase().includes(q)) || genSku.includes(q)) matches.push(t.labelMatchSku);

        if (matches.length > 0) {
            matchInfo = `<span class="match-info">${t.labelMatchMatched}: ${matches.join(", ")}</span>`;
        }
      }

      const detailsRow = (skuDisplay || matchInfo)
        ? `<div class="product-details-row">
             ${skuDisplay}
             ${matchInfo}
           </div>`
        : "";

      let displayImage = product.image_url;

      let stockDisplay = "";
      let btnAttrs = `onclick="addToCart(${product.id})"`;
      let btnText = translations[state.currentLang].btnAddCart;
      let btnClass = "";

      if (state.useDB && product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0) {
        stockDisplay = `<div class="out-of-stock-label">${translations[state.currentLang].outOfStock.toUpperCase()}</div>`;
        btnAttrs = "disabled";
        btnText = translations[state.currentLang].outOfStock;
        btnClass = "btn-disabled-custom";
      } else if (state.hiddenProductIds.has(product.id)) {
        stockDisplay = `<div class="out-of-stock-label">${(translations[state.currentLang].itemInCart || "Item in Cart").toUpperCase()}</div>`;
        btnAttrs = "disabled";
        btnText = translations[state.currentLang].itemInCart || "Item in Cart";
        btnClass = "btn-disabled-custom";
      }

      grid.innerHTML += `
          <div class="product-card">
              <picture>
                <source media="(max-width: 600px)" srcset="${displayImage}?w=300,q=auto,f_webp" type="image/webp">
                <source media="(max-width: 900px)" srcset="${displayImage}?w_400,q_auto,f_webp" type="image/webp">
                <img src="${displayImage}?w=500,q_auto" 
                     srcset="${displayImage}?w=300,q_auto 300w, ${displayImage}?w=400,q_auto 400w, ${displayImage}?w=500,q_auto 500w"
                     sizes="(max-width: 600px) 300px, (max-width: 900px) 400px, 500px"
                     class="product-image product-image-zoom" 
                     alt="${product.name}" 
                     loading="lazy"
                     onclick="openImageModal(${product.id})">
              </picture>
              <div class="product-info">
                  <div class="product-name">${product.name}</div>
                  ${metaRow}
                  ${detailsRow}
                  ${stockDisplay}
                  <div class="product-price">$${(Number(product.price_cents) / 100).toFixed(2)}</div>
                  <button class="add-btn ${btnClass}" ${btnAttrs}>${btnText}</button>
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
  if (state.hiddenProductIds.has(id)) return;
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
    alert(translations[state.currentLang].alertCartItemsRemoved);
  }
}

export function updateCurrency(currency: string) {
  (state as any).currency = currency;
  updateCartUI();
}

export async function checkout() {
  const checkoutBtn = document.querySelector(".checkout-btn") as HTMLButtonElement;

  const shippingInput = document.getElementById("cart-shipping-address") as HTMLTextAreaElement;
  const inputAddr = shippingInput ? shippingInput.value.trim() : "";
  const storedAddr = (state.currentUserData?.shipping_addr || "").trim();
  
  let finalShippingAddr = "";

  if (inputAddr) {
      finalShippingAddr = inputAddr;
      if (!storedAddr && state.currentUser) {
          await updateShippingAddress(inputAddr);
      }
  } else {
      finalShippingAddr = storedAddr;
  }

  if (state.currentUser && !finalShippingAddr) {
    alert(translations[state.currentLang].alertShippingAddressRequired);
    return;
  }

  if (state.useDB && state.cart.length > 0) {
    if (checkoutBtn) {
      checkoutBtn.innerText = translations[state.currentLang].checkingStock;
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
      alert(`${translations[state.currentLang].outOfStockRemoved}\n\n- ${outOfStockList.join('\n- ')}\n\nPlease review your cart and try again.`);
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
  showLoadingMask("Loading Payment Options...");

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
  
  const currency = (state as any).currency || (state.currentLang === 'en' ? 'USD' : 'CRC');
  // PayPal does not support CRC, so we use USD for the transaction
  const paymentCurrency = currency === 'CRC' ? 'USD' : currency;

  const render = () => {
    paypalContainer.innerHTML = "";
    // Loading mask is hidden when buttons render or on error
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
          alert(`${translations[state.currentLang].outOfStockRemoved}\n\n- ${outOfStockList.join('\n- ')}\n\nPlease review your cart and try again.`);
          throw new Error("PRE_CHECKOUT_OOS");
        }

        return fetch('/.netlify/functions/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: state.cart,
            discountCode: state.activeDiscount ? state.activeDiscount.code : null,
            shippingAddress: finalShippingAddr,
            currency: paymentCurrency
          })
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
              cart: state.cart,
              discountCode: state.activeDiscount ? state.activeDiscount.code : null,
              shippingAddress: finalShippingAddr,
              currency: paymentCurrency,
              userId: state.currentUserData ? state.currentUserData.id : null
            })
          }).then(() => {
            state.cart = [];
            localStorage.setItem(getStorageKey('cactusCart', state.currentUser), JSON.stringify(state.cart));
            updateCartUI();
            // Since toggleCart is in UI, and we import UI, we can call it directly.
            toggleCart();
            setTimeout(function() {
              alert(translations[state.currentLang].alertTransactionSuccess.replace('{name}', details.payer.name.given_name));
              window.location.reload();
            }, 500);
          }).catch(err => {
            console.error("Error recording order:", err);
            alert(translations[state.currentLang].alertPaymentSavedError);
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
        
        alert(translations[state.currentLang].paymentError);
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

        alert(translations[state.currentLang].paymentCancel);
        if (checkoutBtn) checkoutBtn.style.display = "";
        paypalContainer.innerHTML = "";
      }
    }).render('#paypal-button-container').then(() => {
        hideLoadingMask();
    });
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
        hideLoadingMask();
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

export async function openImageModal(id: number, fromCart: boolean = false) {
  let product = state.products.find((p) => p.id == id);

  if (!product) {
    // If not on the current page, check the cart
    product = state.cart.find((p) => p.id == id);
  }

  // If still not found and we're using a DB, fetch it directly
  if (!product && state.useDB) {
    try {
      showLoadingMask("Loading product...");
      const res = await fetch(`/.netlify/functions/get-products?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.products && data.products.length > 0) {
          product = data.products[0];
        }
      }
    } catch (e) {
      console.error("Failed to fetch product for modal", e);
    } finally {
      hideLoadingMask();
    }
  }
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
  btn.classList.remove("btn-disabled-custom");
  btn.style.display = fromCart ? "none" : "";

  if (state.useDB && product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0) {
    btn.innerText = translations[state.currentLang].outOfStock;
    btn.disabled = true;
    btn.classList.add("btn-disabled-custom");
    btn.onclick = null;
  } else if (state.hiddenProductIds.has(product.id) && !fromCart) {
    btn.innerText = translations[state.currentLang].itemInCart || "Item in Cart";
    btn.disabled = true;
    btn.classList.add("btn-disabled-custom");
    btn.onclick = null;
  }

  modal.style.display = "flex";
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

        const promptText = "Can you identify this plant? Please provide only the Scientific Name: and Class: as text";
        
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

                                if (!exists && confirm(`Class '${extractedClass}' is not in the list. Add it to the database?`)) {
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

export async function openProfileModal(userData?: any) {
  const targetUser = userData || state.currentUserData;
  if (!targetUser) return;
  
  const nameInput = document.getElementById("profile-name") as HTMLInputElement;
  const phoneInput = document.getElementById("profile-phone") as HTMLInputElement;
  const addrInput = document.getElementById("profile-address") as HTMLInputElement;
  const hiddenUserInput = document.getElementById("profile-username-hidden") as HTMLInputElement;
  
  if (nameInput) nameInput.value = targetUser.name || "";
  if (phoneInput) phoneInput.value = targetUser.phone || "";
  if (addrInput) addrInput.value = targetUser.shipping_addr || "";
  if (hiddenUserInput) hiddenUserInput.value = targetUser.email || "";
  
  // Admin Discount Logic
  const modalContent = document.querySelector("#profile-modal .modal-content");
  const existingDiscountDiv = document.getElementById("admin-discount-wrapper");
  if (existingDiscountDiv) existingDiscountDiv.remove();

  if (state.isAdmin && modalContent) {
      const discountDiv = document.createElement("div");
      discountDiv.id = "admin-discount-wrapper";
      discountDiv.className = "form-group";
      discountDiv.classList.add("admin-discount-wrapper");

      const label = document.createElement("label");
      label.innerText = "Discount Code (Admin Only)";
      discountDiv.appendChild(label);

      const select = document.createElement("select");
      select.id = "profile-discount-select";
      select.className = "profile-discount-select";
      
      const noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.innerText = "None";
      select.appendChild(noneOpt);

      try {
          const res = await fetch('/.netlify/functions/get-discounts');
          if (res.ok) {
              const discounts = await res.json();
              discounts.forEach((d: any) => {
                  const opt = document.createElement("option");
                  opt.value = d.code;
                  opt.innerText = d.code;
                  if (targetUser.discount_code === d.code) opt.selected = true;
                  select.appendChild(opt);
              });
          }
      } catch (e) { console.error(e); }

      discountDiv.appendChild(select);
      
      const saveBtn = modalContent.querySelector("button.add-btn");
      if (saveBtn) modalContent.insertBefore(discountDiv, saveBtn);
  }

  toggleProfileModal();
}

export async function saveProfile() {
  const name = (document.getElementById("profile-name") as HTMLInputElement).value;
  const phone = (document.getElementById("profile-phone") as HTMLInputElement).value;
  const shipping_addr = (document.getElementById("profile-address") as HTMLInputElement).value;
  const email = (document.getElementById("profile-username-hidden") as HTMLInputElement).value || state.currentUser;
  
  const discountSelect = document.getElementById("profile-discount-select") as HTMLSelectElement;
  const discount_code = discountSelect ? discountSelect.value : undefined;
  
  showLoadingMask("Updating profile...");
  
  try {
    const body: any = { email, name, phone, shipping_addr };
    if (discount_code !== undefined) body.discount_code = discount_code || null;

    const res = await fetch('/.netlify/functions/update-user-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data = await res.json();
    hideLoadingMask();
    
    if (!res.ok) throw new Error(data.error || "Update failed");
    
    if (email === state.currentUser) {
        state.currentUserData = data.user;
        localStorage.setItem("currentUserData", JSON.stringify(data.user));
    }
    
    alert(translations[state.currentLang].alertProfileUpdated);
    toggleProfileModal();
    
    // Refresh admin list if needed (optional, requires re-fetching)
    if (state.isAdmin) {
        const select = document.getElementById("admin-user-select") as HTMLSelectElement;
        if (select) {
             // Triggering a re-fetch would be ideal, but for now we leave it
        }
    }
  } catch (e: any) {
    hideLoadingMask();
    alert("Error: " + e.message);
  }
}

export async function requestPasswordReset() {
  const emailInput = document.getElementById("reset-email") as HTMLInputElement;
  const email = emailInput.value.trim();
  
  if (!email) {
      alert(translations[state.currentLang].alertEmailRequired);
      return;
  }

  showLoadingMask(translations[state.currentLang].loadingSending);

  try {
    const res = await fetch('/.netlify/functions/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    hideLoadingMask();

    if (res.ok) {
      if (data.resetLink) {
        await showPromptModal("TEST MODE: Reset Link", data.resetLink, data.resetLink, null, data.emailBody);
      } else {
        alert(translations[state.currentLang].alertResetSent || "Reset link sent.");
      }
      toggleForgotPasswordForm();
    } else {
      alert(data.error || translations[state.currentLang].alertResetError);
    }
  } catch (e) {
    hideLoadingMask();
    console.error(e);
    alert(translations[state.currentLang].alertNetworkError);
  }
}

export async function updateShippingAddress(newAddress: string) {
    if (!state.currentUser) return;

    if (!state.currentUserData) {
        state.currentUserData = {};
    }
    state.currentUserData.shipping_addr = newAddress;
    localStorage.setItem('currentUserData', JSON.stringify(state.currentUserData));

    // Persist to server (best-effort)
    try {
        await fetch('/.netlify/functions/save-user-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: state.currentUser, 
                cart: state.cart, // send current cart to avoid wiping it
                shipping_addr: newAddress 
            })
        });
    } catch (e) { console.warn('Failed to save shipping address to server:', e); }
}

export async function changePassword() {
  const currentPassword = (document.getElementById("profile-current-pass") as HTMLInputElement).value;
  const newPassword = (document.getElementById("profile-new-pass") as HTMLInputElement).value;
  const confirmPassword = (document.getElementById("profile-confirm-pass") as HTMLInputElement).value;
  
  if (!currentPassword || !newPassword) return alert(translations[state.currentLang].alertFillPasswordFields);
  if (newPassword !== confirmPassword) return alert(translations[state.currentLang].alertPasswordsDoNotMatch);
  
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    alert(translations[state.currentLang].alertPasswordRequirements);
    return;
  }

  showLoadingMask(translations[state.currentLang].loadingChangingPass);
  try {
    const res = await fetch('/.netlify/functions/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.currentUser, currentPassword, newPassword })
    });
    const data = await res.json();
    hideLoadingMask();
    if (!res.ok) throw new Error(data.error || "Failed");
    alert(translations[state.currentLang].alertPasswordChanged);
    (document.getElementById("profile-current-pass") as HTMLInputElement).value = "";
    (document.getElementById("profile-new-pass") as HTMLInputElement).value = "";
    (document.getElementById("profile-confirm-pass") as HTMLInputElement).value = "";
    const btn = document.getElementById("btn-change-password");
    if (btn) {
        (btn as HTMLButtonElement).disabled = true;
        btn.classList.add("btn-disabled-opacity");
    }
  } catch (e: any) {
    hideLoadingMask();
    alert("Error: " + e.message);
  }
}
