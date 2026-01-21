import { state } from "../state.js";
import { translations } from "../constants.js";
import { setVersionDisplay } from "../utils.js";

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

export function toggleContactModal() {
  let modal = document.getElementById("contact-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "contact-modal";
    modal.className = "modal";
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) toggleContactModal();
    });
  }

  const isHidden = modal.style.display !== "flex";
  
  if (isHidden) {
      const t = translations[state.currentLang];
      const userEmail = state.currentUser || "";
      
      modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn" onclick="toggleContactModal()">&times;</span>
            <h2>${t.contactTitle}</h2>
            <div class="form-group">
                <label>${t.labelUser}</label>
                <input type="text" value="${userEmail}" disabled style="background: #eee;">
            </div>
            <div class="form-group">
                <label>${t.labelSubject}</label>
                <input type="text" id="contact-subject" placeholder="${t.labelSubject}">
            </div>
            <div class="form-group">
                <label>${t.labelMessage}</label>
                <textarea id="contact-message" rows="5" placeholder="${t.labelMessage}"></textarea>
            </div>
            <div class="manual-payment-actions">
                <button class="add-btn" onclick="sendContactMessage()">${t.btnSend}</button>
            </div>
        </div>
      `;
      modal.style.display = "flex";
  } else {
      modal.style.display = "none";
  }
}

export function closeImageModal() {
  const modal = document.getElementById("image-modal");
  if (modal) modal.style.display = "none";
}

export function setupHamburgerMenu() {
  const dropdown = document.getElementById("hamburger-dropdown");
  if (!dropdown) return;

  const langBtn = document.getElementById("lang-btn");
  const logoutBtn = document.getElementById("logout-btn");

  // Check if contact button already exists to avoid duplicates
  if (!document.getElementById("contact-btn")) {
      const contactBtn = document.createElement("button");
      contactBtn.id = "contact-btn";
      contactBtn.className = "hamburger-menu-item bg-orange";
      contactBtn.style.borderRadius = "20px";
      contactBtn.setAttribute("onclick", "toggleContactModal()");
      contactBtn.setAttribute("data-i18n", "contactBtn");
      contactBtn.innerText = translations[state.currentLang].contactBtn || "Contact Us";
      
      // Insert before the lang/logout row if possible, or just append
      dropdown.appendChild(contactBtn);
  }

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