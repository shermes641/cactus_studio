// e:\_A_CACTUS\src\actions\auth.ts

import { state } from '../state.js';
import { translations } from '../constants.js';
import { showLoadingMask, hideLoadingMask, showPromptModal, getStorageKey } from '../utils.js';
import { updateHamburgerUserInfo, injectAdminButtons, removeAdminButtons, toggleProfileModal, injectLoginUI, setupPasswordStrengthMeter, updateCartUI } from '../ui.js';
import { fetchDataAndLoad } from './products.js';

declare const window: any;

export async function restoreSession() {
  console.log("restoreSession: Starting...");
  const token = localStorage.getItem('authToken');
  if (!token) {
      console.log("restoreSession: No auth token found.");
      return;
  }

  console.log("restoreSession: Attempting to restore session with token...");

  try {
    const res = await fetch('/.netlify/functions/get-user-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.user) {
          state.currentUser = data.user.email;
          state.currentUserData = data.user;
          state.isAdmin = !!data.user.is_admin;
          
          updateHamburgerUserInfo(state.currentUser, state.isAdmin);
          updateCartUI();
          
          // Force hide login UI if it was shown
          const authContainer = document.getElementById("auth-container");
          if (authContainer) authContainer.style.display = "none";

          const profileBtn = document.getElementById("profile-btn");
          if (profileBtn) {
            profileBtn.style.display = "block";
            profileBtn.classList.remove("hidden");
          }
          
          if (state.isAdmin) {
            injectAdminButtons();
          }
          console.log("restoreSession: Session restored for:", state.currentUser);
      }
    } else {
      console.warn("Session restore failed:", res.status, await res.text());
      // Only remove token if it's definitely invalid (4xx), keep it for server errors (5xx)
      if (res.status === 400 || res.status === 401 || res.status === 403) {
          localStorage.removeItem('authToken');
      }
    }
  } catch (e) {
    console.error("Failed to restore session (network/error):", e);
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
    
    if (data.token) {
        localStorage.setItem('authToken', data.token);
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
  const phoneInput = document.getElementById("register-phone") as HTMLInputElement;
  const passwordInput = document.getElementById("register-password") as HTMLInputElement;
  const confirmInput = document.getElementById("register-password-confirm") as HTMLInputElement;
  const addressInput = document.getElementById("register-address") as HTMLInputElement;

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const password = passwordInput.value.trim();
  const passwordConfirm = confirmInput.value.trim();
  const shipping_addr = addressInput.value.trim();

  if (!email || !password || !phone || !shipping_addr) {
    alert(translations[state.currentLang].alertRegisterRequired);
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
      body: JSON.stringify({ email, password, name: name || null, shipping_addr, phone })
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
    if (phoneInput) phoneInput.value = "";
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

export function logoutUser() {
  const wasAdmin = state.isAdmin;
  const { currentUser, currentUserData } = state;
  const token = localStorage.getItem("authToken");
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
  localStorage.removeItem("authToken");

  // Invalidate session on server (best-effort)
  if (token) {
    try {
      fetch('/.netlify/functions/logout-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        keepalive: true // Ensure request completes even if page unloads
      }).catch(e => console.warn("Server logout failed", e));
    } catch (e) { console.warn("Logout request failed", e); }
  }
  
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
  const regPhone = document.getElementById("register-phone") as HTMLInputElement;
  if (nameInput) nameInput.value = "";
  if (regEmail) regEmail.value = "";
  if (regPass) regPass.value = "";
  if (regConfirm) regConfirm.value = "";
  if (regAddr) regAddr.value = "";
  if (regPhone) regPhone.value = "";

  if (wasAdmin) {
    window.location.href = window.location.pathname;
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
      // We need to import toggleForgotPasswordForm from UI.
      import('../ui.js').then(({ toggleForgotPasswordForm }) => toggleForgotPasswordForm());
    } else {
      alert(data.error || translations[state.currentLang].alertResetError);
    }
  } catch (e) {
    hideLoadingMask();
    console.error(e);
    alert(translations[state.currentLang].alertNetworkError);
  }
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
