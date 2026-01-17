// e:\_A_CACTUS\src\actions\admin.ts

import { state } from '../state.js';
import { translations } from '../constants.js';
import { showLoadingMask, hideLoadingMask, getStorageKey } from '../utils.js';
import { toggleAdminModal, ensureAdminFieldsExist, setupDropZone } from '../ui.js';
import { Product } from '../types.js';
import { renderPage, fetchDataAndLoad } from './products.js';
import { fileToBase64, uploadFileToCloudinary } from './shared.js';

declare const window: any;

export async function uploadImagesToCloudinary(force: boolean = false) {
  if (
    !force &&
    !confirm(
      "Upload all product images to Cloudinary and update database?\nThis may take several minutes."
    )
  ) {
    return;
  }

  // 🔒 MUST match Netlify-safe limits
  const batchSize = 3;

  let lastId = 0;
  let totalUpdated = 0;
  let allFailures: any[] = [];
  let hasMore = true;
  let batches = 0;

  showLoadingMask("Starting upload...");

  try {
    while (hasMore) {
      const res = await fetch(
        "/.netlify/functions/upload-images-to-cloudinary",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            force,
            limit: batchSize,
            lastId,
            folder: "cactus" // ✅ ALWAYS SEND
          })
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        hideLoadingMask();
        alert("Image upload failed: " + (data?.error || res.statusText));
        return;
      }

      // 🛑 SAFETY: cursor must advance
      if (data.lastId === lastId && data.hasMore) {
        hideLoadingMask();
        console.error("Cursor did not advance", data);
        alert(
          "Upload stopped to prevent an infinite loop.\nCheck server logs."
        );
        return;
      }

      totalUpdated += data.updated || 0;

      if (Array.isArray(data.failures) && data.failures.length > 0) {
        allFailures.push(...data.failures);
      }

      lastId = data.lastId;
      hasMore = Boolean(data.hasMore);
      batches++;

      showLoadingMask(
        `Uploading images...\n\n` +
        `Batches: ${batches}\n` +
        `Uploaded: ${totalUpdated}\n` +
        `Last ID: ${lastId}`
      );

      // 🧠 Gentle pacing (important on Netlify)
      if (hasMore) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    hideLoadingMask();

    alert(
      `Image upload completed!\n\n` +
      `Uploaded: ${totalUpdated}\n` +
      `Failures: ${allFailures.length}`
    );

    try {
      fetchDataAndLoad();
    } catch {
      /* ignore */
    }
  } catch (e: any) {
    hideLoadingMask();
    console.error("Image upload error", e);
    alert("Image upload error: " + (e?.message || String(e)));
  }
}


export async function addProduct() {
  const name = (document.getElementById("new-name") as HTMLInputElement).value;
  const priceInput = parseFloat((document.getElementById("new-price") as HTMLInputElement).value);
  const price = Math.round(priceInput * 100);
  let image = (document.getElementById("new-image") as HTMLInputElement).value;
  const scientific = (document.getElementById("new-scientific") as HTMLInputElement)?.value || "";
  const productClass = (document.getElementById("new-class") as HTMLSelectElement)?.value || "None";
  const notes = (document.getElementById("new-notes") as HTMLTextAreaElement)?.value || "";

  if (state.pendingUploadFile) {
      showLoadingMask("Uploading image...");
      try {
        const b64 = await fileToBase64(state.pendingUploadFile);
        image = await uploadFileToCloudinary(b64, 'cactus');
        // Preserve public_id logic if needed, but for new uploads it's fresh
        if (image && image.includes('cloudinary.com')) {
             // Logic to keep public_id if replacing existing image could be added here
        }
      } catch (e: any) {
          hideLoadingMask();
          alert("Image upload failed: "  + e.message);
          return;
      }
      hideLoadingMask();
  }

  if (name && price && image) {
    if (state.editingProductId) {
      const product = state.products.find((p) => p.id === state.editingProductId);
      if (product) {
        product.name = name;
        product.price_cents = price;
        product.image_url = image;
        product.scientific = scientific;
        product.class = productClass;
        product.notes = notes;

        if (state.useDB) {
          await fetch('/.netlify/functions/update-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: product.id, name, price_cents: price, image_url: image, scientific, class: productClass, notes })
          }).catch(e => console.error("Failed to update DB", e));
        }

        alert(translations[state.currentLang].alertUpdated);
      }
    } else {
      const newProduct: Product = {
        id: state.products.length > 0 ? Math.max(...state.products.map(p => p.id)) + 1 : 1,
        name: name,
        price_cents: price,
        image_url: image,
        quantity: 1,
        scientific: scientific,
        class: productClass,
        notes: notes,
      };

      if (state.useDB) {
        try {
          const res = await fetch('/.netlify/functions/update-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, price_cents: price, image_url: image, scientific, class: productClass, notes })
          });
          
          if (!res.ok) {
            const err = await res.text();
            throw new Error(err || res.statusText);
          }

          const data = await res.json();
          if (data.id) newProduct.id = Number(data.id);
        } catch (e: any) { 
          console.error("Failed to add to DB", e);
          alert("Failed to save to database: " + e.message);
          return;
        }
      }

      state.products.push(newProduct);
      alert(translations[state.currentLang].alertAdded);
    }
    localStorage.setItem(getStorageKey('cactusProducts', state.currentUser), JSON.stringify(state.products));
    renderPage(state.currentPage); // renderProducts alias
    toggleAdminModal();
    (document.getElementById("new-name") as HTMLInputElement).value = "";
    (document.getElementById("new-price") as HTMLInputElement).value = "";
    (document.getElementById("new-image") as HTMLInputElement).value = "";
    (document.getElementById("new-scientific") as HTMLInputElement).value = "";
    (document.getElementById("new-class") as HTMLSelectElement).selectedIndex = 0;
    (document.getElementById("new-notes") as HTMLTextAreaElement).value = "";
    setupDropZone("");
    state.editingProductId = null;
    const btn = document.querySelector("#admin-modal .add-btn") as HTMLElement;
    if (btn) btn.innerText = translations[state.currentLang].btnAddInventory;
  } else {
    alert(translations[state.currentLang].alertFillFields);
  }
}

export async function syncDatabase() {
  if (!confirm("Are you sure you want to sync data.json to the database?")) return;
  
  showLoadingMask("Syncing Database...");

  const btn = document.getElementById("sync-btn") as HTMLButtonElement;
  const originalText = btn.innerText;
  btn.innerText = "Syncing...";
  btn.disabled = true;

  try {
    const response = await fetch('/data.json');
    state.allProducts = await response.json();
    state.defaultProducts = JSON.parse(JSON.stringify(state.allProducts));
    
    let res = await fetch('/.netlify/functions/seed-data', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: state.defaultProducts, resetInventory: false })
    });

    let text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { error: text || res.statusText };
    }

    if (!res.ok) throw new Error(data.error || "Unknown error");
    alert("Sync Result: " + (data.message || "Success"));

    if (confirm("Do you want to update the inventory table? (This will DELETE all events and reset quantity to 1)")) {
        res = await fetch('/.netlify/functions/seed-data', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: state.defaultProducts, resetInventory: true })
        });
        text = await res.text();
        try { data = JSON.parse(text); } catch (e) { data = { error: text }; }
        
        if (!res.ok) throw new Error(data.error || "Inventory reset failed");
        alert("Inventory Result: " + (data.message || "Success"));
    }

  } catch (err: any) {
    alert("Error syncing: " + err.message);
  } finally {
    hideLoadingMask();
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

export async function resetDatabaseSchema() {
  if (!confirm("DANGER: This will DROP ALL TABLES and reset the database schema. All data will be lost. Are you sure?")) return;
  
  showLoadingMask("Resetting Schema...");

  const btn = document.getElementById("reset-schema-btn") as HTMLButtonElement;
  const originalText = btn ? btn.innerText : "Reset DB";
  if (btn) {
    btn.innerText = "Resetting...";
    btn.disabled = true;
  }

  try {
    const res = await fetch('/.netlify/functions/reset-schema', { method: 'POST' });
    let text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { error: text || res.statusText }; }

    if (!res.ok) throw new Error(data.error || "Unknown error");
    
    hideLoadingMask();
    alert("Schema Reset Successful: " + (data.message || "Tables recreated."));
    window.location.reload();
  } catch (err: any) {
    hideLoadingMask();
    console.error(err);
    alert("Error resetting schema: " + err.message);
    if (btn) {
      btn.innerText = originalText;
      btn.disabled = false;
    }
  }
}

export async function runMigration() {
  if (!confirm('Run non-destructive DB migration now?')) return;
  showLoadingMask('Running migration...');
  try {
    const res = await fetch('/.netlify/functions/migrate-schema', { method: 'POST' });
    const data = await res.json().catch(() => null);
    hideLoadingMask();
    if (!res.ok) {
      const err = (data && data.error) ? data.error : res.statusText;
      alert('Migration failed: ' + err);
      return;
    }
    const actions = data && data.actions ? data.actions : [];
    alert('Migration completed. Actions:\n' + actions.join('\n'));
    // Optionally refresh product data and admin UI
    try { fetchDataAndLoad(); } catch (e) { /* ignore */ }
  } catch (e: any) {
    hideLoadingMask();
    console.error('Migration error', e);
    alert('Migration error: ' + (e && e.message ? e.message : String(e)));
  }
}
