// e:\_A_CACTUS\src\actions\products.ts

import { state } from '../state.js';
import { translations, EXCHANGE_RATE } from '../constants.js';
import { getStorageKey, showLoadingMask, hideLoadingMask, showPromptModal } from '../utils.js';
import { updatePaginationControls, renderFilterControls, injectLogoutButton, ensureAdminFieldsExist, setupDropZone, toggleAdminModal } from '../ui.js';
import { Product } from '../types.js';
import { addToCart } from '../actions/cart.js';
import { genSku,} from './shared.js';

declare const window: any;

/**
 * fetchDataAndLoad
 * Fetches data from the database or data.json depending on
 * state.useDB and populates state.products and state.pageCache.
 * If state.useDB is true, it fetches data from the database.
 * If state.useDB is false, it fetches data from data.json.
 * It also loads user data if not logged in and injects the logout button.
 * @returns {void}
 */
export async function fetchDataAndLoad() {
  const { groupSidebarElements } = await import('../ui.js');
  groupSidebarElements();

  // Try to restore session if not logged in
  if (!state.currentUser) {
      console.log("fetchDataAndLoad: Checking for session...");
      try {
        const { restoreSession } = await import('./auth.js');
        await restoreSession();
      } catch (e) {
        console.error("Error importing auth or restoring session:", e);
      }
  }

  const savedPage = parseInt(localStorage.getItem('cactusPage') || '1') || 1;
  const savedLimit = parseInt(localStorage.getItem('cactusLimit') || '20') || 20;
  state.itemsPerPage = savedLimit;
  state.currentPage = savedPage;
  state.pageCache = {};

  try {
    const res = await fetch(`/.netlify/functions/get-products?page=${savedPage}&limit=${savedLimit}`);
    if (res.ok) {
      const data = await res.json();
      state.useDB = true;
      state.products = data.products;
      state.totalItems = data.total;
      state.pageCache[savedPage] = { products: data.products, total: data.total };
      loadUserData(false);
      injectLogoutButton();
      renderPage(savedPage, true);
      return;
    }
  } catch (e) {
    console.log("DB load failed, falling back to data.json", e);
  }
}

export function loadUserData(render = true) {
  if (state.currentUser === 'admin' && !state.useDB) {
    const storedProducts = localStorage.getItem(getStorageKey('cactusProducts', state.currentUser));
    if (storedProducts) {
      try {
        let stored: Product[] = JSON.parse(storedProducts);
        if (state.defaultProducts.length > 0 && stored.length > 0) {
            const freshKeys = Object.keys(state.defaultProducts[0]) as (keyof Product)[];
            stored = stored.map(storedItem => {
                const freshItem = state.defaultProducts.find(dp => dp.id === storedItem.id);
                freshKeys.forEach(key => {
                    if ((storedItem as any)[key] === undefined) {
                        (storedItem as any)[key] = freshItem ? (freshItem as any)[key] : null;
                    }
                });
                return storedItem;
            });
        }
        state.allProducts = stored;
      } catch (e) {
        console.error("Error loading products from localStorage:", e);
        state.allProducts = JSON.parse(JSON.stringify(state.defaultProducts));
      }
    } else {
      state.allProducts = JSON.parse(JSON.stringify(state.defaultProducts));
    }
  } else if (!state.useDB) {
    state.allProducts = JSON.parse(JSON.stringify(state.defaultProducts));
  }
  const storedCart = localStorage.getItem(getStorageKey('cactusCart', state.currentUser));
  if (storedCart) {
      // We need to import updateCartUI from UI or Cart? It's in UI.
      // Circular dependency management: We can import updateCartUI from ui.js
      import('../ui.js').then(({ updateCartUI }) => {
          state.cart = JSON.parse(storedCart).filter((item: any) => item);
          updateCartUI();
          
          state.hiddenProductIds.clear();
          state.cart.forEach(item => state.hiddenProductIds.add(item.id));
          if (render) renderPage(1);
      });
  } else {
      import('../ui.js').then(({ updateCartUI }) => {
        state.cart = [];
        updateCartUI();
        state.hiddenProductIds.clear();
        if (render) renderPage(1);
      });
  }
  
  localStorage.setItem(getStorageKey('cactusProducts', state.currentUser), JSON.stringify(state.products));
}

export function applyFilter(type: string) {
  state.currentFilter = type;
  state.currentPage = 1;
  state.pageCache = {};
  renderPage(1);
}

export function handleSearch(query: string) {
  const prev = state.searchQuery;
  state.searchQuery = query;
  
  const prevEffective = prev.length >= 2;
  const currentEffective = query.length >= 2;
  
  if (prevEffective || currentEffective) {
      state.currentPage = 1;
      state.pageCache = {};
      renderPage(1, false, true);
  }
}

export async function renderPage(page: number, skipFetch = false, suppressLoading = false) {
  localStorage.setItem('cactusPage', page.toString());
  state.currentPage = page;

  if (state.useDB && !skipFetch) {
    if (state.pageCache[page]) {
      state.products = state.pageCache[page].products;
      state.totalItems = state.pageCache[page].total;

      const searchParam = state.searchQuery.length >= 2 ? `&search=${encodeURIComponent(state.searchQuery)}` : '';
      fetch(`/.netlify/functions/get-products?page=${page}&limit=${state.itemsPerPage}&class=${state.currentFilter}${searchParam}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            state.pageCache[page] = { products: data.products, total: data.total };
            if (state.currentPage === page) {
              state.products = data.products;
              state.totalItems = data.total;
              renderPage(page, true);
            }
          }
        })
        .catch(e => console.error("Background stock check failed:", e));
    } else {
      try {
        if (!suppressLoading) showLoadingMask("Loading Products...");
        const searchParam = state.searchQuery.length >= 2 ? `&search=${encodeURIComponent(state.searchQuery)}` : '';
        const res = await fetch(`/.netlify/functions/get-products?page=${page}&limit=${state.itemsPerPage}&class=${state.currentFilter}${searchParam}`);
        if (res.ok) {
          const data = await res.json();
          state.products = data.products;
          state.totalItems = data.total;
          state.pageCache[page] = { products: data.products, total: data.total };
        }
      } catch (e) {
        console.error("Error fetching products:", e);
      } finally {
        if (!suppressLoading) hideLoadingMask();
      }
    }
  } else if (!state.useDB) {
    let visibleProducts = state.allProducts;
    
    if (state.currentFilter !== 'All') {
      visibleProducts = visibleProducts.filter(p => {
        if (p.class) return p.class === state.currentFilter;
        return p.scientific && p.scientific.includes(state.currentFilter);
      });
    }

    if (state.searchQuery.length >= 2) {
        const q = state.searchQuery.toLowerCase();
        visibleProducts = visibleProducts.filter(p => {
            const price = (p.price_cents / 100).toFixed(2);
            
            const sku = genSku(p.class, p.id).toLowerCase();
            return p.name.toLowerCase().includes(q) || 
                   price.includes(q) ||
                   sku.includes(q);
        });
    }

    state.totalItems = visibleProducts.length;
    const start = (page - 1) * state.itemsPerPage;
    state.products = visibleProducts.slice(start, start + state.itemsPerPage);
  }

  const totalPages = Math.ceil(state.totalItems / state.itemsPerPage) || 1;
  if (page > totalPages) state.currentPage = totalPages;
  if (page < 1) state.currentPage = 1;

  if (state.products) {
    state.products.sort((a, b) => {
      const aQty = (state.useDB && a.quantity !== undefined && a.quantity !== null) ? Number(a.quantity) : 1;
      const bQty = (state.useDB && b.quantity !== undefined && b.quantity !== null) ? Number(b.quantity) : 1;
      const aOOS = aQty <= 0;
      const bOOS = bQty <= 0;
      if (aOOS === bOOS) return 0;
      return aOOS ? 1 : -1;
    });
  }

  const grid = document.getElementById("product-grid");
  if (grid) {
    grid.classList.add('fade-out');
    await new Promise(resolve => setTimeout(resolve, 500));

    grid.innerHTML = "";
    
    const existingMsg = document.getElementById('no-results-message');
    if (existingMsg) existingMsg.remove();
    
    if (state.products.length === 0) {
      const msgDiv = document.createElement('div');
      msgDiv.id = 'no-results-message';
      msgDiv.innerHTML = `
          <h3 class="no-results-title">${translations[state.currentLang].noResultsTitle}</h3>
          <p class="no-results-text">${translations[state.currentLang].noResultsText}</p>
      `;
      document.body.appendChild(msgDiv);
    }

    state.products.forEach((product) => {
      const sciName = product.scientific
        ? `<span class="scientific-name">${product.scientific}</span>`
        : "";

      const classDisplay = product.class
        ? `<span class="product-class">${product.class}</span>`
        : "";

      const metaRow = (sciName || classDisplay)
        ? `<div class="product-meta-row">
             ${sciName}
             ${classDisplay}
           </div>`
        : "";

      const skuDisplay = product.sku
        ? `<span class="product-sku">SKU: ${product.sku}</span>`
        : "";

      let matchInfo = "";
      if (state.searchQuery && state.searchQuery.length >= 2) {
        const q = state.searchQuery.toLowerCase();
        const matches: string[] = [];
        const t = translations[state.currentLang];

        if (product.name.toLowerCase().includes(q)) matches.push(t.labelMatchName);
        if (product.scientific && product.scientific.toLowerCase().includes(q)) matches.push(t.labelMatchSci);
        
        const price = (Number(product.price_cents) / 100).toFixed(2);
        if (price.includes(q)) matches.push(t.labelMatchPrice);
        
        
        const gen_sku = genSku(product.class, product.id).toLowerCase();
        if ((product.sku && product.sku.toLowerCase().includes(q)) || gen_sku.includes(q)) matches.push(t.labelMatchSku);

        if (matches.length > 0) {
            matchInfo = `<span class="match-info">${t.labelMatchMatched}: ${matches.join(", ")}</span>`;
        }
      }

      const detailsRow = (skuDisplay || matchInfo)
        ? `<div class="product-details-row">
             ${skuDisplay}
             ${matchInfo}
           </div>`
        : "";

      let displayImage = product.image_url;

      let stockDisplay = "";
      let btnAttrs = `onclick="addToCart(${product.id})"`;
      let btnText = translations[state.currentLang].btnAddCart;
      let btnClass = "";

      if (state.useDB && product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0) {
        stockDisplay = `<div class="out-of-stock-label">${translations[state.currentLang].outOfStock.toUpperCase()}</div>`;
        btnAttrs = "disabled";
        btnText = translations[state.currentLang].outOfStock;
        btnClass = "btn-disabled-custom";
      } else if (state.hiddenProductIds.has(product.id)) {
        stockDisplay = `<div class="out-of-stock-label">${(translations[state.currentLang].itemInCart || "Item in Cart").toUpperCase()}</div>`;
        btnAttrs = "disabled";
        btnText = translations[state.currentLang].itemInCart || "Item in Cart";
        btnClass = "btn-disabled-custom";
      }

      const priceUSD = Number(product.price_cents) / 100;
      const priceCRC = priceUSD * EXCHANGE_RATE;
      
      if (!displayImage.includes('?export=download&id=XXXXXXXXXXXX')){
        grid.innerHTML += `
            <div class="product-card">
                <picture>
                    <source media="(max-width: 600px)" srcset="${displayImage}?w=300,q=auto,f_webp" type="image/webp">
                    <source media="(max-width: 900px)" srcset="${displayImage}?w_400,q_auto,f_webp" type="image/webp">
                    <img src="${displayImage}?w=500,q_auto" 
                        srcset="${displayImage}?w=300,q_auto 300w, ${displayImage}?w=400,q_auto 400w, ${displayImage}?w=500,q_auto 500w"
                        sizes="(max-width: 600px) 300px, (max-width: 900px) 400px, 500px"
                        class="product-image product-image-zoom" 
                        alt="${product.name}" 
                        loading="lazy"
                        onclick="openImageModal(${product.id})">
                </picture>
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    ${metaRow}
                    ${detailsRow}
                    ${stockDisplay}
                    <div class="product-price">$${priceUSD.toFixed(2)} / ₡${priceCRC.toLocaleString()}</div>
                    <button class="add-btn ${btnClass}" ${btnAttrs}>${btnText}</button>
                </div>
            </div>`;
    } else {
      const di = `https://lh3.googleusercontent.com/d/${displayImage.split("?export=download&id=")[1]}=w500`;
      console.log('DIIIIII', displayImage);
      grid.innerHTML += `
        <div class="product-card">
            <img src="${di}" 
                class="product-image product-image-zoom" 
                alt="${product.name}" 
                loading="lazy"
                onclick="openImageModal(${product.id})">
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                ${metaRow}
                ${detailsRow}
                ${stockDisplay}
                <div class="product-price">$${priceUSD.toFixed(2)} / ₡${priceCRC.toLocaleString()}</div>
                <button class="add-btn ${btnClass}" ${btnAttrs}>${btnText}</button>
            </div>
        </div>`;
    }
   });
    setTimeout(() => grid.classList.remove('fade-out'), 50);
  }

  updatePaginationControls(state.totalItems);
}

export function changeItemsPerPage(val: string) {
  state.itemsPerPage = parseInt(val);
  localStorage.setItem('cactusLimit', state.itemsPerPage.toString());
  state.pageCache = {};
  renderPage(1);
}

export async function openImageModal(id: number, fromCart: boolean = false) {
  let product = state.products.find((p) => p.id == id);

  if (!product) {
    product = state.cart.find((p) => p.id == id);
  }

  if (!product && state.useDB) {
    try {
      showLoadingMask("Loading product...");
      const res = await fetch(`/.netlify/functions/get-products?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.products && data.products.length > 0) {
          product = data.products[0];
        }
      }
    } catch (e) {
      console.error("Failed to fetch product for modal", e);
    } finally {
      hideLoadingMask();
    }
  }
  if (!product) return;

  if (state.isAdmin && !fromCart) {
    toggleAdminModal();
    ensureAdminFieldsExist();
    (document.getElementById("new-name") as HTMLInputElement).value = product.name;
    (document.getElementById("new-price") as HTMLInputElement).value = (product.price_cents / 100).toFixed(2);
    (document.getElementById("new-image") as HTMLInputElement).value = product.image_url;
    (document.getElementById("new-scientific") as HTMLInputElement).value = product.scientific || "";
    (document.getElementById("new-class") as HTMLSelectElement).value = product.class || "None";
    (document.getElementById("new-notes") as HTMLTextAreaElement).value = product.notes || "";
    setupDropZone(product.image_url);
    state.editingProductId = product.id;

    const btn = document.querySelector("#admin-modal .add-btn") as HTMLElement;
    if (btn) btn.innerText = translations[state.currentLang].btnUpdateProduct;

    const title = document.querySelector("#admin-modal h2") as HTMLElement;
    if (title) title.innerText = "Edit Cactus";

    return;
  }

  const modal = document.getElementById("image-modal");
  const img = document.getElementById("modal-img") as HTMLImageElement;
  const btn = document.getElementById("modal-add-btn") as HTMLButtonElement;

  if (!modal || !img || !btn) return;

  let src = product.image_url || '';

  if (src.includes('cloudinary.com')) {
    src = src
      .replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/')
      .replace('http://', 'https://');
  }

  img.src = src;

  btn.innerText = translations[state.currentLang].modalAddCart;
  btn.onclick = function () {
    addToCart(product!.id);
  };

  btn.disabled = false;
  btn.classList.remove("btn-disabled-custom");
  btn.style.display = fromCart ? "none" : "";

  if (state.useDB && product.quantity !== undefined && product.quantity !== null && Number(product.quantity) <= 0) {
    btn.innerText = translations[state.currentLang].outOfStock;
    btn.disabled = true;
    btn.classList.add("btn-disabled-custom");
    btn.onclick = null;
  } else if (state.hiddenProductIds.has(product.id) && !fromCart) {
    btn.innerText = translations[state.currentLang].itemInCart || "Item in Cart";
    btn.disabled = true;
    btn.classList.add("btn-disabled-custom");
    btn.onclick = null;
  }

  modal.style.display = "flex";
}

export async function identifyPlant(imageUrl: string) {
  showLoadingMask("Identifying plant...");
  
  let data: any = null;
  let usedApi = 'Kindwise';
  const failedApis: string[] = [];

  try {
    try {
      const res = await fetch('/.netlify/functions/identify-plant-kindwise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || res.statusText);
      data = json;
    } catch (e) {
      console.error("Kindwise identification failed, trying OpenAI:", e);
      failedApis.push('Kindwise');
      usedApi = 'ChatGPT';
      try {
        const res = await fetch('/.netlify/functions/identify-plant-openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl })
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || res.statusText);
        data = json;
      } catch (e2) {
        console.error("ChatGPT identification failed, trying Ollama:", e2);
        failedApis.push('ChatGPT');
        usedApi = 'Ollama';
        try {
            const res = await fetch('/.netlify/functions/identify-plant-ollama', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl })
            });
            const json = await res.json();
            if (!res.ok || json.error) throw new Error(json.error || res.statusText);
            data = json;
        } catch (e3) {
            console.error("Ollama identification failed, trying Gemini:", e3);
            failedApis.push('Ollama');
            usedApi = 'Gemini';
            try {
                const res = await fetch('/.netlify/functions/identify-plant-gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageUrl })
                });
                const json = await res.json();
                if (!res.ok || json.error) throw new Error(json.error || res.statusText);
                data = json;
            } catch (e4) {
                console.error("Gemini identification failed, trying Grok:", e4);
                failedApis.push('Gemini');
                usedApi = 'Grok';
                try {
                    const res = await fetch('/.netlify/functions/identify-plant-grok', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl })
                    });
                    data = await res.json();
                    if (data.error) console.error("Grok identification failed:", data.error);
                } catch (e5) {
                    console.error("Grok identification failed:", e5);
                    data = { error: e5 instanceof Error ? e5.message : String(e5) };
                }
            }
        }
      }
    }

    hideLoadingMask();
    
    if (data && data.error) {
        failedApis.push(usedApi);
        const uniqueFailed = [...new Set(failedApis)];

        const promptText = "Can you identify this plant? Please provide only the Scientific Name: and Class: as text";
        
        const copyToClipboard = async () => {
            showLoadingMask("Copying to clipboard...");
            try {
                let blob: Blob;
                if (imageUrl.startsWith('data:')) {
                    blob = await (await fetch(imageUrl)).blob();
                } else {
                    const resp = await fetch(imageUrl);
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

                    blob = await new Promise<Blob>(r =>
                        canvas.toBlob(b => r(b!), 'image/png')
                    );
                }

                const htmlBlob = new Blob([promptText + '<br>'], { type: 'text/html' });
                const textBlob = new Blob([promptText], { type: 'text/plain' });

                const item = new ClipboardItem({
                    'image/png': blob,
                    'text/html': htmlBlob,
                    'text/plain': textBlob
                });

                await navigator.clipboard.write([item]);

            } catch (e) {
                console.error("Clipboard write failed", e);
                navigator.clipboard.writeText(promptText).catch(() => {});
            } finally {
                hideLoadingMask();
            }
        };

        const webAis: {[key: string]: string} = {
            'ChatGPT': 'https://chatgpt.com',
            'Gemini': 'https://gemini.google.com/app',
            'Grok': 'https://grok.com'
        };

        const options = uniqueFailed.filter(api => webAis[api]);

        if (options.length > 0) {
            let msg = `Identification failed with: ${uniqueFailed.join(', ')}.\n\nSelect a service to open manually (Prompt & Image will be copied):\n`;
            options.forEach((api, i) => {
                msg += `${i + 1}. ${api}\n`;
            });

            const selection = prompt(msg);
            if (selection) {
                const index = parseInt(selection) - 1;
                if (index >= 0 && index < options.length) {
                    const selectedApi = options[index];
                    await copyToClipboard();
                    window.open(webAis[selectedApi], '_blank');

                    const pasted = await showPromptModal("Paste the AI response here to parse Class and Scientific Name:", "", promptText, imageUrl);
                    if (pasted) {
                        const cleanStr = (s: string) => s.replace(/[*`]/g, '').trim();
                        
                        const classMatch = pasted.match(/(?:Class|Genus)[\s*:]+((?:(?!(?:Scientific|Scientific Name)[\s*:]).)+)/i);
                        const sciMatch = pasted.match(/(?:Scientific Name|Scientific)[\s*:]+((?:(?!(?:Class|Genus)[\s*:]).)+)/i);
                        
                        const extractedClass = classMatch ? cleanStr(classMatch[1]) : null;
                        const extractedSci = sciMatch ? cleanStr(sciMatch[1]) : null;

                        if (extractedClass || extractedSci) {
                             const cls = document.getElementById('new-class') as HTMLSelectElement;
                             const sci = document.getElementById('new-scientific') as HTMLInputElement;

                             if (extractedClass && cls) {
                                let exists = false;
                                for (let i = 0; i < cls.options.length; i++) {
                                    if (cls.options[i].value === extractedClass) {
                                        exists = true;
                                        break;
                                    }
                                }

                                if (!exists && confirm(`Class '${extractedClass}' is not in the list. Add it to the database?`)) {
                                      try {
                                          await fetch('/.netlify/functions/add-plant-class', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ name: extractedClass })
                                          });
                                          state.plantClasses.push(extractedClass);
                                          const opt = document.createElement('option');
                                          opt.value = extractedClass;
                                          opt.innerText = extractedClass;
                                          cls.appendChild(opt);
                                          renderFilterControls();
                                      } catch (e) { console.error(e); alert("Failed to add class"); }
                                }
                                cls.value = extractedClass;
                                cls.dispatchEvent(new Event('change'));
                             }

                             if (extractedSci && sci) {
                                 sci.value = extractedSci;
                             }
                        }
                    }
                }
            }
        } else if (usedApi === 'Ollama') {
            alert(`Identification failed (${usedApi}): ${data.error}\n\nEnsure Ollama is running locally (port 11434) with a vision model (e.g. 'llava').`);
        } else {
            alert(`Identification failed (${usedApi}): ` + data.error);
        }
        return;
    }

    if (data.class && data.scientific) {
       if (data.class === 'Unknown' || data.scientific === 'Unknown') {
           alert(`The AI (${usedApi}) analyzed the image but could not identify the plant.`);
           return;
       }

       if (confirm(`Identified by ${usedApi}:\nClass: ${data.class}\nScientific: ${data.scientific}\n\nDo you want to use these values?`)) {
          const cls = document.getElementById('new-class') as HTMLSelectElement;
          const sci = document.getElementById('new-scientific') as HTMLInputElement;
          
          if (cls) { 
            let exists = false;
            for (let i = 0; i < cls.options.length; i++) {
                if (cls.options[i].value === data.class) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                if (confirm(`Class '${data.class}' is not in the list. Add it to the database?`)) {
                    try {
                        await fetch('/.netlify/functions/add-plant-class', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: data.class })
                        });
                        state.plantClasses.push(data.class);
                        const opt = document.createElement('option');
                        opt.value = data.class;
                        opt.innerText = data.class;
                        cls.appendChild(opt);
                        renderFilterControls();
                    } catch (e) { console.error(e); alert("Failed to add class"); return; }
                } else {
                    return;
                }
            }

            cls.value = data.class; 
            cls.dispatchEvent(new Event('change')); 
          }
          if (sci) sci.value = data.scientific;
       }
    } else {
        alert("Could not identify plant.");
    }
  } catch (e) { hideLoadingMask(); console.error(e); alert("Identification error"); }
}

export async function fetchPlantClasses() {
  try {
    const res = await fetch('/.netlify/functions/get-plant-classes');
    if (res.ok) {
      const classes = await res.json();
      state.plantClasses = ['All', ...(Array.isArray(classes) ? classes : [])];
      renderFilterControls();
    }
  } catch (e) {
    console.error("Failed to fetch plant classes", e);
  }
}
