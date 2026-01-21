import { state } from "../state.js";
import { translations, getExchangeRate, getShippingCost } from "../constants.js";
import { identifyPlant, openProfileModal, shipOrder, cancelOrder, fetchOrderItems, restorePreOrder } from "../actions.js";
import { genSku } from "../actions/shared.js";

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

export function injectOrdersButton() {
  const dropdown = document.getElementById("hamburger-dropdown");
  if (!dropdown || document.getElementById("orders-btn")) return;

  const footer = dropdown.querySelector(".hamburger-footer");
  const t = translations[state.currentLang];

  const btn = document.createElement("button");
  btn.id = "orders-btn";
  btn.className = "hamburger-menu-item bg-blue";
  btn.setAttribute("onclick", "toggleOrdersModal()");
  btn.setAttribute("data-i18n", "btnOrders");
  btn.innerText = t["btnOrders"] || "Orders";
  btn.style.borderRadius = "20px";

  if (footer) dropdown.insertBefore(btn, footer);
  else dropdown.appendChild(btn);
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
  const ids = ["admin-btn", "sync-btn", "run-migrate-btn", "upload-images-btn", "orders-btn", "admin-user-select-container"];
  ids.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.remove();
  });
}

/**
 * Refreshes the orders list modal with the given filter
 * @param {string} [filter='active'] - The filter to apply to the orders list
 * @returns {Promise<void>} - A promise that resolves when the orders list has been refreshed
 * @example
 * refreshOrdersModal('all')
 */
export async function refreshOrdersModal() {
    const list = document.getElementById("orders-list");
    if (!list) return;

    const filterSelect = document.getElementById("orders-filter") as HTMLSelectElement;
    const filter = state.isAdmin ? (filterSelect ? filterSelect.value : 'active') : 'all';
    const t = translations[state.currentLang];

    const titleEl = document.getElementById("orders-modal-title");
    if (titleEl) {
        const titles: {[key: string]: string} = {
            'active': t.statusActive,
            'all': t.statusAll,
            'shipped': t.statusShipped,
            'cancelled': t.statusCancelled,
            'refunded': t.statusRefunded,
            'pending': t.statusPending,
            'manual_verification': t.statusManual
        };
        titleEl.innerText = state.isAdmin ? (titles[filter] || t.ordersTitle) : t.statusAll;
    }
    
    list.innerHTML = "<p>Loading...</p>";
    
    try {
        const { fetchPendingOrders } = await import("../actions.js");
        const userId = state.isAdmin ? undefined : state.currentUserData?.id;
        const orders = await fetchPendingOrders(filter, userId);
        renderOrdersList(orders);
    } catch (e) {
        if (list) list.innerText = "Error loading orders.";
    }
}

export async function toggleOrdersModal() {
  let modal = document.getElementById("orders-modal");
  if (!modal) {
    // Create modal structure
    modal = document.createElement("div");
    modal.id = "orders-modal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px; width: 95%; max-height: 70vh; display: flex; flex-direction: column;">
        <span class="close-btn" onclick="toggleOrdersModal()">&times;</span>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px; flex-shrink: 0;">
            <h2 id="orders-modal-title" style="margin: 0;">${translations[state.currentLang].statusActive}</h2>
            <select id="orders-filter" onchange="refreshOrdersModal()" style="padding: 5px; font-size: 1rem; border-radius: 4px; border: 1px solid #ccc;">
                <option value="active" selected>${translations[state.currentLang].statusActive}</option>
                <option value="all">${translations[state.currentLang].statusAll}</option>
                <option value="manual_verification">${translations[state.currentLang].statusManual}</option>
                <option value="shipped">${translations[state.currentLang].statusShipped}</option>
                <option value="cancelled">${translations[state.currentLang].statusCancelled}</option>
                <option value="refunded">${translations[state.currentLang].statusRefunded}</option>
                <option value="pending">${translations[state.currentLang].statusPending}</option>
            </select>
        </div>
        <div id="orders-list" style="overflow-y: auto; margin-bottom: 20px; flex-grow: 1;"></div>
        <div class="manual-payment-actions" style="flex-shrink: 0;">
           <button class="add-btn cancel-btn" style="width: auto;" onclick="toggleOrdersModal()" data-i18n="btnCancel">${translations[state.currentLang].btnCancel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Close on outside click
    modal.addEventListener("click", (e) => {
        if (e.target === modal) toggleOrdersModal();
    });
  }

  const isHidden = modal.style.display !== "flex";
  
  if (isHidden) {
      modal.style.display = "flex";
      const filterSelect = document.getElementById("orders-filter") as HTMLSelectElement;
      if (filterSelect) {
          if (state.isAdmin) {
              filterSelect.style.display = 'block';
              filterSelect.value = 'active';
          } else {
              filterSelect.style.display = 'none';
          }
      }
      refreshOrdersModal();
  } else {
      modal.style.display = "none";
  }
}

function renderOrdersList(orders: any[]) {
    const list = document.getElementById("orders-list");
    if (!list) return;
    
    const t = translations[state.currentLang];
    
    if (!orders || orders.length === 0) {
        if (!state.isAdmin) {
             list.innerHTML = `<p>${t.noOrders}</p>`;
             return;
        }

        const filterSelect = document.getElementById("orders-filter") as HTMLSelectElement;
        const filter = state.isAdmin ? (filterSelect ? filterSelect.value : 'active') : 'all';
        
        const titles: {[key: string]: string} = {
            'active': t.statusActive,
            'all': t.statusAll,
            'shipped': t.statusShipped,
            'cancelled': t.statusCancelled,
            'refunded': t.statusRefunded,
            'pending': t.statusPending,
            'manual_verification': t.statusManual
        };
        const currentTitle = titles[filter] || t.ordersTitle;
        list.innerHTML = `<p>${t.noOrdersFound.replace('{0}', currentTitle)}</p>`;
        return;
    }
    
    let html = `<table class="orders-table"><thead><tr>
        <th>${t.headerOrder}</th>
        <th>${t.labelUser}</th>
        <th>${t.labelPayPal}</th>
        <th>${t.labelShipping}</th>
        <th>${t.headerTotal}</th>
        <th>${t.headerStatus}</th>
        <th>Action</th>
    </tr></thead><tbody>`;
        
    orders.forEach(o => {
        const total = (o.total_amount_cents / 100).toFixed(2);
        const date = new Date(o.created_at).toLocaleDateString();
        
        let buttonsHtml = `<div style="display: flex; flex-direction: column; gap: 5px;">`;
        
        if (o.receipt_url) {
             const action = state.isAdmin ? `openReceiptModal(${o.id}, '${o.receipt_url}')` : `openReceiptImageModal('${o.receipt_url}')`;
             buttonsHtml += `<button class="add-btn" style="padding: 4px 8px; font-size: 0.8rem;" onclick="event.stopPropagation(); ${action}">${t.viewReceipt}</button>`;
        }

        if (state.isAdmin) {
            if (o.status === 'manual_verification') {
                buttonsHtml += `<button class="add-btn" style="padding: 4px 8px; font-size: 0.8rem;" onclick="event.stopPropagation(); openReceiptModal(${o.id}, '${o.receipt_url || ''}', true)">${t.btnVerify}</button>`;
            } else if (o.status === 'processing' && o.receipt_url) {
                buttonsHtml += `<button class="add-btn cancel-btn" style="padding: 4px 8px; font-size: 0.8rem;" onclick="event.stopPropagation(); unverifyOrder(${o.id})">${t.btnUnverify}</button>`;
            }

            if (o.status !== 'cancelled' && o.status !== 'shipped') {
                 if (o.status !== 'manual_verification') {
                     buttonsHtml += `<button class="add-btn" style="background-color: var(--info); color: #333; padding: 4px 8px; font-size: 0.8rem;" onclick="event.stopPropagation(); shipOrder(${o.id})">${t.btnShip}</button>`;
                 }
                 buttonsHtml += `<button class="add-btn cancel-btn" style="padding: 4px 8px; font-size: 0.8rem;" onclick="event.stopPropagation(); cancelOrder(${o.id})">${t.btnCancelOrder}</button>`;
            }
            
            buttonsHtml += `<button class="add-btn" style="background-color: var(--warning); color: #333; padding: 4px 8px; font-size: 0.8rem;" onclick="event.stopPropagation(); restorePreOrder(${o.id}).then(refreshOrdersModal)">Restore PreOrder</button>`;
        }

        buttonsHtml += `</div>`;
        
        html += `<tr onclick="openOrderDetailsModal(${o.id})" style="cursor: pointer;" onmouseover="this.style.backgroundColor='rgba(0,0,0,0.05)'" onmouseout="this.style.backgroundColor='transparent'">
            <td>#${o.id}<br><small>${date}</small></td>
            <td>${o.user_name || '-'}<br><small>${o.user_email || '-'}</small></td>
            <td>${o.customer_name || '-'}<br><small>${o.customer_email || '-'}</small><br><small>ID: ${o.paypal_order_id || '-'}</small></td>
            <td><div style="max-width: 200px; font-size: 0.9em;">${o.shipping_addr || '-'}</div></td>
            <td>${total} ${o.currency}</td>
            <td>${o.status}</td>
            <td>${buttonsHtml}</td>
        </tr>`;
    });
    
    html += `</tbody></table>`;
    list.innerHTML = html;
}

export function openReceiptModal(orderId: number, url: string, showVerify: boolean = false) {
    let modal = document.getElementById("receipt-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "receipt-modal";
        modal.className = "modal";
        document.body.appendChild(modal);
    }
    
    const t = translations[state.currentLang];
    
    let buttons = `<button class="add-btn cancel-btn" onclick="closeReceiptModal()">${t.btnCancel}</button>`;
    if (showVerify) {
        buttons = `
            <button class="add-btn" onclick="verifyOrder(${orderId})">${t.btnVerify}</button>
            ${buttons}
        `;
    }

    const imgHtml = url ? `<img src="${url}" style="max-width: 100%; max-height: 60vh; margin: 10px 0; border: 1px solid #ddd;">` : `<p>No receipt image available.</p>`;

    modal.innerHTML = `
        <div class="modal-content" style="text-align: center;">
            <span class="close-btn" onclick="closeReceiptModal()">&times;</span>
            <h3>${t.receiptModalTitle} #${orderId}</h3>
            ${imgHtml}
            <div class="manual-payment-actions" style="justify-content: center; gap: 10px;">
                ${buttons}
            </div>
        </div>
    `;
    modal.style.display = "flex";
}

export function closeReceiptModal() {
    const modal = document.getElementById("receipt-modal");
    if (modal) modal.style.display = "none";
}

export function openReceiptImageModal(url: string) {
    const modal = document.getElementById("image-modal");
    const img = document.getElementById("modal-img") as HTMLImageElement;
    const btn = document.getElementById("modal-add-btn") as HTMLButtonElement;

    if (!modal || !img) return;

    let src = url;
    if (src.includes('cloudinary.com')) {
        src = src
        .replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/')
        .replace('http://', 'https://');
    }

    img.src = src;
    if (btn) btn.style.display = "none";
    modal.style.display = "flex";
}

export async function openOrderDetailsModal(orderId: number) {
    const t = translations[state.currentLang];

    let modal = document.getElementById("order-details-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "order-details-modal";
        modal.className = "modal";
        document.body.appendChild(modal);

        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeOrderDetailsModal();
        });
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; width: 95%;">
            <span class="close-btn" onclick="closeOrderDetailsModal()">&times;</span>
            <h3>${t.headerOrder} #${orderId} ${t.labelItems}</h3>
            <div id="order-details-header"></div>
            <div id="order-items-content" style="max-height: 60vh; overflow-y: auto;">
                <p>${t.loadingItems}</p>
            </div>
            <div class="manual-payment-actions" style="justify-content: flex-end; margin-top: 15px;">
                <button class="add-btn" onclick="closeOrderDetailsModal()">${t.btnClose}</button>
            </div>
        </div>
    `;
    modal.style.display = "flex";
    
    try {
        const data = await fetchOrderItems(orderId);
        let items = [];
        let order = null;

        if (Array.isArray(data)) {
            items = data;
        } else {
            items = data.items;
            order = data.order;
        }

        const header = document.getElementById("order-details-header");
        if (header && order) {
             const total = (order.total_amount_cents / 100).toFixed(2);
             const date = new Date(order.created_at).toLocaleString();

             let discountHtml = '';
             if (order.discount_code) {
                 let itemsSubtotalCents = 0;
                 items.forEach((item: any) => {
                     itemsSubtotalCents += (item.price_cents * (item.quantity || 1));
                 });
                 
                 const discountCents = itemsSubtotalCents + getShippingCost() - order.total_amount_cents;
                 if (discountCents > 0) {
                    const discountVal = (discountCents / 100).toFixed(2);
                    discountHtml = `<div style="margin-bottom: 5px; color: black;"><strong>${t.discount} (${order.discount_code}):</strong> -$${discountVal}</div>`;
                 } else {
                    discountHtml = `<div style="margin-bottom: 5px; color: var(--success);"><strong>${t.discountCode}:</strong> ${order.discount_code}</div>`;
                 }
             }

             header.innerHTML = `
                <div style="background: #f5f5f5; padding: 10px; border-radius: 4px; margin-bottom: 10px; font-size: 0.9em;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span><strong>${t.headerStatus}:</strong> ${order.status}</span>
                        <span><strong>${t.labelTotal}:</strong> ${total} ${order.currency}</span>
                    </div>
                    ${order.shipped_at ? `<div style="margin-bottom: 5px;"><strong>${t.labelShippedAt}:</strong> ${new Date(order.shipped_at).toLocaleString()}</div>` : ''}
                    <div style="margin-bottom: 5px;"><strong>${t.labelDate}:</strong> ${date}</div>
                    <div style="margin-bottom: 5px;"><strong>${t.headerCustomer}:</strong> ${order.customer_name || order.user_name || 'N/A'} (${order.customer_email || order.user_email || 'N/A'})</div>
                    <div style="margin-bottom: 5px;"><strong>${t.labelShipping}:</strong> ${order.shipping_addr || 'N/A'}</div>
                    ${discountHtml}
                    ${order.paypal_order_id ? `<div><strong>${t.labelPayPalId}:</strong> ${order.paypal_order_id}</div>` : ''}
                    ${order.receipt_url ? `<div style="margin-top: 5px;"><button class="add-btn" style="padding: 4px 8px; font-size: 0.8rem;" onclick="openReceiptImageModal('${order.receipt_url}')">${t.viewReceipt}</button></div>` : ''}
                </div>
             `;
        }

        const container = document.getElementById("order-items-content");
        if (!container) return;
        
        if (!items || items.length === 0) {
            container.innerHTML = `<p>${t.noItemsInOrder}</p>`;
            return;
        }
        
        let html = "";
        items.forEach((item: any) => {
             const priceUSD = Number(item.price_cents) / 100;
             const priceCRC = priceUSD * getExchangeRate();
            
             const sku = genSku(item.class, item.name, item.product_id);

             let imgHtml = "";
             if (item.image_url) {
                 const thumbnailUrl = item.image_url.includes('cloudinary.com')
                  ? item.image_url.replace('/upload/', '/upload/w_50,h_50,c_fill,q_auto,f_auto/')
                  : item.image_url;
                 imgHtml =  `<img src="${thumbnailUrl}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; cursor: pointer;" onclick="openImageModal(${item.product_id}, true)">`;
             }
             
             html += `
                <div style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; padding: 10px 0;">
                    ${imgHtml}
                    <div style="flex-grow: 1;">
                        <div style="font-weight: bold;">${item.name}</div>
                        <div style="font-size: 0.85em; color: #666;">${item.scientific || ''}</div>
                        <div style="font-size: 0.8em; color: #888;">ID: ${item.product_id} | SKU: ${sku}</div>
                        <div style="color: #666; font-size: 0.9em;">$${priceUSD.toFixed(2)} / ₡${priceCRC.toLocaleString()}</div>
                    </div>
                    <div style="font-weight: bold;">x${item.quantity}</div>
                </div>
             `;
        });
        
        container.innerHTML = html;
        
    } catch (e) {
        const container = document.getElementById("order-items-content");
        if (container) container.innerHTML = `<p style="color: red;">${t.errorLoadingItems}</p>`;
    }
}

export function closeOrderDetailsModal() {
    const modal = document.getElementById("order-details-modal");
    if (modal) modal.style.display = "none";
}