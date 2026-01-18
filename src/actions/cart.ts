// e:\_A_CACTUS\src\actions\cart.ts

import { state } from '../state.js';
import { translations, EXCHANGE_RATE } from '../constants.js';
import { getStorageKey, showLoadingMask, hideLoadingMask } from '../utils.js';
import { updateCartUI, toggleCart, toggleOtherPaymentModal, updateReceiptDropZonePreview } from '../ui.js';
import { Discount } from '../types.js';
import { renderPage, fetchDataAndLoad } from './products.js';
import { fileToBase64, uploadFileToCloudinary, uploadFileToGoogleDrive, USE_CLOUDINARY } from './shared.js';

declare const paypal: any;
declare const window: any;

let pendingReceiptFile: File | null = null;

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

export function removeAllFromCart() {
    if (!state.cart || !state.cart.length) return;
    for (let i = state.cart.length - 1; i >= 0; i--) {
        removeFromCart(i);
    }
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

export async function updateShippingAddress(newAddress: string) {
    if (!state.currentUser) return;

    if (!state.currentUserData) {
        state.currentUserData = {};
    }
    state.currentUserData.shipping_addr = newAddress;

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

export function handleReceiptFileSelect(file: File) {
    if (!file.type.startsWith("image/")) return;
    pendingReceiptFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        updateReceiptDropZonePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
}

export async function submitManualPayment() {
    if (!pendingReceiptFile) {
        alert(translations[state.currentLang].alertReceiptRequired);
        return;
    }

    const shippingInput = document.getElementById("cart-shipping-address") as HTMLTextAreaElement;
    const shippingAddress = shippingInput ? shippingInput.value.trim() : (state.currentUserData?.shipping_addr || "");

    if (!shippingAddress) {
        alert(translations[state.currentLang].alertShippingAddressRequired);
        return;
    }

    showLoadingMask("Uploading receipt...");
    let receiptUrl = "";
    try {
      const b64 = await fileToBase64(pendingReceiptFile);
      console.dir(pendingReceiptFile);
      if (USE_CLOUDINARY) {
        receiptUrl = await uploadFileToCloudinary(b64, 'receipts');
      } else {
        receiptUrl = await uploadFileToGoogleDrive(pendingReceiptFile, 'receipts');
      }
    } catch (e: any) {
        hideLoadingMask();
        alert("Receipt upload failed: " + e.message);
        return;
    }

    showLoadingMask("Placing order...");
    try {
        // Using create-order endpoint but passing receiptUrl to indicate manual payment
        const res = await fetch('/.netlify/functions/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cart: state.cart,
                discountCode: state.activeDiscount ? state.activeDiscount.code : null,
                shippingAddress: shippingAddress,
                currency: (state as any).currency || 'USD',
                receiptUrl: receiptUrl,
                isManual: true,
                userId: state.currentUserData ? state.currentUserData.id : null
            })
        });
        
        state.cart = [];
        state.hiddenProductIds.clear();
        localStorage.setItem(getStorageKey('cactusCart', state.currentUser), JSON.stringify(state.cart));
        updateCartUI();
        toggleOtherPaymentModal();
        pendingReceiptFile = null;
        alert(translations[state.currentLang].alertManualOrderSuccess);
        await fetchDataAndLoad();
    } catch (e: any) {
        console.error("Manual order error:", e);
        alert("Failed to place order: " + e.message);
    } finally {
        hideLoadingMask();
    }
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

  const otherBtn = document.getElementById("other-payment-btn");
  if (otherBtn) otherBtn.style.display = "block";

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
    let internalOrderId: number | null = null;

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
          internalOrderId = data.internalId;
          return data.id;
        });
      },
      onApprove: function(data: any, actions: any) {
        return actions.order.capture().then(function(details: any) {
          return fetch('/.netlify/functions/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              internalId: internalOrderId,
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
            state.hiddenProductIds.clear();
            localStorage.setItem(getStorageKey('cactusCart', state.currentUser), JSON.stringify(state.cart));
            updateCartUI();
            // Since toggleCart is in UI, and we import UI, we can call it directly.
            toggleCart();
            setTimeout(function() {
              alert(translations[state.currentLang].alertTransactionSuccess.replace('{name}', details.payer.name.given_name));
              fetchDataAndLoad();
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
        if (orderCreated && internalOrderId) {
            fetch('/.netlify/functions/cancel-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ internalId: internalOrderId })
            }).then(() => handlePaymentReset());
        } else {
            fetchDataAndLoad();
        }
        
        alert(translations[state.currentLang].paymentError);
        if (checkoutBtn) checkoutBtn.style.display = "";
        paypalContainer.innerHTML = "";
      },
      onCancel: function(data: any) {
        if (orderCreated && internalOrderId) {
            fetch('/.netlify/functions/cancel-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ internalId: internalOrderId, orderId: data.orderID })
            }).then(() => handlePaymentReset());
        } else {
            fetchDataAndLoad();
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
