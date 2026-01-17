import { state } from "../state.js";
import { translations } from "../constants.js";

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

export function toggleProfileModal() {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;
  const isHidden = modal.style.display !== "flex";
  modal.style.display = isHidden ? "flex" : "none";

  if (isHidden) {
    setTimeout(() => setupPasswordStrengthMeter("profile-new-pass", "profile-strength-meter"), 100);
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