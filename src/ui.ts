import { state } from './state.js';
import { translations, PLANT_CLASSES } from './constants.js';
import { setVersionDisplay } from './utils.js';
import { addToCart, renderPage, applyFilter, changeItemsPerPage, removeFromCart, identifyPlant } from './actions.js';

export function applyTranslations() {
    const t = translations[state.currentLang];
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) langBtn.innerText = state.currentLang === 'en' ? 'ES' : 'EN';
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && t[key]) (el as HTMLElement).innerText = t[key];
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && t[key]) (el as HTMLInputElement).placeholder = t[key];
    });
}

export function renderFilterControls() {
  const container = document.getElementById("filter-container");
  if (!container) return;

  const label = translations[state.currentLang].filterLabel;
  const allLabel = translations[state.currentLang].allOption;

  let html = `<label>${label}</label>`;
  html += `<select onchange="applyFilter(this.value)">`;
  
  state.plantClasses.forEach(type => {
      const display = type === 'All' ? allLabel : type;
      html += `<option value="${type}" ${state.currentFilter === type ? 'selected' : ''}>${display}</option>`;
  });
  html += `</select>`;
  container.innerHTML = html;
}

export function updatePaginationControls(totalCount: number) {
  const container = document.getElementById('pagination-controls');
  if (!container) return;
  
  const totalPages = Math.ceil(totalCount / state.itemsPerPage) || 1;
  
  let html = `<button class="page-btn" onclick="renderPage(${state.currentPage - 1})" ${state.currentPage === 1 ? 'disabled' : ''}>${translations[state.currentLang].prev}</button>`;
  
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" onclick="renderPage(${i})">${i}</button>`;
  }
  
  html += `<button class="page-btn" onclick="renderPage(${state.currentPage + 1})" ${state.currentPage === totalPages ? 'disabled' : ''}>${translations[state.currentLang].next}</button>`;
  
  html += `
    <select onchange="changeItemsPerPage(this.value)" style="margin-left: 15px; padding: 8px; border-radius: 4px; border: 1px solid var(--primary);">
      <option value="5" ${state.itemsPerPage === 5 ? 'selected' : ''}>${translations[state.currentLang].opt5Page}</option>
      <option value="10" ${state.itemsPerPage === 10 ? 'selected' : ''}>${translations[state.currentLang].opt10Page}</option>
      <option value="20" ${state.itemsPerPage === 20 ? 'selected' : ''}>${translations[state.currentLang].opt20Page}</option>
    </select>
  `;
  
  container.innerHTML = html;
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
        cartItemsDiv.innerHTML = `<p data-i18n="cartEmpty">${translations[state.currentLang].cartEmpty}</p>`;
        cartFooter.style.display = "none";
        if (removeAllBtn) removeAllBtn.style.display = "none";
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
                        <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer;">${translations[state.currentLang].btnRemove}</button>
                    </div>
                `;
        });
        cartTotal.innerText = total.toFixed(2);
        cartFooter.style.display = "block";
    }
  }
}

export function toggleHelp() {
  const dialog = document.getElementById('help-dialog');
  if (!dialog) return;
  if (dialog.style.display === 'none') {
    dialog.style.display = 'block';
    setVersionDisplay();
    const helpFile = state.currentLang === 'es' ? '/user_es.html' : '/user.html';
    fetch(helpFile)
      .then(res => res.text())
      .then(text => {
          const content = document.getElementById('help-content');
          if (content) content.innerHTML = text;
      })
      .catch(err => {
          const content = document.getElementById('help-content');
          if (content) content.innerText = "Help file not found.";
      });
  } else {
    dialog.style.display = 'none';
  }
}

export function injectLoginUI() {
  console.log('injectLoginUI() called');
  const authContainer = document.getElementById("auth-container");
  if (authContainer) {
    authContainer.style.display = "flex";
    // ensure visible in case of CSS interference
    (authContainer as HTMLElement).style.visibility = 'visible';
    console.log('auth-container display set to', (authContainer as HTMLElement).style.display);
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
    if (!file.type.startsWith('image/')) return;
    state.pendingUploadFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        updateDropZonePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
}

export function updateDropZonePreview(src: string) {
    const dropZone = document.getElementById('image-drop-zone');
    if (!dropZone) return;
    
    if (src) {
        dropZone.style.backgroundImage = `url('${src}')`;
        dropZone.innerHTML = `<p>Click or Drop to Replace</p>`;
    } else {
        dropZone.style.backgroundImage = '';
        dropZone.innerHTML = `<p>Drag & Drop Image Here</p>`;
    }
}

export function setupDropZone(imageUrl: string) {
    const urlInput = document.getElementById('new-image') as HTMLInputElement;
    if (!urlInput || !urlInput.parentElement) return;

    let dropZone = document.getElementById('image-drop-zone');
    if (!dropZone) {
        dropZone = document.createElement('div');
        dropZone.id = 'image-drop-zone';
        urlInput.parentElement.insertBefore(dropZone, urlInput);
        
        dropZone.addEventListener('click', () => {
             const fileInput = document.createElement('input');
             fileInput.type = 'file';
             fileInput.accept = 'image/*';
             fileInput.onchange = (e: any) => {
                 if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
             };
             fileInput.click();
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone!.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone!.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone!.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
    }
    
    urlInput.style.display = 'none';
    urlInput.type = 'hidden';
    updateDropZonePreview(imageUrl);
}

export function ensureAdminFieldsExist() {
  const priceInput = document.getElementById('new-price');
  if (!priceInput || !priceInput.parentElement) return;

  // Check if we need to rebuild (if fields exist but are outdated)
  const existingSelect = document.getElementById('new-class') as HTMLSelectElement;
  if (existingSelect) {
      const hasNone = existingSelect.options.length > 0 && existingSelect.options[0].value === 'None';
      const hasBtn = existingSelect.nextElementSibling?.tagName === 'BUTTON' || existingSelect.parentElement?.querySelector('button');
      
      if (hasNone && hasBtn) return; // Already up to date

      // Remove old fields to force rebuild
      document.getElementById('new-scientific')?.remove();
      document.getElementById('new-notes')?.remove();
      if (existingSelect.parentElement && existingSelect.parentElement.tagName === 'DIV' && existingSelect.parentElement !== priceInput.parentElement) {
          existingSelect.parentElement.remove();
      } else {
          existingSelect.remove();
      }
  }
  
  // Scientific Name
  const sciInput = document.createElement('input');
  sciInput.type = 'text';
  sciInput.id = 'new-scientific';
  sciInput.placeholder = 'Scientific Name';
  sciInput.style.marginBottom = '10px';
  sciInput.style.padding = '8px';
  sciInput.style.border = '1px solid #ddd';
  sciInput.style.borderRadius = '4px';
  sciInput.style.flex = '1';

  // Class Select
  const classSelect = document.createElement('select');
  classSelect.id = 'new-class';
  classSelect.style.padding = '8px';
  classSelect.style.border = '1px solid #ddd';
  classSelect.style.borderRadius = '4px';
  classSelect.style.flex = '1';

  // Add None option
  const noneOpt = document.createElement('option');
  noneOpt.value = "None";
  noneOpt.innerText = "None";
  classSelect.appendChild(noneOpt);

  state.plantClasses.forEach((c) => {
      if (c === 'All') return; // Skip All
      const opt = document.createElement('option');
      opt.value = c;
      opt.innerText = c;
      classSelect.appendChild(opt);
  });
  classSelect.value = "None";

  // Find Class Button
  const findBtn = document.createElement('button');
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
          const img = (document.getElementById('new-image') as HTMLInputElement).value;
          if(img) identifyPlant(img);
          else alert("Enter an image URL or drop an image first");
      }
  };

  const classContainer = document.createElement('div');
  classContainer.style.display = 'flex';
  classContainer.style.marginBottom = '10px';
  classContainer.appendChild(classSelect);
  classContainer.appendChild(findBtn);

  // Visibility logic
  const updateBtn = () => {
      findBtn.style.display = classSelect.value === 'None' ? 'block' : 'none';
  };
  classSelect.onchange = updateBtn;
  updateBtn();

  // Notes
  const notesInput = document.createElement('textarea');
  notesInput.id = 'new-notes';
  notesInput.placeholder = 'Notes / Description';
  notesInput.style.marginBottom = '10px';
  notesInput.style.padding = '8px';
  notesInput.style.border = '1px solid #ddd';
  notesInput.style.borderRadius = '4px';
  notesInput.style.width = '100%';
  notesInput.rows = 3;

  // Insert after price
  priceInput.insertAdjacentElement('afterend', notesInput);
  priceInput.insertAdjacentElement('afterend', classContainer);
  priceInput.insertAdjacentElement('afterend', sciInput);
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
    if (cls) { cls.value = "None"; cls.dispatchEvent(new Event('change')); }
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

export function closeImageModal() {
  const modal = document.getElementById("image-modal");
  if (modal) modal.style.display = "none";
}

export function toggleCart() {
  const sidebar = document.getElementById("cart-sidebar");
  if (!sidebar) return;
  sidebar.classList.toggle("open");

  if (sidebar.classList.contains("open")) {
    const helpDialog = document.getElementById('help-dialog');
    if (helpDialog) helpDialog.style.display = 'none';
  } else {
    const paypalContainer = document.getElementById("paypal-button-container");
    if (paypalContainer) paypalContainer.innerHTML = "";
    const checkoutBtn = document.querySelector(".checkout-btn") as HTMLElement;
    if (checkoutBtn) checkoutBtn.style.display = "";
  }
}

export function groupSidebarElements() {
  const containerId = 'sidebar-container';
  if (document.getElementById(containerId)) return;

  const filter = document.getElementById('filter-container');
  const logo = document.querySelector('.sidebar-logo-container');
  const version = document.getElementById('main-version');

  if (!filter && !logo && !version) return;

  const wrapper = document.createElement('div');
  wrapper.id = containerId;
  
  wrapper.style.position = 'fixed';
  wrapper.style.bottom = '0';
  wrapper.style.left = '0';
  wrapper.style.width = '100%';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'flex-end';
  wrapper.style.gap = '15px';
  wrapper.style.zIndex = '1000';
  wrapper.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  wrapper.style.padding = '10px 20px';
  wrapper.style.boxShadow = '0 -2px 10px rgba(0,0,0,0.1)';
  wrapper.style.boxSizing = 'border-box';

  document.body.appendChild(wrapper);

  if (logo) {
    wrapper.appendChild(logo);
    (logo as HTMLElement).style.position = 'static';
    const img = logo.querySelector('img');
    if (img) {
      img.style.height = '40px';
      img.style.width = 'auto';
      img.style.position = 'static';
    }
  }
  if (version) {
    wrapper.appendChild(version);
    (version as HTMLElement).style.position = 'static';
  }
  if (filter) {
    wrapper.appendChild(filter);
    (filter as HTMLElement).style.position = 'static';
  }
}

export function showPromptModal(message: string, defaultValue: string = "", copyText: string | null = null, copyImage: string | null = null): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:20000;display:flex;justify-content:center;align-items:center;";
    
    const dialog = document.createElement('div');
    dialog.style.cssText = "background:white;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);min-width:300px;max-width:90%;display:flex;flex-direction:column;gap:10px;";
    
    const label = document.createElement('label');
    label.innerText = message;
    label.style.fontWeight = "bold";
    label.style.marginBottom = "5px";
    dialog.appendChild(label);

    if (copyText || copyImage) {
        const copyContainer = document.createElement('div');
        copyContainer.style.cssText = "display:flex; gap:5px; align-items:center; margin-bottom:5px; background:#f0f0f0; padding:8px; border-radius:4px;";
        
        if (copyText) {
            const copyContent = document.createElement('div');
            copyContent.innerText = copyText;
            copyContent.style.cssText = "flex:1; font-size:0.85em; color:#333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";
            copyContent.title = copyText;
            copyContainer.appendChild(copyContent);

            const copyBtn = document.createElement('button');
            copyBtn.innerText = "Copy Prompt";
            copyBtn.style.cssText = "padding:4px 8px; border:1px solid #ccc; background:white; border-radius:4px; cursor:pointer; font-size:0.8em; white-space:nowrap;";
            copyBtn.onclick = () => {
                if (copyBtn.innerText !== "Copy Prompt") return;
                navigator.clipboard.writeText(copyText);
                copyBtn.innerText = "Copied!";
                setTimeout(() => copyBtn.innerText = "Copy Prompt", 1500);
            };
            copyContainer.appendChild(copyBtn);
        }

        if (copyImage) {
             const copyImgBtn = document.createElement('button');
             copyImgBtn.innerText = "Copy Image";
             copyImgBtn.style.cssText = "padding:4px 8px; border:1px solid #ccc; background:white; border-radius:4px; cursor:pointer; font-size:0.8em; white-space:nowrap;";
             
             copyImgBtn.onclick = async () => {
                 if (copyImgBtn.innerText !== "Copy Image") return;
                 copyImgBtn.innerText = "...";
                 try {
                    let blob: Blob;
                    if (copyImage.startsWith('data:')) {
                        blob = await (await fetch(copyImage)).blob();
                    } else {
                        const resp = await fetch(copyImage);
                        blob = await resp.blob();
                    }
                    
                    if (blob.type !== 'image/png') {
                        const img = new Image();
                        img.src = URL.createObjectURL(blob);
                        await new Promise<void>(r => (img.onload = () => r()));
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d')!;
                        ctx.drawImage(img, 0, 0);
                        blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
                    }

                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    copyImgBtn.innerText = "Copied!";
                 } catch (e) {
                     console.error(e);
                     copyImgBtn.innerText = "Error";
                 }
                 setTimeout(() => copyImgBtn.innerText = "Copy Image", 1500);
             };
             copyContainer.appendChild(copyImgBtn);
        }

        dialog.appendChild(copyContainer);
    }
    
    const input = document.createElement('input');
    input.type = "text";
    input.value = defaultValue;
    input.style.padding = "8px";
    input.style.border = "1px solid #ccc";
    input.style.borderRadius = "4px";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    dialog.appendChild(input);
    
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = "display:flex;justify-content:flex-end;gap:10px;margin-top:10px;";
    
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = "Cancel";
    cancelBtn.style.cssText = "padding:8px 12px;border:1px solid #ccc;background:white;border-radius:4px;cursor:pointer;";
    
    const okBtn = document.createElement('button');
    okBtn.innerText = "OK";
    okBtn.style.cssText = "padding:8px 12px;border:none;background:#17a2b8;color:white;border-radius:4px;cursor:pointer;";
    
    const cleanup = () => {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
    };

    cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
    };
    
    okBtn.onclick = () => {
        cleanup();
        resolve(input.value);
    };
    
    input.onkeydown = (e) => {
        if (e.key === 'Enter') okBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
    };

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(okBtn);
    dialog.appendChild(btnContainer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    input.focus();
  });
}
