import { state } from "./state.js";
import { translations } from "./constants.js";
import { setVersionDisplay } from "./utils.js";
import {
  renderPage,
  applyFilter,
  changeItemsPerPage,
  removeFromCart,
  identifyPlant,
  updateShippingAddress,
  handleSearch,
  openProfileModal,
} from "./actions.js";

export function applyTranslations() {
  const t = translations[state.currentLang];
  const langBtn = document.getElementById("lang-btn");
  if (langBtn) langBtn.innerText = state.currentLang === "en" ? "ES" : "EN";
  const authLangBtn = document.getElementById("auth-lang-btn");
  if (authLangBtn)
    authLangBtn.innerText = state.currentLang === "en" ? "ES" : "EN";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key && t[key]) (el as HTMLElement).innerText = t[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key && t[key]) (el as HTMLInputElement).placeholder = t[key];
  });
}

export function renderFilterControls() {
  const container = document.getElementById("filter-container");
  if (!container) return;

  const label = translations[state.currentLang].filterLabel;
  const allLabel = translations[state.currentLang].allOption;

  let html = `<div class="filter-controls">`;

  html += `<div><label class="filter-label">${label}</label>`;
  html += `<select onchange="applyFilter(this.value)">`;

  state.plantClasses.forEach((type) => {
    const display = type === "All" ? allLabel : type;
    html += `<option value="${type}" ${
      state.currentFilter === type ? "selected" : ""
    }>${display}</option>`;
  });
  html += `</select></div>`;

  html += `<div><input type="text" id="product-search" class="search-input" placeholder="${translations[state.currentLang].searchPlaceholder}" value="${state.searchQuery}" oninput="handleSearch(this.value)"></div>`;

  html += `</div>`;
  container.innerHTML = html;
}

export function updatePaginationControls(totalCount: number) {
  const totalPages = Math.ceil(totalCount / state.itemsPerPage) || 1;

  // Update Header Controls (IDs: prev-btn, next-btn, page-select)
  const prevBtn = document.getElementById("prev-btn") as HTMLButtonElement;
  const nextBtn = document.getElementById("next-btn") as HTMLButtonElement;
  const pageSelect = document.getElementById(
    "page-select"
  ) as HTMLSelectElement;
  const itemsPerPageSelect = document.getElementById(
    "items-per-page-select"
  ) as HTMLSelectElement;

  if (prevBtn) {
    prevBtn.disabled = state.currentPage <= 1;
    prevBtn.onclick = () => renderPage(state.currentPage - 1);
  }

  if (nextBtn) {
    nextBtn.disabled = state.currentPage >= totalPages;
    nextBtn.onclick = () => renderPage(state.currentPage + 1);
  }

  if (pageSelect) {
    if (pageSelect.options.length !== totalPages) {
      pageSelect.innerHTML = "";
      for (let i = 1; i <= totalPages; i++) {
        const opt = document.createElement("option");
        opt.value = i.toString();
        opt.innerText = i.toString();
        pageSelect.appendChild(opt);
      }
    }
    pageSelect.value = state.currentPage.toString();
  }

  if (itemsPerPageSelect) {
    itemsPerPageSelect.value = state.itemsPerPage.toString();
  }

  // Update Footer Container (id="pagination-controls")
  const container = document.getElementById("pagination-controls");
  if (container) {
    let html = `<button class="page-btn" onclick="renderPage(${
      state.currentPage - 1
    })" ${state.currentPage <= 1 ? "disabled" : ""}>${
      translations[state.currentLang].prev
    }</button>`;

    html += `<select onchange="renderPage(parseInt(this.value))" class="page-select">`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<option value="${i}" ${
        i === state.currentPage ? "selected" : ""
      }>${i}</option>`;
    }
    html += `</select>`;

    html += `<button class="page-btn" onclick="renderPage(${
      state.currentPage + 1
    })" ${state.currentPage >= totalPages ? "disabled" : ""}>${
      translations[state.currentLang].next
    }</button>`;

    html += `
        <select onchange="changeItemsPerPage(this.value)" class="items-per-page-select">
          <option value="5" ${state.itemsPerPage === 5 ? "selected" : ""}>${
      translations[state.currentLang].opt5Page
    }</option>
          <option value="10" ${state.itemsPerPage === 10 ? "selected" : ""}>${
      translations[state.currentLang].opt10Page
    }</option>
          <option value="20" ${state.itemsPerPage === 20 ? "selected" : ""}>${
      translations[state.currentLang].opt20Page
    }</option>
        </select>
      `;

    container.innerHTML = html;
  }
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
      cartItemsDiv.innerHTML = `<p data-i18n="cartEmpty">${
        translations[state.currentLang].cartEmpty
      }</p>`;
      cartFooter.style.display = "none";
      if (removeAllBtn) removeAllBtn.style.display = "none";
      state.activeDiscount = null; // Clear discount when cart is empty
    } else {
      if (removeAllBtn) removeAllBtn.style.display = "block";
      cartItemsDiv.innerHTML = "";
      let total = 0;
      state.cart.forEach((item, index) => {
        if (!item) return;
        const itemPrice = Number(item.price_cents) / 100;
        total += itemPrice;

        const thumbnailUrl = item.image_url.includes('cloudinary.com')
          ? item.image_url.replace('/upload/', '/upload/w_50,h_50,c_fill,q_auto,f_auto/')
          : item.image_url;

        cartItemsDiv.innerHTML += `
                    <div class="cart-item">
                        <img src="${thumbnailUrl}" alt="${item.name}" class="cart-item-thumbnail" onclick="openImageModal(${item.id}, true)">
                        <div class="cart-item-info">
                            <strong>${item.name}</strong><br>
                            $${itemPrice.toFixed(2)}
                        </div>
                        <button onclick="removeFromCart(${index})" class="cart-item-remove">${
          translations[state.currentLang].btnRemove
        }</button>
                    </div>
                `;
      });

      // Shipping Address section
      let shippingSection = document.getElementById("shipping-section");
      if (!shippingSection) {
        shippingSection = document.createElement("div");
        shippingSection.id = "shipping-section";
        shippingSection.className = "shipping-section";
        
        const totalHeader = cartFooter.querySelector(".cart-total-header");
        if (totalHeader) {
          cartFooter.insertBefore(shippingSection, totalHeader);
        } else {
          cartFooter.insertBefore(shippingSection, paypalContainer);
        }
      }

      if (state.currentUser) {
        shippingSection.style.display = 'block';
        const currentAddress = state.currentUserData?.shipping_addr || '';
        const labelText = translations[state.currentLang].labelAddress;
        const placeholderText = translations[state.currentLang].placeholderAddress;
        shippingSection.innerHTML = `
            <div class="form-group" style="margin-bottom: 0;">
                <label class="shipping-label">${labelText}</label>
                <textarea id="cart-shipping-address" onblur="updateShippingAddress(this.value)" class="shipping-address-input" placeholder="${placeholderText}">${currentAddress}</textarea>
            </div>
        `;
      } else {
        shippingSection.style.display = 'none';
        shippingSection.innerHTML = '';
      }

      // Discount section (inserted after shipping)
      let discountSection = document.getElementById("discount-section");
      if (!discountSection) {
        discountSection = document.createElement("div");
        discountSection.id = "discount-section";
        discountSection.className = "discount-section";
        shippingSection.insertAdjacentElement('afterend', discountSection);
      }

      let finalTotal = total;
      if (state.activeDiscount && state.activeDiscount.type === "percent") {
        const discountAmount = total * (state.activeDiscount.value / 100);
        finalTotal = total - discountAmount;

        discountSection.innerHTML = `
                <div class="discount-row">
                    <span class="discount-code">Code: <strong>${state.activeDiscount.code}</strong></span>
                    <button onclick="removeDiscount(event)" class="remove-discount-btn" title="Remove discount">&times;</button>
                </div>
                <div class="subtotal-row">
                    <span>${translations[state.currentLang].subtotal}:</span>
                    <span>$${total.toFixed(2)}</span>
                </div>
                <div class="discount-value-row">
                    <span>${translations[state.currentLang].discount} (${state.activeDiscount.value}%):</span>
                    <span>-$${discountAmount.toFixed(2)}</span>
                </div>
            `;
        cartTotal.innerText = finalTotal.toFixed(2);
      } else {
        if (state.activeDiscount) {
          // Handle other types like 'shipping'
          discountSection.innerHTML = `
                    <div class="discount-alert">
                        <span>${translations[state.currentLang].alertDiscountApplied} <strong>${state.activeDiscount.code}</strong></span>
                        <button onclick="removeDiscount(event)" class="remove-discount-btn" title="${translations[state.currentLang].removeDiscount}">&times;</button>
                    </div>
                `;
        } else {
          discountSection.innerHTML = `
                    <div class="discount-input-container">
                        <input type="text" id="discount-code-input" class="discount-input" placeholder="${translations[state.currentLang].discountCode}" oninput="this.value = this.value.toUpperCase()" onkeydown="if(event.key==='Enter') applyDiscountCode()">
                        <button onclick="applyDiscountCode()" class="apply-discount-btn">${translations[state.currentLang].apply}</button>
                    </div>
                `;
        }
        cartTotal.innerText = total.toFixed(2);
      }

      cartFooter.style.display = "block";
    }
  }
}

export function toggleHelp() {
  const dialog = document.getElementById("help-dialog");
  if (!dialog) return;
  if (dialog.style.display === "none") {
    dialog.style.display = "block";
    setVersionDisplay();
    const helpFile =
      state.currentLang === "es" ? "/user_es.html" : "/user.html";
    fetch(helpFile)
      .then((res) => res.text())
      .then((text) => {
        const content = document.getElementById("help-content");
        if (content) content.innerHTML = text;
      })
      .catch((err) => {
        const content = document.getElementById("help-content");
        if (content) content.innerText = "Help file not found.";
      });
  } else {
    dialog.style.display = "none";
  }
}

export function injectLoginUI() {
  console.log("injectLoginUI() called");
  const authContainer = document.getElementById("auth-container");
  if (authContainer) {
    authContainer.style.display = "flex";
    // ensure visible in case of CSS interference
    (authContainer as HTMLElement).style.visibility = "visible";
    console.log(
      "auth-container display set to",
      (authContainer as HTMLElement).style.display
    );
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

export function handleFileSelect(file: File) {
  if (!file.type.startsWith("image/")) return;
  state.pendingUploadFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    updateDropZonePreview(e.target?.result as string);
  };
  reader.readAsDataURL(file);
}

export function updateDropZonePreview(src: string) {
  const dropZone = document.getElementById("image-drop-zone");
  if (!dropZone) return;

  if (src) {
    dropZone.style.backgroundImage = `url('${src}')`;
    dropZone.innerHTML = `<p>${translations[state.currentLang].clickDropReplace}</p>`;
  } else {
    dropZone.style.backgroundImage = "";
    dropZone.innerHTML = `<p>${translations[state.currentLang].dragDropImage}</p>`;
  }
}

export function setupDropZone(imageUrl: string) {
  const urlInput = document.getElementById("new-image") as HTMLInputElement;
  if (!urlInput || !urlInput.parentElement) return;

  let dropZone = document.getElementById("image-drop-zone");
  if (!dropZone) {
    dropZone = document.createElement("div");
    dropZone.id = "image-drop-zone";
    urlInput.parentElement.insertBefore(dropZone, urlInput);

    dropZone.addEventListener("click", () => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.onchange = (e: any) => {
        if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
      };
      fileInput.click();
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone!.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropZone!.classList.remove("dragover");
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone!.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });
  }

  urlInput.style.display = "none";
  urlInput.type = "hidden";
  updateDropZonePreview(imageUrl);
}

export function ensureAdminFieldsExist() {
  const priceInput = document.getElementById("new-price");
  if (!priceInput || !priceInput.parentElement) return;

  // Check if we need to rebuild (if fields exist but are outdated)
  const existingSelect = document.getElementById(
    "new-class"
  ) as HTMLSelectElement;
  if (existingSelect) {
    const hasNone =
      existingSelect.options.length > 0 &&
      existingSelect.options[0].value === "None";
    const hasBtn =
      existingSelect.nextElementSibling?.tagName === "BUTTON" ||
      existingSelect.parentElement?.querySelector("button");

    if (hasNone && hasBtn) return; // Already up to date

    // Remove old fields to force rebuild
    document.getElementById("new-scientific")?.remove();
    document.getElementById("new-notes")?.remove();
    if (
      existingSelect.parentElement &&
      existingSelect.parentElement.tagName === "DIV" &&
      existingSelect.parentElement !== priceInput.parentElement
    ) {
      existingSelect.parentElement.remove();
    } else {
      existingSelect.remove();
    }
  }

  // Scientific Name
  const sciInput = document.createElement("input");
  sciInput.type = "text";
  sciInput.id = "new-scientific";
  sciInput.placeholder = "Scientific Name";
  sciInput.className = "admin-input";

  // Class Select
  const classSelect = document.createElement("select");
  classSelect.id = "new-class";
  classSelect.className = "admin-input";

  // Add None option
  const noneOpt = document.createElement("option");
  noneOpt.value = "None";
  noneOpt.innerText = "None";
  classSelect.appendChild(noneOpt);

  state.plantClasses.forEach((c) => {
    if (c === "All") return; // Skip All
    const opt = document.createElement("option");
    opt.value = c;
    opt.innerText = c;
    classSelect.appendChild(opt);
  });
  classSelect.value = "None";

  // Find Class Button
  const findBtn = document.createElement("button");
  findBtn.innerText = "Find Class";
  findBtn.className = "find-class-btn";
  findBtn.onclick = (e) => {
    e.preventDefault();
    if (state.pendingUploadFile) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const res = evt.target?.result as string;
        if (res) identifyPlant(res);
      };
      reader.readAsDataURL(state.pendingUploadFile);
    } else {
      const img = (document.getElementById("new-image") as HTMLInputElement)
        .value;
      if (img) identifyPlant(img);
      else alert("Enter an image URL or drop an image first");
    }
  };

  const classContainer = document.createElement("div");
  classContainer.className = "admin-class-container";
  classContainer.appendChild(classSelect);
  classContainer.appendChild(findBtn);

  // Visibility logic
  const updateBtn = () => {
    findBtn.style.display = classSelect.value === "None" ? "block" : "none";
  };
  classSelect.onchange = updateBtn;
  updateBtn();

  // Notes
  const notesInput = document.createElement("textarea");
  notesInput.id = "new-notes";
  notesInput.placeholder = "Notes / Description";
  notesInput.className = "admin-notes";
  notesInput.rows = 3;

  // Insert after price
  priceInput.insertAdjacentElement("afterend", notesInput);
  priceInput.insertAdjacentElement("afterend", classContainer);
  priceInput.insertAdjacentElement("afterend", sciInput);
}

export function toggleAdminModal() {
  const modal = document.getElementById("admin-modal");
  if (!modal) return;

  ensureAdminFieldsExist();

  const isClosed = modal.style.display !== "flex";
  modal.style.display = isClosed ? "flex" : "none";

  if (isClosed) {
    state.editingProductId = null;
    (document.getElementById("new-name") as HTMLInputElement).value = "";
    (document.getElementById("new-price") as HTMLInputElement).value = "";
    (document.getElementById("new-image") as HTMLInputElement).value = "";

    const sci = document.getElementById("new-scientific") as HTMLInputElement;
    if (sci) sci.value = "";
    const cls = document.getElementById("new-class") as HTMLSelectElement;
    if (cls) {
      cls.value = "None";
      cls.dispatchEvent(new Event("change"));
    }
    const notes = document.getElementById("new-notes") as HTMLTextAreaElement;
    if (notes) notes.value = "";

    state.pendingUploadFile = null;
    setupDropZone("");
    const btn = document.querySelector("#admin-modal .add-btn") as HTMLElement;
    if (btn) btn.innerText = translations[state.currentLang].btnAddInventory;

    const title = document.querySelector("#admin-modal h2") as HTMLElement;
    if (title) title.innerText = translations[state.currentLang].uploadTitle;
  }
}

export function toggleProfileModal() {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;
  const isHidden = modal.style.display !== "flex";
  modal.style.display = isHidden ? "flex" : "none";

  if (isHidden) {
    setTimeout(() => setupPasswordStrengthMeter("profile-new-pass", "profile-strength-meter"), 100);
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
    const helpDialog = document.getElementById("help-dialog");
    if (helpDialog) helpDialog.style.display = "none";
  } else {
    const paypalContainer = document.getElementById("paypal-button-container");
    if (paypalContainer) paypalContainer.innerHTML = "";
    const checkoutBtn = document.querySelector(".checkout-btn") as HTMLElement;
    if (checkoutBtn) checkoutBtn.style.display = "";
  }
}

export function groupSidebarElements() {
  const containerId = "sidebar-container";
  if (document.getElementById(containerId)) return;

  const filter = document.getElementById("filter-container");

  if (!filter) return;

  const wrapper = document.createElement("div");
  wrapper.id = containerId;

  wrapper.className = "sidebar-group-container";

  document.body.appendChild(wrapper);

  if (filter) {
    wrapper.appendChild(filter);
    (filter as HTMLElement).style.position = "static";
  }
}

export function toggleForgotPasswordForm() {
  const loginForm = document.getElementById("login-modal");
  const forgotForm = document.getElementById("forgot-password-modal");
  const registerForm = document.getElementById("register-modal");

  if (!loginForm || !forgotForm) return;

  const isForgotVisible = forgotForm.style.display === "block";

  if (isForgotVisible) {
    forgotForm.style.display = "none";
    loginForm.style.display = "block";
  } else {
    loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "none";
    forgotForm.style.display = "block";
  }
}

export function updateHamburgerUserInfo(
  email: string | null,
  isAdmin: boolean
) {
  const userInfo = document.getElementById("hamburger-user-info");
  const userEmail = document.getElementById("hamburger-user-email");
  const adminBadge = document.getElementById("hamburger-admin-badge");

  if (userInfo && userEmail && adminBadge) {
    if (email) {
      userInfo.style.display = "flex";
      // Use name if available, otherwise fallback to email
      userEmail.innerText = state.currentUserData?.name || email;
      adminBadge.style.display = isAdmin ? "inline-block" : "none";
    } else {
      userInfo.style.display = "none";
    }
  }
}

export async function injectAdminButtons() {
  const dropdown = document.getElementById("hamburger-dropdown");
  if (!dropdown) return;

  // Avoid duplicates
  if (document.getElementById("admin-btn")) return;

  const footer = dropdown.querySelector(".hamburger-footer");
  const t = translations[state.currentLang];

  const createBtn = (
    id: string,
    textKey: string,
    onClick: string,
    classes: string
  ) => {
    const btn = document.createElement("button");
    btn.id = id;
    btn.className = classes;
    btn.setAttribute("onclick", onClick);
    btn.setAttribute("data-i18n", textKey);
    btn.innerText = t[textKey] || textKey;
    btn.style.borderRadius = "20px";
    return btn;
  };

  const btns = [
    createBtn(
      "admin-btn",
      "addItem",
      "toggleAdminModal()",
      "hamburger-menu-item bg-green"
    ),
    createBtn(
      "sync-btn",
      "btnSync",
      "syncDatabase()",
      "add-btn hamburger-menu-item bg-blue"
    ),
    createBtn(
      "run-migrate-btn",
      "btnMigrate",
      "runMigration()",
      "add-btn hamburger-menu-item bg-purple-dark"
    ),
    createBtn(
      "upload-images-btn",
      "btnUploadImages",
      "uploadImagesToCloudinary()",
      "add-btn hamburger-menu-item bg-orange"
    ),
  ];

  btns.forEach((btn) => {
    if (footer) {
      dropdown.insertBefore(btn, footer);
    } else {
      dropdown.appendChild(btn);
    }
  });

  // Admin User Select
  const userSelectContainer = document.createElement("div");
  userSelectContainer.className = "hamburger-menu-item bg-purple admin-user-select-container";
  userSelectContainer.id = "admin-user-select-container";

  const select = document.createElement("select");
  select.id = "admin-user-select";
  select.className = "admin-user-select";
  
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.innerText = "Select User...";
  select.appendChild(defaultOpt);

  try {
      const res = await fetch('/.netlify/functions/get-users');
      if (res.ok) {
          const users = await res.json();
          users.forEach((u: any) => {
              const opt = document.createElement("option");
              opt.value = u.email;
              opt.innerText = `${u.name || u.email} ${u.discount_code ? '(Has Discount)' : ''}`;
              (opt as any).userData = u;
              select.appendChild(opt);
          });
      }
  } catch (e) { console.error("Failed to load users", e); }

  select.onchange = () => {
      const selectedOpt = select.options[select.selectedIndex];
      const { userData } = selectedOpt as any;
      if (userData) openProfileModal(userData);
      select.value = "";
  };
  userSelectContainer.appendChild(select);
  if (footer) dropdown.insertBefore(userSelectContainer, footer);
  else dropdown.appendChild(userSelectContainer);
}

export function removeAdminButtons() {
  const ids = ["admin-btn", "sync-btn", "run-migrate-btn", "upload-images-btn", "admin-user-select-container"];
  ids.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.remove();
  });
}

export function setupPasswordStrengthMeter(inputId: string = "register-password", meterId: string = "password-strength-meter") {
  const passwordInput = document.getElementById(inputId) as HTMLInputElement;
  if (!passwordInput) return;

  // Check if meter already exists to avoid duplicates
  if (document.getElementById(meterId)) return;

  const meterContainer = document.createElement("div");
  meterContainer.id = meterId;
  meterContainer.className = "password-strength-container";

  // Track (background)
  const meterTrack = document.createElement("div");
  meterTrack.className = "password-strength-track";

  // Bar (foreground)
  const meterBar = document.createElement("div");
  meterBar.className = "password-strength-bar";
  
  meterTrack.appendChild(meterBar);

  const meterText = document.createElement("div");
  meterText.className = "password-strength-text";
  meterText.innerText = "";

  meterContainer.appendChild(meterTrack);
  meterContainer.appendChild(meterText);

  // Insert before the password input (handle relative wrapper for eye icon)
  const parent = passwordInput.parentElement;
  if (parent && parent.style.position === 'relative' && parent.parentNode) {
    parent.parentNode.insertBefore(meterContainer, parent);
  } else if (passwordInput.parentNode) {
    passwordInput.parentNode.insertBefore(meterContainer, passwordInput);
  }

  const updateMeter = () => {
    const val = passwordInput.value;
    const t = translations[state.currentLang] || translations['en'];
    
    if (!val) {
      meterBar.style.width = "0%";
      meterText.innerText = "";
      return;
    }

    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^a-zA-Z0-9]/.test(val)) score++;

    const strength = val.length < 8 ? 0 : score;
    const configs = [
      { width: "25%", className: "strength-weak", label: t.strengthWeak },       // 0-1 (Weak)
      { width: "50%", className: "strength-medium", label: t.strengthMedium },     // 2 (Medium)
      { width: "75%", className: "strength-strong", label: t.strengthStrong },     // 3 (Strong)
      { width: "100%", className: "strength-very-strong", label: t.strengthVeryStrong } // 4 (Very Strong)
    ];

    // Map score to config: 0-1 -> index 0, 2 -> index 1, 3 -> index 2, 4 -> index 3
    let idx = 0;
    if (strength >= 4) idx = 3;
    else if (strength === 3) idx = 2;
    else if (strength === 2) idx = 1;

    const config = configs[idx];
    
    meterBar.className = "password-strength-bar"; // reset
    meterText.className = "password-strength-text"; // reset
    meterBar.classList.add(config.className);
    meterText.classList.add(`${config.className}-text`);
    meterBar.style.width = config.width;
    meterText.innerText = `${t.strengthLabel}: ${config.label}`;
  };

  passwordInput.addEventListener("input", updateMeter);
  passwordInput.addEventListener("keyup", updateMeter);
}

export function setupHamburgerMenu() {
  const dropdown = document.getElementById("hamburger-dropdown");
  if (!dropdown) return;

  const langBtn = document.getElementById("lang-btn");
  const logoutBtn = document.getElementById("logout-btn");

  const row = document.createElement("div");
  row.className = "hamburger-row";

  if (langBtn) {
    row.appendChild(langBtn);
    langBtn.classList.add("hamburger-menu-item", "hamburger-custom-btn", "btn-lang");
  }

  if (logoutBtn) {
    row.appendChild(logoutBtn);
    logoutBtn.classList.add("hamburger-menu-item", "hamburger-custom-btn", "btn-logout");
  }

  if (row.children.length > 0) {
    dropdown.prepend(row);
  }
}
