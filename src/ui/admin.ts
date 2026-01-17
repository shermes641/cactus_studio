import { state } from "../state.js";
import { translations } from "../constants.js";
import { identifyPlant, openProfileModal } from "../actions.js";

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