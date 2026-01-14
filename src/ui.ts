import { state } from "./state.js";
import { translations, PLANT_CLASSES } from "./constants.js";
import { setVersionDisplay } from "./utils.js";
import {
  addToCart,
  renderPage,
  applyFilter,
  changeItemsPerPage,
  removeFromCart,
  identifyPlant,
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

  let html = `<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">`;

  html += `<div><label style="margin-right:5px;">${label}</label>`;
  html += `<select onchange="applyFilter(this.value)">`;

  state.plantClasses.forEach((type) => {
    const display = type === "All" ? allLabel : type;
    html += `<option value="${type}" ${
      state.currentFilter === type ? "selected" : ""
    }>${display}</option>`;
  });
  html += `</select></div>`;

  html += `<div><input type="text" id="product-search" placeholder="Search..." value="${state.searchQuery}" oninput="handleSearch(this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid black; background: aquamarine; font-size: 1.5rem; font-weight: bolder; width: 115px; height: 23px;"></div>`;

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

    html += `<select onchange="renderPage(parseInt(this.value))" style="margin: 0 10px; padding: 8px; border-radius: 4px; border: 1px solid var(--primary);">`;
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
        <select onchange="changeItemsPerPage(this.value)" style="margin-left: 15px; padding: 8px; border-radius: 4px; border: 1px solid var(--primary);">
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
        cartItemsDiv.innerHTML += `
                    <div class="cart-item">
                        <div>
                            <strong>${item.name}</strong><br>
                            $${itemPrice.toFixed(2)}
                        </div>
                        <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer;">${
          translations[state.currentLang].btnRemove
        }</button>
                    </div>
                `;
      });

      // Discount section
      let discountSection = document.getElementById("discount-section");
      if (!discountSection) {
        discountSection = document.createElement("div");
        discountSection.id = "discount-section";
        discountSection.style.padding = "10px 0";
        
        // Insert before the total header
        const totalHeader = cartFooter.querySelector(".cart-total-header");
        if (totalHeader) {
          cartFooter.insertBefore(discountSection, totalHeader);
        } else {
          cartFooter.insertBefore(discountSection, paypalContainer);
        }
      }

      let finalTotal = total;
      if (state.activeDiscount && state.activeDiscount.type === "percent") {
        const discountAmount = total * (state.activeDiscount.value / 100);
        finalTotal = total - discountAmount;

        discountSection.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <span style="color: green;">Code: <strong>${state.activeDiscount.code}</strong></span>
                    <button onclick="removeDiscount(event)" title="Remove discount" style="background: none; border: none; color: red; cursor: pointer; font-weight: bold; font-size: 1.2em;">&times;</button>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: #666;">
                    <span>Subtotal:</span>
                    <span>$${total.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: green; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                    <span>Discount (${state.activeDiscount.value}%):</span>
                    <span>-$${discountAmount.toFixed(2)}</span>
                </div>
            `;
        cartTotal.innerText = finalTotal.toFixed(2);
      } else {
        if (state.activeDiscount) {
          // Handle other types like 'shipping'
          discountSection.innerHTML = `
                    <div style="color: green; font-size: 0.9em; display: flex; justify-content: space-between; align-items: center;">
                        <span>Discount Applied: <strong>${state.activeDiscount.code}</strong></span>
                        <button onclick="removeDiscount(event)" title="Remove discount" style="background: none; border: none; color: red; cursor: pointer; font-weight: bold; font-size: 1.2em;">&times;</button>
                    </div>
                `;
        } else {
          discountSection.innerHTML = `
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <input type="text" id="discount-code-input" placeholder="Discount Code" oninput="this.value = this.value.toUpperCase()" onkeydown="if(event.key==='Enter') applyDiscountCode()" style="flex-grow: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        <button onclick="applyDiscountCode()" style="padding: 8px 12px; border: none; background-color: #555; color: white; border-radius: 4px; cursor: pointer;">Apply</button>
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
    dropZone.innerHTML = `<p>Click or Drop to Replace</p>`;
  } else {
    dropZone.style.backgroundImage = "";
    dropZone.innerHTML = `<p>Drag & Drop Image Here</p>`;
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
  sciInput.style.marginBottom = "10px";
  sciInput.style.padding = "8px";
  sciInput.style.border = "1px solid #ddd";
  sciInput.style.borderRadius = "4px";
  sciInput.style.flex = "1";

  // Class Select
  const classSelect = document.createElement("select");
  classSelect.id = "new-class";
  classSelect.style.padding = "8px";
  classSelect.style.border = "1px solid #ddd";
  classSelect.style.borderRadius = "4px";
  classSelect.style.flex = "1";

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
  findBtn.style.marginLeft = "10px";
  findBtn.style.padding = "8px 12px";
  findBtn.style.backgroundColor = "#17a2b8";
  findBtn.style.color = "white";
  findBtn.style.border = "none";
  findBtn.style.borderRadius = "4px";
  findBtn.style.cursor = "pointer";
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
  classContainer.style.display = "flex";
  classContainer.style.marginBottom = "10px";
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
  notesInput.style.marginBottom = "10px";
  notesInput.style.padding = "8px";
  notesInput.style.border = "1px solid #ddd";
  notesInput.style.borderRadius = "4px";
  notesInput.style.width = "100%";
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

  wrapper.style.position = "fixed";
  wrapper.style.bottom = "0";
  wrapper.style.left = "0";
  wrapper.style.width = "100%";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "flex-end";
  wrapper.style.gap = "15px";
  wrapper.style.zIndex = "1000";
  wrapper.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
  wrapper.style.padding = "10px 20px";
  wrapper.style.boxShadow = "0 -2px 10px rgba(0,0,0,0.1)";
  wrapper.style.boxSizing = "border-box";

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
  userSelectContainer.className = "hamburger-menu-item bg-purple";
  userSelectContainer.style.display = "flex";
  userSelectContainer.style.flexDirection = "column";
  userSelectContainer.style.gap = "5px";
  userSelectContainer.style.cursor = "default";
  userSelectContainer.style.background = "cyan";
  userSelectContainer.id = "admin-user-select-container";
  userSelectContainer.style.borderRadius = "50px";
  userSelectContainer.style.width = "85%";

  const select = document.createElement("select");
  select.id = "admin-user-select";
  select.style.width = "100%";
  select.style.padding = "5px";
  select.style.borderRadius = "4px";
  select.style.border = "1px solid #fff";
  select.style.fontWeight = "bold";
  select.style.fontSize = "1rem";
  
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
      const userData = (selectedOpt as any).userData;
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
  meterContainer.style.marginTop = "0px";
  meterContainer.style.marginBottom = "5px";
  meterContainer.style.fontSize = "0.8em";

  // Track (background)
  const meterTrack = document.createElement("div");
  meterTrack.style.height = "4px";
  meterTrack.style.width = "100%";
  meterTrack.style.backgroundColor = "#eee";
  meterTrack.style.borderRadius = "2px";
  meterTrack.style.marginBottom = "3px";
  meterTrack.style.overflow = "hidden";

  // Bar (foreground)
  const meterBar = document.createElement("div");
  meterBar.style.height = "100%";
  meterBar.style.width = "0%";
  meterBar.style.backgroundColor = "#dc3545";
  meterBar.style.transition = "width 0.3s, background-color 0.3s";
  
  meterTrack.appendChild(meterBar);

  const meterText = document.createElement("div");
  meterText.style.textAlign = "right";
  meterText.style.fontWeight = "bold";
  meterText.style.minHeight = "1.2em";
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
      { width: "25%", color: "#dc3545", label: t.strengthWeak },       // 0-1 (Weak)
      { width: "50%", color: "#ffc107", label: t.strengthMedium },     // 2 (Medium)
      { width: "75%", color: "#28a745", label: t.strengthStrong },     // 3 (Strong)
      { width: "100%", color: "#198754", label: t.strengthVeryStrong } // 4 (Very Strong)
    ];

    // Map score to config: 0-1 -> index 0, 2 -> index 1, 3 -> index 2, 4 -> index 3
    let idx = 0;
    if (strength >= 4) idx = 3;
    else if (strength === 3) idx = 2;
    else if (strength === 2) idx = 1;

    const config = configs[idx];
    
    meterBar.style.width = config.width;
    meterBar.style.backgroundColor = config.color;
    meterText.innerText = `${t.strengthLabel}: ${config.label}`;
    meterText.style.color = config.color;
  };

  passwordInput.addEventListener("input", updateMeter);
  passwordInput.addEventListener("keyup", updateMeter);
}
