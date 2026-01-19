import { state } from "../state.js";
import { translations, EXCHANGE_RATE } from "../constants.js";
import { handleReceiptFileSelect, submitManualPayment } from "../actions.js";

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
      let total = 0;
      state.cart.forEach((item, index) => {
        if (!item) return;
        const itemPriceUSD = Number(item.price_cents) / 100;
        const itemPriceCRC = itemPriceUSD * EXCHANGE_RATE;
        total += itemPriceUSD;

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
        shippingSection.insertAdjacentElement('afterend', discountSection);
      }

      let finalTotal = total;
      if (state.activeDiscount && state.activeDiscount.type === "percent") {
        const discountAmountUSD = total * (state.activeDiscount.value / 100);
        const discountAmountCRC = discountAmountUSD * EXCHANGE_RATE;
        finalTotal = total - discountAmountUSD;
        const finalTotalCRC = finalTotal * EXCHANGE_RATE;

        discountSection.innerHTML = `
                <div class="discount-row">
                    <span class="discount-code">Code: <strong>${state.activeDiscount.code}</strong></span>
                    <button onclick="removeDiscount(event)" class="remove-discount-btn" title="Remove discount">&times;</button>
                </div>
                <div class="subtotal-row">
                    <span>${translations[state.currentLang].subtotal}:</span>
                    <span>$${total.toFixed(2)} / ₡${(total * EXCHANGE_RATE).toLocaleString()}</span>
                </div>
                <div class="discount-value-row">
                    <span>${translations[state.currentLang].discount} (${state.activeDiscount.value}%):</span>
                    <span>-$${discountAmountUSD.toFixed(2)} / ₡${discountAmountCRC.toLocaleString()}</span>
                </div>
            `;
        cartTotal.innerText = `${finalTotal.toFixed(2)} / ₡${finalTotalCRC.toLocaleString()}`;
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
        cartTotal.innerText = `${total.toFixed(2)} / ₡${(total * EXCHANGE_RATE).toLocaleString()}`;
      }

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
        if (start_payment) {
          submitManualPayment(start_payment, start_payment);
        }
        // Render summary
        const summaryDiv = document.getElementById("manual-order-summary");
        if (summaryDiv) {
            let total = 0;
            let html = "";
            state.cart.forEach(item => {
                const priceUSD = Number(item.price_cents) / 100;
                const priceCRC = priceUSD * EXCHANGE_RATE;
                total += priceUSD;
                html += `<div class="manual-order-item"><span>${item.name}</span><span>$${priceUSD.toFixed(2)} / ₡${priceCRC.toLocaleString()}</span></div>`;
            });
            
            if (state.activeDiscount) {
                 const discountAmountUSD = total * (state.activeDiscount.value / 100);
                 const discountAmountCRC = discountAmountUSD * EXCHANGE_RATE;
                 total -= discountAmountUSD;
                 html += `<div class="manual-order-item" style="color: var(--success);"><span>Discount (${state.activeDiscount.code})</span><span>-$${discountAmountUSD.toFixed(2)} / ₡${discountAmountCRC.toLocaleString()}</span></div>`;
            }
            
            html += `<div class="manual-order-item" style="font-weight: bold; border-top: 1px solid #ccc; margin-top: 5px; padding-top: 5px;"><span>Total</span><span>$${total.toFixed(2)} / ₡${(total * EXCHANGE_RATE).toLocaleString()}</span></div>`;
            summaryDiv.innerHTML = html;
        }

        const shippingDiv = document.getElementById("manual-order-shipping");
        if (shippingDiv) {
            const shippingInput = document.getElementById("cart-shipping-address") as HTMLTextAreaElement;
            const address = shippingInput ? shippingInput.value.trim() : (state.currentUserData?.shipping_addr || "");
            shippingDiv.innerText = address || "No address provided";
        }
        updateReceiptDropZonePreview("");
    } else {
        const otherBtn = document.getElementById("other-payment-btn");
        if (otherBtn) otherBtn.style.display = "none";
        const checkoutBtn = document.querySelector(".checkout-btn") as HTMLElement;
        if (checkoutBtn) checkoutBtn.style.display = "";
        const paypalContainer = document.getElementById("paypal-button-container");
        if (paypalContainer) paypalContainer.innerHTML = "";

          const email = state.currentUser;
          const userId = state.currentUserData?.id;

          // Restore any pending pre-orders
          if (email || userId) {
            const res = await fetch('/.netlify/functions/restore-preorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, email })
            });

            if (!res.ok) {
                console.error("Failed to restore pre-orders");
            } else {
                console.log("Pre-orders restored");
            }
          } else {
            console.warn("No user info available for restoring pre-orders");
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
    document.addEventListener('paste', (e: ClipboardEvent) => {
        const modal = document.getElementById("other-payment-modal");
        if (modal && modal.style.display === "flex" && e.clipboardData && e.clipboardData.files.length > 0) {
            const file = e.clipboardData.files[0];
            handleReceiptFileSelect(file);
            e.preventDefault();
        }
    });
}