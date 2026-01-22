// e:\_A_CACTUS\src\actions\admin.ts

import { state } from '../state.js';
import { translations } from '../constants.js';
import { showLoadingMask, hideLoadingMask, getStorageKey } from '../utils.js';
import { toggleAdminModal, ensureAdminFieldsExist, setupDropZone, toggleOrdersModal, closeReceiptModal, refreshOrdersModal } from '../ui.js';
import { Product } from '../types.js';
import { renderPage, fetchDataAndLoad } from './products.js';
import { uploadFileToCloudinary, uploadFileToGoogleDrive, USE_CLOUDINARY, isLocal, genSku } from './shared.js';
import { handlePaymentReset } from './cart.js';

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
  const batchSize = isLocal() ? 10 : 2;

  let lastId = 0;
  let totalUpdated = 0;
  let allFailures: any[] = [];
  let hasMore = true;
  let batches = 0;

  showLoadingMask(`Starting upload... batch: ${batchSize}`);

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
        console.error("Batch failures:", data.failures);
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
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    hideLoadingMask();

    let msg = `Image upload completed!\n\nUploaded: ${totalUpdated}\nFailures: ${allFailures.length}`;

    if (allFailures.length > 0) {
      console.error("All Upload Failures:", allFailures);
      const details = allFailures.map((f: any) => `• ${f.name || f.id}: ${f.error}`).join('\n');
      msg += `\n\nErrors:\n${details.substring(0, 500)}`;
      if (details.length > 500) msg += "\n... (check console for full list)";
    }

    alert(msg);

    try {
      fetchDataAndLoad();
    } catch(e) {
      console.error("fetchDataAndLoad Failed to refresh page", e);
    }
  } catch (e: any) {
    hideLoadingMask();
    console.error("Image upload error", e);
    alert("Image upload error: " + (e?.message || String(e)));
  }
}

export async function exportDatabase() {
  if (!confirm("Download database export (products.json)?")) return;
  
  showLoadingMask("Exporting Database...");

  try {
    const res = await fetch('/.netlify/functions/get-products?limit=10000');
    if (!res.ok) throw new Error("Failed to fetch products");
    
    const data = await res.json();
    const { products } = data;

    if (!products || products.length === 0) {
        alert("No products to export.");
        hideLoadingMask();
        return;
    }

    const exportData = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        price_cents: p.price_cents,
        image_url: p.image_url,
        scientific: p.scientific,
        class: p.class,
        notes: p.notes,
        sku: p.sku
    }));

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `cactus_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (e: any) {
    console.error("Export failed:", e);
    alert("Export failed: " + e.message);
  } finally {
    hideLoadingMask();
  }
}

export async function backupDatabase() {
  if (!confirm("Download full database backup (all tables)?")) return;
  
  showLoadingMask("Backing up Database...");

  try {
    const res = await fetch('/.netlify/functions/backup-database');
    if (!res.ok) throw new Error("Failed to fetch backup");
    
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `cactus_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (e: any) {
    console.error("Backup failed:", e);
    alert("Backup failed: " + e.message);
  } finally {
    hideLoadingMask();
  }
}

export async function restoreDatabase() {
  const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e: any) => {
          resolve(e.target.files && e.target.files.length > 0 ? e.target.files[0] : null);
      };
      input.click();
  });

  if (!file) return;

  if (!confirm("DANGER: This will OVERWRITE the entire database with the backup file. Current data will be lost. Are you sure?")) return;

  showLoadingMask("Restoring Database...");

  try {
      const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
      });
      
      const backupData = JSON.parse(text);
      
      const res = await fetch('/.netlify/functions/restore-database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backupData)
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Restore failed");
      
      alert("Restore Successful: " + data.message);
      window.location.reload();

  } catch (e: any) {
      console.error("Restore error:", e);
      alert("Restore failed: " + e.message);
  } finally {
      hideLoadingMask();
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
    showLoadingMask("Uploading file...");
    try {
      const filename = state.pendingUploadFile.name;
      const mimeType = state.pendingUploadFile.type;
      console.dir(state.pendingUploadFile);
      if (USE_CLOUDINARY) {
        // Calculate ID to generate SKU for filename
        const tempId = state.editingProductId || (state.products.length > 0 ? Math.max(...state.products.map(p => p.id)) + 1 : 1);
        const sku = genSku(productClass, name, tempId);
        image = await uploadFileToCloudinary(state.pendingUploadFile, 'cactus', sku);
      } else {
        image = await uploadFileToGoogleDrive(state.pendingUploadFile, 'cactus');
      }
      // image will be the webViewLink from Google Drive or Cloudinary url

    } catch (e: any) {
        hideLoadingMask();
        alert("File upload failed: "  + e.message);
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
  if (!confirm("Start Database Sync Process?")) return;

  const useFile = confirm("Do you want to upload a local JSON file?\n\nClick OK to select a file.\nClick Cancel to use the server's default data.json.");
  
  let productsToSync: any[] = [];

  if (useFile) {
      const file = await new Promise<File | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = (e: any) => {
              resolve(e.target.files && e.target.files.length > 0 ? e.target.files[0] : null);
          };
          input.click();
      });

      if (!file) return;

      try {
          const text = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.onerror = (e) => reject(e);
              reader.readAsText(file);
          });
          productsToSync = JSON.parse(text);
          if (!Array.isArray(productsToSync)) throw new Error("JSON must be an array of products");
      } catch (e: any) {
          alert("Invalid JSON file: " + e.message);
          return;
      }
  } else {
      try {
        const response = await fetch('/data.json');
        if (!response.ok) throw new Error("Failed to fetch data.json");
        productsToSync = await response.json();
      } catch (e: any) {
          alert("Error loading default data: " + e.message);
          return;
      }
  }

  showLoadingMask("Syncing Database...");

  const btn = document.getElementById("sync-btn") as HTMLButtonElement;
  const originalText = btn ? btn.innerText : "Sync DB";
  if (btn) {
    btn.innerText = "Syncing...";
    btn.disabled = true;
  }

  try {
    state.allProducts = productsToSync;
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
    if (btn) {
        btn.innerText = originalText;
        btn.disabled = false;
    }
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

export async function fetchPendingOrders(status: string = 'active', userId?: number) {
  let url = `/.netlify/functions/get-pending-orders?status=${status}`;
  if (userId) url += `&userId=${userId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return await res.json();
}

export async function verifyOrder(orderId: number) {
  showLoadingMask("Verifying order...");
  try {
      const res = await fetch('/.netlify/functions/update-order-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: [orderId], status: 'processing' })
      });
      
      if (!res.ok) throw new Error("Update failed");
      
      alert(translations[state.currentLang].alertOrderVerified);
      closeReceiptModal();
      refreshOrdersModal();
  } catch (e: any) {
      alert("Error: " + e.message);
  } finally {
      hideLoadingMask();
  }
}

export async function unverifyOrder(orderId: number) {
  showLoadingMask("Unverifying order...");
  try {
      const res = await fetch('/.netlify/functions/update-order-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: [orderId], status: 'manual_verification' })
      });
      
      if (!res.ok) throw new Error("Update failed");
      
      alert(translations[state.currentLang].alertOrderUnverified);
      closeReceiptModal();
      refreshOrdersModal();
  } catch (e: any) {
      alert("Error: " + e.message);
  } finally {
      hideLoadingMask();
  }
}

export async function shipOrder(orderId: number) {
  if (!confirm(translations[state.currentLang].confirmShip)) return;
  showLoadingMask("Updating...");
  try {
      const res = await fetch('/.netlify/functions/update-order-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: [orderId], status: 'shipped' })
      });
      if (!res.ok) throw new Error("Update failed");
      alert(translations[state.currentLang].alertOrderShipped);
      closeReceiptModal();
      refreshOrdersModal();
  } catch (e: any) {
      alert("Error: " + e.message);
  } finally {
      hideLoadingMask();
  }
}

export async function cancelOrder(orderId: number) {
  if (!confirm(translations[state.currentLang].confirmCancelOrder)) return;
  showLoadingMask("Cancelling...");
  try {
      const res = await fetch('/.netlify/functions/update-order-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: [orderId], status: 'cancelled' })
      });
      if (!res.ok) throw new Error("Update failed");
      fetch('/.netlify/functions/cancel-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalId: orderId })
      }).then(() => handlePaymentReset());
      alert(translations[state.currentLang].alertOrderCancelled);
      closeReceiptModal();
      refreshOrdersModal();
  } catch (e: any) {
      alert("Error: " + e.message);
  } finally {
      hideLoadingMask();
  }
}

export async function fetchOrderItems(orderId: number) {
  const res = await fetch(`/.netlify/functions/get-order-items?orderId=${orderId}`);
  if (!res.ok) throw new Error("Failed to fetch order items");
  return await res.json();
}
