// e:\_A_CACTUS\src\actions\cart.ts

import { state } from "../state.js";
import { translations, EXCHANGE_RATE } from "../constants.js";
import { getStorageKey, showLoadingMask, hideLoadingMask } from "../utils.js";
import {
  updateCartUI,
  toggleCart,
  toggleOtherPaymentModal,
  updateReceiptDropZonePreview,
} from "../ui.js";
import { Discount } from "../types.js";
import { renderPage, fetchDataAndLoad } from "./products.js";
import {
  fileToBase64,
  uploadFileToCloudinary,
  uploadFileToGoogleDrive,
  USE_CLOUDINARY,
  isLocal,
  PAYPAL_TIMEOUT_MS,
  CHECKOUT_TIMEOUT_MS,
  OTHER_PAYMENT_TIMEOUT_MS,
  clearTimer,
  disableCartButtonsTemporary,
} from "./shared.js";

declare const paypal: any;
declare const window: any;

const PAYPAL_SDK_ID = "paypal-sdk";
const MAX_RELOADS = 0;
const RELOAD_KEY = "paypal_sdk_reload_count";

function waitForPayPalReady(timeout = 3000): Promise<void> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      // @ts-ignore
      if (window.paypal?.Buttons) {
        resolve();
        return;
      }

      if (Date.now() - start > timeout) {
        reject(new Error("PayPal SDK did not initialize"));
        return;
      }

      setTimeout(check, 50);
    };

    check();
  });
}

let orderCreated = false;
export let internalOrderId: number | null = null;
let isManualPaymentSubmitting = false;

let pendingReceiptFile: File | null = null;
let checkoutTimer: NodeJS.Timeout | null = null;

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
          const idx = state.products.findIndex((p) => p.id == id);
          if (idx !== -1) state.products[idx] = freshProduct;
        }
      }
    } catch (e) {
      console.error("Error verifying stock:", e);
    }
  }

  if (
    state.useDB &&
    product.quantity !== undefined &&
    product.quantity !== null &&
    Number(product.quantity) <= 0
  ) {
    alert(translations[state.currentLang].outOfStock);
    product.quantity = 0;
    renderPage(state.currentPage, true);
    return;
  }

  state.cart.push(product);
  localStorage.setItem(
    getStorageKey("cactusCart", state.currentUser),
    JSON.stringify(state.cart),
  );
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
  localStorage.setItem(
    getStorageKey("cactusCart", state.currentUser),
    JSON.stringify(state.cart),
  );
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
  state.cart = state.cart.filter((item) => {
    const freshProduct = state.products.find((p) => p.id === item.id);
    if (freshProduct && freshProduct.quantity === 0) return false;
    return true;
  });

  if (state.cart.length !== initialCount) {
    localStorage.setItem(
      getStorageKey("cactusCart", state.currentUser),
      JSON.stringify(state.cart),
    );
    updateCartUI();
    alert(translations[state.currentLang].alertCartItemsRemoved);
  }
}

export function updateCurrency(currency: string) {
  (state as any).currency = currency;
  updateCartUI();
}

export async function applyDiscountCode() {
  const input = document.getElementById(
    "discount-code-input",
  ) as HTMLInputElement;
  if (!input) return;
  const code = input.value.trim().toUpperCase();
  if (!code) return;

  try {
    const emailParam = state.currentUser
      ? `&email=${encodeURIComponent(state.currentUser)}`
      : "";
    const res = await fetch(
      `/.netlify/functions/validate-discount?code=${code}${emailParam}`,
    );
    const data = await res.json();

    if (!res.ok) {
      let msg = data.error;
      const t = translations[state.currentLang];
      if (msg === "You have no active discounts")
        msg = t.alertNoActiveDiscounts;
      else if (msg === "Discount code not found in your account")
        msg = t.alertDiscountNotAssigned;
      else if (msg === "Discount code is not active")
        msg = t.alertDiscountNotActive;
      else if (msg === "Discount code not found") msg = t.alertDiscountInvalid;

      alert(msg || t.alertDiscountInvalid);
      input.value = "";
      state.activeDiscount = null;
    } else {
      state.activeDiscount = data.discount as Discount;
      alert(
        translations[state.currentLang].alertDiscountApplied ||
          "Discount applied!",
      );
    }
    updateCartUI();
  } catch (e) {
    console.error("Discount validation error:", e);
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
    await fetch("/.netlify/functions/save-user-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: state.currentUser,
        cart: state.cart, // send current cart to avoid wiping it
        shipping_addr: newAddress,
      }),
    });
  } catch (e) {
    console.warn("Failed to save shipping address to server:", e);
  }
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

export async function submitManualPayment(
  allow_no_reciept: boolean,
  preOrder: boolean = false,
) {
  disableCartButtonsTemporary();
  internalOrderId = null;
  isManualPaymentSubmitting = true;
  checkoutTimer = clearTimer(checkoutTimer);

  if (!pendingReceiptFile && !allow_no_reciept) {
    isManualPaymentSubmitting = false;
    alert(translations[state.currentLang].alertReceiptRequired);
    return;
  }

  const shippingInput = document.getElementById(
    "cart-shipping-address",
  ) as HTMLTextAreaElement;
  const shippingAddress = shippingInput
    ? shippingInput.value.trim()
    : state.currentUserData?.shipping_addr || "";

  if (!shippingAddress) {
    isManualPaymentSubmitting = false;
    alert(translations[state.currentLang].alertShippingAddressRequired);
    return;
  }

  let msg = allow_no_reciept ? "..." : "Uploading receipt...";
  showLoadingMask(msg);
  let receiptUrl = "";
  try {
    const fileToUse = allow_no_reciept
      ? new File([await (await fetch("/logo.png")).blob()], "logo.png", {
          type: "image/png",
        })
      : pendingReceiptFile!;
    const b64 = await fileToBase64(fileToUse);
    console.dir(fileToUse);
    if (USE_CLOUDINARY) {
      receiptUrl = await uploadFileToCloudinary(b64, "receipts");
    } else {
      receiptUrl = await uploadFileToGoogleDrive(fileToUse, "receipts");
    }
  } catch (e: any) {
    isManualPaymentSubmitting = false;
    hideLoadingMask();
    alert("Receipt upload failed: " + e.message);
    return;
  }

  msg = allow_no_reciept ? "Reserving order..." : "Placing order...";
  showLoadingMask(msg);
  try {
    // Using create-order endpoint but passing receiptUrl to indicate manual payment
    const res = await fetch("/.netlify/functions/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cart: state.cart,
        discountCode: state.activeDiscount ? state.activeDiscount.code : null,
        shippingAddress: shippingAddress,
        currency: (state as any).currency || "USD",
        isManual: true,
        preOrder: preOrder,
        userId: state.currentUserData ? state.currentUserData.id : null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Order creation failed");
    }
    if (data.id) internalOrderId = data.id;

    if (!allow_no_reciept) {
      state.cart = [];
      state.hiddenProductIds.clear();
      localStorage.setItem(
        getStorageKey("cactusCart", state.currentUser),
        JSON.stringify(state.cart),
      );
      updateCartUI();

      // Clear the ID so closing the modal doesn't trigger a restore/cancel
      internalOrderId = null;

      toggleOtherPaymentModal();
      pendingReceiptFile = null;
      alert(translations[state.currentLang].alertManualOrderSuccess);
      await fetchDataAndLoad();
    }
  } catch (e: any) {
    console.error("Manual order error:", e);
    alert("Failed to place order: " + e.message);
  } finally {
    isManualPaymentSubmitting = false;
    hideLoadingMask();
  }
}

export function monitorManualPayment(isOpen: boolean) {
  checkoutTimer = clearTimer(checkoutTimer);
  if (isOpen && !isManualPaymentSubmitting) {
    checkoutTimer = setTimeout(() => {
      const modal = document.getElementById("other-payment-modal");
      if (modal && modal.style.display === "flex") {
        toggleOtherPaymentModal();
        cancelCheckout("monitorManualPayment");
      }
    }, OTHER_PAYMENT_TIMEOUT_MS);
  }
}

export function cancelCheckout(msg: string) {
  checkoutTimer = clearTimer(checkoutTimer);

  const checkoutBtn = document.querySelector(
    ".checkout-btn",
  ) as HTMLButtonElement;
  const paypalContainer = document.getElementById("paypal-button-container");
  const otherBtn = document.getElementById("other-payment-btn");
  const cancelBtn = document.getElementById("cancel-checkout-btn");

  if (checkoutBtn) {
    checkoutBtn.style.display = "";
    checkoutBtn.innerText = translations[state.currentLang].btnCheckout;
    checkoutBtn.disabled = false;
  }
  if (paypalContainer) paypalContainer.innerHTML = "";
  if (otherBtn) otherBtn.style.display = "none";
  if (cancelBtn) cancelBtn.style.display = "none";
  if (orderCreated && internalOrderId) {
    restorePreOrder(internalOrderId);
    orderCreated = false;
    internalOrderId = null;
  } else {
    fetchDataAndLoad();
  }
  alert(translations[state.currentLang].paymentCancel || "Checkout cancelled") +
    " (msg)";
}

/**
 * Initiates the checkout process for the current cart.
 *
 * This function performs several critical steps:
 * 1. Validates and updates the user's shipping address.
 * 2. Performs a pre-checkout stock check against the database to ensure availability.
 *    - If items are out of stock, they are removed, and the user is alerted.
 * 3. Loads the PayPal SDK dynamically if not already loaded.
 * 4. Renders PayPal buttons with handlers for creating orders, approving transactions, and handling errors/cancellations.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function checkout() {
  disableCartButtonsTemporary(2000);
  const checkoutBtn = document.querySelector(
    ".checkout-btn",
  ) as HTMLButtonElement;

  // Retrieve shipping address from input or state
  const shippingInput = document.getElementById(
    "cart-shipping-address",
  ) as HTMLTextAreaElement;
  const inputAddr = shippingInput ? shippingInput.value.trim() : "";
  const storedAddr = (state.currentUserData?.shipping_addr || "").trim();

  let finalShippingAddr = "";

  // Determine final address and update server if changed
  if (inputAddr) {
    finalShippingAddr = inputAddr;
    if (!storedAddr && state.currentUser) {
      await updateShippingAddress(inputAddr);
    }
  } else {
    finalShippingAddr = storedAddr;
  }

  // Validate address requirement for logged-in users
  if (state.currentUser && !finalShippingAddr) {
    alert(translations[state.currentLang].alertShippingAddressRequired);
    return;
  }

  // Perform initial stock check if using database
  if (state.useDB && state.cart.length > 0) {
    if (checkoutBtn) {
      checkoutBtn.innerText = translations[state.currentLang].checkingStock;
      checkoutBtn.disabled = true;
    }

    let outOfStockList: string[] = [];
    let outOfStockIds = new Set<number>();
    let hasChanges = false;

    // Verify quantity for each item in cart
    await Promise.all(
      state.cart.map(async (item) => {
        try {
          const res = await fetch(
            `/.netlify/functions/get-products?id=${item.id}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (data.products && data.products.length > 0) {
              const fresh = data.products[0];
              const p = state.products.find((p) => p.id === item.id);
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
      }),
    );

    // If items are out of stock, remove them and halt checkout
    if (hasChanges) {
      state.cart = state.cart.filter((item) => !outOfStockIds.has(item.id));
      localStorage.setItem(
        getStorageKey("cactusCart", state.currentUser),
        JSON.stringify(state.cart),
      );
      updateCartUI();
      renderPage(state.currentPage, true);
      if (checkoutBtn) {
        checkoutBtn.innerText = translations[state.currentLang].btnCheckout;
        checkoutBtn.disabled = false;
      }
      alert(
        `${translations[state.currentLang].outOfStockRemoved}\n\n- ${outOfStockList.join("\n- ")}\n\nPlease review your cart and try again.`,
      );
      return;
    }

    // Re-enable button if stock check passed (though we hide it shortly after)
    if (checkoutBtn) {
      checkoutBtn.innerText = translations[state.currentLang].btnCheckout;
      checkoutBtn.disabled = false;
    }
  }

  // Hide checkout button to show payment options
  if (checkoutBtn) checkoutBtn.style.display = "none";

  const paypalContainer = document.getElementById("paypal-button-container");
  if (!paypalContainer) return;

  // Show manual payment option
  const otherBtn = document.getElementById("other-payment-btn");
  if (otherBtn) otherBtn.style.display = "block";

  // Show cancel button
  const cancelBtn = document.getElementById("cancel-checkout-btn");
  if (cancelBtn) cancelBtn.style.display = "block";

  showLoadingMask("Loading Payment Options...");

  // Fetch PayPal Client ID from server
  let CLIENT_ID, PAYPAL_MODE, PAYPAL_URL;
  try {
    const res = await fetch("/.netlify/functions/get-paypal-client-id");
    if (res.ok) {
      const data = await res.json();
      CLIENT_ID = data.clientId;
      PAYPAL_MODE = data.paypalMode;
      PAYPAL_URL =
        PAYPAL_MODE === "live"
          ? "https://www.paypal.com/sdk/js"
          : "https://www.sandbox.paypal.com/sdk/js";
      //debug console.log("!!!!!!!!!!!!!!!!!!!", CLIENT_ID, PAYPAL_MODE, PAYPAL_URL, "!!!!!!!!!!!!!!!!!!!");
      //debug alert("Fetched PayPal Client ID from server.");
    }
  } catch (e) {
    console.error("Error fetching PayPal Client ID:", e);
  }

  // Fallback to env variable if fetch failed (usually for local dev)
  if (!CLIENT_ID && (window as any).env)
    CLIENT_ID = (window as any).env.PAYPAL_SANDBOX_CLIENT_ID;

  const locale = state.currentLang === "es" ? "es_ES" : "en_US";
  const scriptId = PAYPAL_SDK_ID;
  let script = document.getElementById(scriptId) as HTMLScriptElement;

  const currency =
    (state as any).currency || (state.currentLang === "en" ? "USD" : "CRC");
  // PayPal does not support CRC, so we use USD for the transaction
  const paymentCurrency = currency === "CRC" ? "USD" : currency;

  // Function to render PayPal buttons
  const render = () => {
    paypalContainer.innerHTML = "";
    // Loading mask is hidden when buttons render or on error
    if (typeof paypal === "undefined" || !paypal || !paypal.Buttons) {
      console.error("PayPal SDK not ready.");
      alert("Payment system loading error. Please try again.");
      if (checkoutBtn) checkoutBtn.style.display = "";
      return;
    }
    orderCreated = false;
    internalOrderId = null;

    checkoutTimer = clearTimer(checkoutTimer);
    // debug console.log("Rendering PayPal buttons... TTTTT", checkoutTimer);
    const msg = isLocal() ? `PayPal ${PAYPAL_MODE} ${PAYPAL_URL}` : "PayPal";
    showLoadingMask(msg);
    paypal
      .Buttons({
        onClick: function (data: any, actions: any) {
          console.log("PayPal button clicked");
          disableCartButtonsTemporary();
          checkoutTimer = clearTimer(checkoutTimer);

          // Start a 5-minute safety timer in case the user abandons the popup
          checkoutTimer = setTimeout(() => {
            cancelCheckout("PayPal timeout");
          }, PAYPAL_TIMEOUT_MS);
        },
        // Create Order: Called when user clicks PayPal button
        createOrder: async function (data: any, actions: any) {
          orderCreated = false;
          let outOfStockList: string[] = [];
          let outOfStockIds = new Set<number>();

          // Final stock check before creating order
          try {
            await Promise.all(
              state.cart.map(async (item) => {
                const res = await fetch(
                  `/.netlify/functions/get-products?id=${item.id}`,
                );
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
              }),
            );
          } catch (e) {
            console.error("Stock check error", e);
          }

          // Handle OOS items found during creation
          if (outOfStockList.length > 0) {
            state.cart = state.cart.filter(
              (item) => !outOfStockIds.has(item.id),
            );
            localStorage.setItem(
              getStorageKey("cactusCart", state.currentUser),
              JSON.stringify(state.cart),
            );
            updateCartUI();
            renderPage(state.currentPage, true);
            alert(
              `${translations[state.currentLang].outOfStockRemoved}\n\n- ${outOfStockList.join("\n- ")}\n\nPlease review your cart and try again.`,
            );
            throw new Error("PRE_CHECKOUT_OOS");
          }

          // Call server to create order (reserves stock)
          return fetch("/.netlify/functions/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cart: state.cart,
              discountCode: state.activeDiscount
                ? state.activeDiscount.code
                : null,
              shippingAddress: finalShippingAddr,
              preOrder: true,
              currency: paymentCurrency,
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const text = await res.text();
                try {
                  const json = JSON.parse(text);
                  return Promise.reject(
                    new Error(json.error || "PayPal Order Error"),
                  );
                } catch (e) {
                  return Promise.reject(new Error(text || res.statusText));
                }
              }
              return res.json();
            })
            .then((data) => {
              orderCreated = true;
              internalOrderId = data.internalId;
              return data.id; // Return PayPal Order ID
            });
        },
        // On Approve: Called when user authorizes payment
        onApprove: function (data: any, actions: any) {
          checkoutTimer = clearTimer(checkoutTimer);
          return actions.order.capture().then(function (details: any) {
            // Record capture on server
            return fetch("/.netlify/functions/capture-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                internalId: internalOrderId,
                orderId: data.orderID,
                details: details,
                cart: state.cart,
                discountCode: state.activeDiscount
                  ? state.activeDiscount.code
                  : null,
                shippingAddress: finalShippingAddr,
                currency: paymentCurrency,
                userId: state.currentUserData ? state.currentUserData.id : null,
              }),
            })
              .then(async (res) => {
                if (!res.ok) {
                  throw new Error("Capture failed");
                }
                // Clear cart and update UI on success
                state.cart = [];
                state.hiddenProductIds.clear();
                localStorage.setItem(
                  getStorageKey("cactusCart", state.currentUser),
                  JSON.stringify(state.cart),
                );
                updateCartUI();
                // Since toggleCart is in UI, and we import UI, we can call it directly.
                toggleCart();
                setTimeout(function () {
                  alert(
                    translations[
                      state.currentLang
                    ].alertTransactionSuccess.replace(
                      "{name}",
                      details.payer.name.given_name,
                    ),
                  );
                  fetchDataAndLoad();
                }, 500);
              })
              .catch((err) => {
                console.error("Error recording order:", err);
                alert(translations[state.currentLang].alertPaymentSavedError);
              });
          });
        },
        // On Error: Called when PayPal encounters an error
        onError: function (err: any) {
          checkoutTimer = clearTimer(checkoutTimer);
          // Handle custom OOS error
          if (String(err).includes("PRE_CHECKOUT_OOS")) {
            if (checkoutBtn) {
              checkoutBtn.style.display = "";
              checkoutBtn.innerText =
                translations[state.currentLang].btnCheckout;
              checkoutBtn.disabled = false;
            }
            paypalContainer.innerHTML = "";
            if (otherBtn) otherBtn.style.display = "none";
            if (cancelBtn) cancelBtn.style.display = "none";
            return;
          }

          console.error("PayPal Error:", err);
          // Cancel internal order if it was created
          checkoutTimer = clearTimer(checkoutTimer);
          if (orderCreated && internalOrderId) {
            restorePreOrder(internalOrderId);
            // if (orderCreated && internalOrderId) {
            //     fetch('/.netlify/functions/cancel-order', {
            //       method: 'POST',
            //       headers: { 'Content-Type': 'application/json' },
            //       body: JSON.stringify({ internalId: internalOrderId })
            //     }).then(() => handlePaymentReset());
          } else {
            fetchDataAndLoad();
          }

          alert(translations[state.currentLang].paymentError);
          if (checkoutBtn) checkoutBtn.style.display = "";
          paypalContainer.innerHTML = "";
          if (otherBtn) otherBtn.style.display = "none";
          if (cancelBtn) cancelBtn.style.display = "none";
        },
        // On Cancel: Called when user cancels the popup
        onCancel: function (data: any) {
          if (checkoutTimer) clearTimeout(checkoutTimer);
          if (orderCreated && internalOrderId) {
            restorePreOrder(internalOrderId);
            // if (orderCreated && internalOrderId) {
            //     fetch('/.netlify/functions/cancel-order', {
            //       method: 'POST',
            //       headers: { 'Content-Type': 'application/json' },
            //       body: JSON.stringify({ internalId: internalOrderId })
            //     }).then(() => handlePaymentReset());
          } else {
            fetchDataAndLoad();
          }

          alert(
            translations[state.currentLang].paymentCancel +
              " (PayPal popup closed)",
          );
          if (checkoutBtn) checkoutBtn.style.display = "";
          paypalContainer.innerHTML = "";
          if (otherBtn) otherBtn.style.display = "none";
          if (cancelBtn) cancelBtn.style.display = "none";
        },
      })
      .render("#paypal-button-container")
      .then(() => {
        hideLoadingMask();

        if (checkoutTimer) clearTimeout(checkoutTimer);

        checkoutTimer = setTimeout(() => {
          const manualModal = document.getElementById("other-payment-modal");
          if (manualModal && manualModal.style.display === "flex") return;

          if (checkoutBtn) {
            checkoutBtn.style.display = "";
            checkoutBtn.innerText = translations[state.currentLang].btnCheckout;
            checkoutBtn.disabled = false;
          }
          if (paypalContainer) paypalContainer.innerHTML = "";
          if (otherBtn) otherBtn.style.display = "none";
          if (cancelBtn) cancelBtn.style.display = "none";

          alert(
            (translations[state.currentLang].paymentCancel ||
              "Checkout timed out") + " (checkoutTimer)",
          );
        }, CHECKOUT_TIMEOUT_MS);
      });
  };

  // Load script if not present, otherwise render
  //if (!script) {
  if (!CLIENT_ID) {
    alert("Payment configuration missing (Client ID).");
    if (checkoutBtn) checkoutBtn.style.display = "";
    paypalContainer.innerHTML = "";
    return;
  }

  // const reloadCount = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  // const existing = document.getElementById(PAYPAL_SDK_ID);

  // // Only force reload a few times
  // if (existing && reloadCount < MAX_RELOADS) {
  //   existing.remove();
  //   // @ts-ignore
  //   delete (window as any).paypal;
  //   sessionStorage.setItem(RELOAD_KEY, String(reloadCount + 1));
  // }

  // If script existsjust reuse it
  if (document.getElementById(PAYPAL_SDK_ID)) {
    render();
  } else {
    const scriptx = document.createElement("script");
    scriptx.id = PAYPAL_SDK_ID;

    scriptx.src = `${PAYPAL_URL}?client-id=${CLIENT_ID}&currency=USD&locale=${locale}`;
    scriptx.async = true;

    scriptx.onload = async () => {
      console.log("PayPal SDK loaded");
      try {
        await waitForPayPalReady();
        render();
      } catch (e) {
        console.error(e);
      }
    };
    scriptx.onerror = () => {
      paypalContainer.innerHTML = "Error loading payment system.";
      if (checkoutBtn) checkoutBtn.style.display = "";
      hideLoadingMask();
    };
    document.head.appendChild(scriptx);
  }

  //================================================
  // script = document.createElement('script');
  // script.id = scriptId;
  // script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&currency=USD&locale=${locale}`;
  // script.onload = render;
  // script.onerror = () => {
  //     paypalContainer.innerHTML = "Error loading payment system.";
  //     if (checkoutBtn) checkoutBtn.style.display = "";
  //     hideLoadingMask();
  // };
  // document.body.appendChild(script);
  // } else {
  //   render();
  // }
}

export async function restorePreOrder(order_id: number) {
  if (!state.currentUser) return;

  try {
    //debug console.log("restorePreOrder... TTTTT", order_id);
    const res = await fetch("/.netlify/functions/restore-preorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order_id,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        // 5. Place items back in cart using existing functions
        for (const item of data.items) {
          await addToCart(item.id);
        }

        // Alert if localhost and > 1 order
        if (isLocal() && data.orderCount > 1) {
          alert(`Localhost: Found ${data.orderCount} pre-orders.`);
        }
      }
    }
  } catch (e) {
    console.error("Failed to restore pre-orders", e);
  }
}
