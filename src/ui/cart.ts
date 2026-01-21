import { state } from "../state.js";
import { translations, EXCHANGE_RATE, SHIPPING_COST } from "../constants.js";
import { handleReceiptFileSelect, submitManualPayment, monitorManualPayment, fetchDataAndLoad, internalOrderId, restorePreOrder, autoApplyUserDiscount } from "../actions.js";

const SHIPPING_COST_DOLLARS = (SHIPPING_COST || 1000) / 100;
console.log('XXXXXXXXXXXXXXXXXXXXXXXXUsing SHIPPING_COST_DOLLARS:', SHIPPING_COST_DOLLARS, SHIPPING_COST);
export function updateCartUI() {
  const cartItemsDiv = document.getElementById("cart-items");
  const cartCount = document.getElementById("cart-count");
  const cartTotal = document.getElementById("cart-total");
  const cartFooter = document.getElementById("cart-footer");
  const removeAllBtn = document.querySelector(".remove-all-btn") as HTMLElement;

  // Inject Other Payment Button if missing
  const paypalContainer = document.getElementById("paypal-button-container");
  const otherBtn = document.getElementById("other-payment-btn");
  if (otherBtn) {
      otherBtn.innerText = translations[state.currentLang].btnOtherPayment;
      otherBtn.style.display = "none";
  }

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
      let subtotal = 0;
      state.cart.forEach((item, index) => {
        if (!item) return;
        const itemPriceUSD = Number(item.price_cents) / 100;
        const itemPriceCRC = itemPriceUSD * EXCHANGE_RATE;
        subtotal += itemPriceUSD;

        const thumbnailUrl = item.image_url.includes('cloudinary.com')
          ? item.image_url.replace('/upload/', '/upload/w_50,h_50,c_fill,q_auto,f_auto/')
          : item.image_url;

        cartItemsDiv.innerHTML += `
                    <div class="cart-item">
                        <img src="${thumbnailUrl}" alt="${item.name}" class="cart-item-thumbnail" onclick="openImageModal(${item.id}, true)">
                        <div class="cart-item-info">
                            <strong>${item.name}</strong><br>
                            $${itemPriceUSD.toFixed(2)} / ₡${itemPriceCRC.toLocaleString()}
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
                <textarea id="cart-shipping-address" class="shipping-address-input" placeholder="${placeholderText}">${currentAddress}</textarea>
            </div>
        `;
      } else {
        shippingSection.style.display = 'none';
        shippingSection.innerHTML = '';
      }

      // Remove Currency section if it exists
      const currencySection = document.getElementById("currency-section");
      if (currencySection) currencySection.remove();

      // Discount section (inserted after shipping)
      let discountSection = document.getElementById("discount-section");
      if (!discountSection) {
        discountSection = document.createElement("div");
        discountSection.id = "discount-section";
        discountSection.className = "discount-section";
        discountSection.style.color = "black";
        shippingSection.insertAdjacentElement('afterend', discountSection);
      }
      
      const shippingCostCRC = SHIPPING_COST_DOLLARS * EXCHANGE_RATE;
      let totalWithShipping = subtotal + SHIPPING_COST_DOLLARS;
      let finalTotal = totalWithShipping;
      let discountHtml = "";

      // Subtotal Row
      discountHtml += `
        <div class="subtotal-row">
            <span>${translations[state.currentLang].subtotal}:</span>
            <span>$${subtotal.toFixed(2)} / ₡${(subtotal * EXCHANGE_RATE).toLocaleString()}</span>
        </div>
      `;

      // Shipping Row
      discountHtml += `
        <div class="subtotal-row" style="color: black;">
            <span>${translations[state.currentLang].labelShipping || 'Shipping'}:</span>
            <span>$${SHIPPING_COST_DOLLARS.toFixed(2)} / ₡${shippingCostCRC.toLocaleString()}</span>
        </div>
      `;

      if (state.activeDiscount && state.activeDiscount.type === "percent") {
        const discountAmountUSD = subtotal * (state.activeDiscount.value / 100);
        const discountAmountCRC = discountAmountUSD * EXCHANGE_RATE;
        finalTotal = subtotal - discountAmountUSD + SHIPPING_COST_DOLLARS;

        discountHtml += `
                <div class="discount-row" style="color: black;">
                    <span class="discount-code">${translations[state.currentLang].labelCode}: <strong>${state.activeDiscount.code}</strong></span>
                    <button onclick="removeDiscount(event)" class="remove-discount-btn" title="${translations[state.currentLang].removeDiscount}">&times;</button>
                </div>
                <div class="discount-value-row" style="color: black;">
                    <span>${translations[state.currentLang].discount} (${state.activeDiscount.value}%):</span>
                    <span>-$${discountAmountUSD.toFixed(2)} / ₡${discountAmountCRC.toLocaleString()}</span>
                </div>
            `;
      } else if (state.activeDiscount) {
        // Handle other types like 'shipping'
        discountHtml += `
                    <div class="discount-alert">
                        <span>${translations[state.currentLang].alertDiscountApplied} <strong>${state.activeDiscount.code}</strong></span>
                        <button onclick="removeDiscount(event)" class="remove-discount-btn" title="${translations[state.currentLang].removeDiscount}">&times;</button>
                    </div>
                `;
      } else if (state.currentUserData && state.currentUserData.discount_code) {
        discountHtml += `<div class="discount-row"><span class="discount-code">${translations[state.currentLang].labelCode}: <strong>${state.currentUserData.discount_code}</strong></span></div>`;
      } else {
        discountHtml += `<div class="discount-row" style="justify-content: center; font-style: italic;"><span>No discount applied</span></div>`;
      }
      
      discountSection.innerHTML = discountHtml;
      const finalTotalCRC = finalTotal * EXCHANGE_RATE;
      cartTotal.innerText = `${finalTotal.toFixed(2)} / ₡${finalTotalCRC.toLocaleString()}`;

      // Update total header symbol
      const totalHeader = cartFooter.querySelector(".cart-total-header");
      if (totalHeader) {
          totalHeader.innerHTML = `<span data-i18n="cartTotal">${translations[state.currentLang].cartTotal}</span> <span id="cart-total">$${cartTotal.innerText}</span>`;
      }

      cartFooter.style.display = "block";
    }
  }
}

export function toggleCart() {
  const sidebar = document.getElementById("cart-sidebar");
  if (!sidebar) return;
  sidebar.classList.toggle("open");

  if (sidebar.classList.contains("open")) {
    const helpDialog = document.getElementById("help-dialog");
    if (helpDialog) helpDialog.style.display = "none";
    if (state.cart.length > 0 && !state.activeDiscount) {
      autoApplyUserDiscount();
    }
  } else {
    const paypalContainer = document.getElementById("paypal-button-container");
    if (paypalContainer) paypalContainer.innerHTML = "";
    const checkoutBtn = document.querySelector(".checkout-btn") as HTMLElement;
    if (checkoutBtn) checkoutBtn.style.display = "";
  }
}

export async function toggleOtherPaymentModal(start_payment: boolean = false) {
    const modal = document.getElementById("other-payment-modal");
    if (!modal) return;
    
    const isHidden = modal.style.display !== "flex";
    modal.style.display = isHidden ? "flex" : "none";
    
    if (isHidden) {
        monitorManualPayment(true);
        if (start_payment) {
          submitManualPayment(start_payment, start_payment);
        }
        // Render summary
        const summaryDiv = document.getElementById("manual-order-summary");
        if (summaryDiv) {
            let subtotal = 0;
            let html = "";
            state.cart.forEach(item => {
                const priceUSD = Number(item.price_cents) / 100;
                const priceCRC = priceUSD * EXCHANGE_RATE;
                subtotal += priceUSD;
                html += `<div class="manual-order-item"><span>${item.name}</span><span>$${priceUSD.toFixed(2)} / ₡${priceCRC.toLocaleString()}</span></div>`;
            });
            
            const shippingCostCRC = SHIPPING_COST_DOLLARS * EXCHANGE_RATE;
            let total = subtotal;
            html += `<div class="manual-order-item" style="color: black;"><span>${translations[state.currentLang].labelShipping || 'Shipping'}</span><span>$${SHIPPING_COST_DOLLARS.toFixed(2)} / ₡${shippingCostCRC.toLocaleString()}</span></div>`;

            if (state.activeDiscount) {
                 const discountAmountUSD = subtotal * (state.activeDiscount.value / 100);
                 const discountAmountCRC = discountAmountUSD * EXCHANGE_RATE;
                 total -= discountAmountUSD;
                 html += `<div class="manual-order-item" style="color: var(--success);"><span>${translations[state.currentLang].discount} (${state.activeDiscount.code})</span><span>-$${discountAmountUSD.toFixed(2)} / ₡${discountAmountCRC.toLocaleString()}</span></div>`;
            }
            
            total += SHIPPING_COST_DOLLARS;
            html += `<div class="manual-order-item" style="font-weight: bold; border-top: 1px solid #ccc; margin-top: 5px; padding-top: 5px;"><span>${translations[state.currentLang].labelTotal}</span><span>$${total.toFixed(2)} / ₡${(total * EXCHANGE_RATE).toLocaleString()}</span></div>`;
            summaryDiv.innerHTML = html;
        }

        const shippingDiv = document.getElementById("manual-order-shipping");
        if (shippingDiv) {
            const shippingInput = document.getElementById("cart-shipping-address") as HTMLTextAreaElement;
            const address = shippingInput ? shippingInput.value.trim() : (state.currentUserData?.shipping_addr || "");
            shippingDiv.innerText = address || translations[state.currentLang].noAddressProvided;
        }
        updateReceiptDropZonePreview("");
    } else {
        monitorManualPayment(false);
        const otherBtn = document.getElementById("other-payment-btn");
        if (otherBtn) otherBtn.style.display = "none";
        const checkoutBtn = document.querySelector(".checkout-btn") as HTMLElement;
        if (checkoutBtn) checkoutBtn.style.display = "";
        const paypalContainer = document.getElementById("paypal-button-container");
        if (paypalContainer) paypalContainer.innerHTML = "";

        if (internalOrderId) {
             restorePreOrder(internalOrderId).then(() => {
                 console.log("Pre-orders restored");
                 fetchDataAndLoad();
             });
        }
    }
}

export function setupReceiptDropZone() {
    const dropZone = document.getElementById("receipt-drop-zone");
    if (!dropZone) return;

    dropZone.onclick = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (e: any) => {
            if (e.target.files.length > 0) handleReceiptFileSelect(e.target.files[0]);
        };
        input.click();
    };

    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add("dragover"); };
    dropZone.ondragleave = (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); };
    dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); if (e.dataTransfer?.files.length) handleReceiptFileSelect(e.dataTransfer.files[0]); };
}

export function updateReceiptDropZonePreview(src: string) {
    const dropZone = document.getElementById("receipt-drop-zone");
    if (dropZone) dropZone.style.backgroundImage = src ? `url('${src}')` : "";
    if (dropZone) dropZone.innerHTML = src ? "" : `<p>${translations[state.currentLang].dropReceiptHere}</p>`;
}

export function initManualPaymentUI() {
    setupReceiptDropZone();
    
    // Reset the timeout timer whenever the user interacts with the modal
    const modal = document.getElementById("other-payment-modal");
    if (modal) {
        const resetTimer = () => {
            if (modal.style.display === "flex") monitorManualPayment(true);
        };
        modal.addEventListener('click', resetTimer);
        modal.addEventListener('keyup', resetTimer);
        modal.addEventListener('change', resetTimer);
    }

    document.addEventListener('paste', (e: ClipboardEvent) => {
        const modal = document.getElementById("other-payment-modal");
        if (modal && modal.style.display === "flex" && e.clipboardData && e.clipboardData.files.length > 0) {
            const file = e.clipboardData.files[0];
            handleReceiptFileSelect(file);
            e.preventDefault();
        }
    });
}