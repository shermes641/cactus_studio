import { MAX_IMG_CACHE_PERCENT, MAX_IMGS, DEFAULT_IMG_CACHE, THEME } from './constants.js';

let APP_VERSION = '';

export const calculateMaxImgCache = () => {
  try {
    const availableMemory = (window.performance as any).memory.totalJSHeapSize - (window.performance as any).memory.usedJSHeapSize;
    const res =  Math.floor(availableMemory * MAX_IMG_CACHE_PERCENT);
    return res > MAX_IMGS ? MAX_IMGS : res;
  } catch (error) {
    console.error('Error calculating max image cache:', error);
    return DEFAULT_IMG_CACHE;
  }
};

export async function getVersion() {
  const res = await fetch("/.netlify/functions/version");
  return (await res.json()).version;
}

export const setVersionDisplay = async () => {
  if (APP_VERSION == '') {
    APP_VERSION = await getVersion();
  }
  const versionElements = document.querySelectorAll('.version-tag');
  versionElements.forEach(element => {
    element.textContent = `© 2026 \n🌵 Cactus Studio. 🌵\nAll rights reserved.\nv${APP_VERSION}`;
  });
};

export function injectLoadingMask() {
  // Ensure the initial-loader has a text container if it doesn't already
  const loader = document.getElementById('initial-loader');
  if (loader && !loader.querySelector('.loader-text')) {
    const txt = document.createElement('div');
    txt.className = 'loader-text';
    loader.appendChild(txt);
  }
}

export function showLoadingMask(text: string) {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    let txt = loader.querySelector('.loader-text') as HTMLElement;
    if (!txt) {
        txt = document.createElement('div');
        txt.className = 'loader-text';
        loader.appendChild(txt);
    }
    txt.innerText = text || "Loading...";
    loader.classList.remove('loader-dismissed');
  }
}

export function fadeOutInitialLoader(dly = 1000) {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('loader-dismissed');
    }, dly);
  }
}

export function hideLoadingMask() {
  fadeOutInitialLoader();
}

export function getStorageKey(key: string, currentUser: string | null) {
  return currentUser ? `${key}_${currentUser}` : key;
}

export function togglePasswordVisibility(inputId: string, iconId: string) {
  const input = document.getElementById(inputId) as HTMLInputElement;
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;

  if (input.type === "password") {
    input.type = "text";
    icon.innerText = "🙈";
  } else {
    input.type = "password";
    icon.innerText = "👁️";
  }
}

export function showPromptModal(
  message: string,
  defaultValue: string = "",
  copyText: string | null = null,
  copyImage: string | null = null,
  emailBody: string | null = null
): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      `position:fixed;top:0;left:0;width:100%;height:100%;background:${THEME.overlay};z-index:20000;display:flex;justify-content:center;align-items:center;`;

    const dialog = document.createElement("div");
    dialog.style.cssText =
      `background:${THEME.white};padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);min-width:300px;max-width:90%;display:flex;flex-direction:column;gap:10px;`;

    const label = document.createElement("label");
    label.innerText = message;
    label.style.fontWeight = "bold";
    label.style.marginBottom = "5px";
    dialog.appendChild(label);

    if (copyText || copyImage) {
      const copyContainer = document.createElement("div");
      copyContainer.style.cssText =
        `display:flex; gap:5px; align-items:center; margin-bottom:5px; background:${THEME.gray100}; padding:8px; border-radius:4px;`;

      if (copyText) {
        const copyContent = document.createElement("div");
        copyContent.innerText = copyText;
        copyContent.style.cssText =
          `flex:1; font-size:0.85em; color:${THEME.text}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
        copyContent.title = copyText;
        copyContainer.appendChild(copyContent);

        const copyBtn = document.createElement("button");
        copyBtn.innerText = "Copy Prompt";
        copyBtn.style.cssText =
          `padding:4px 8px; border:1px solid ${THEME.gray400}; background:${THEME.white}; border-radius:4px; cursor:pointer; font-size:0.8em; white-space:nowrap;`;
        copyBtn.onclick = () => {
          if (copyBtn.innerText !== "Copy Prompt") return;
          navigator.clipboard.writeText(copyText);
          copyBtn.innerText = "Copied!";
          setTimeout(() => (copyBtn.innerText = "Copy Prompt"), 1500);
        };
        copyContainer.appendChild(copyBtn);
      }

      if (copyImage) {
        const copyImgBtn = document.createElement("button");
        copyImgBtn.innerText = "Copy Image";
        copyImgBtn.style.cssText =
          `padding:4px 8px; border:1px solid ${THEME.gray400}; background:${THEME.white}; border-radius:4px; cursor:pointer; font-size:0.8em; white-space:nowrap;`;

        copyImgBtn.onclick = async () => {
          if (copyImgBtn.innerText !== "Copy Image") return;
          copyImgBtn.innerText = "...";
          try {
            let blob: Blob;
            if (copyImage.startsWith("data:")) {
              blob = await (await fetch(copyImage)).blob();
            } else {
              const resp = await fetch(copyImage);
              blob = await resp.blob();
            }

            if (blob.type !== "image/png") {
              const img = new Image();
              img.src = URL.createObjectURL(blob);
              await new Promise<void>((r) => (img.onload = () => r()));
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d")!;
              ctx.drawImage(img, 0, 0);
              blob = await new Promise<Blob>((r) =>
                canvas.toBlob((b) => r(b!), "image/png")
              );
            }

            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            copyImgBtn.innerText = "Copied!";
          } catch (e) {
            console.error(e);
            copyImgBtn.innerText = "Error";
          }
          setTimeout(() => (copyImgBtn.innerText = "Copy Image"), 1500);
        };
        copyContainer.appendChild(copyImgBtn);
      }

      dialog.appendChild(copyContainer);
    }

    if (emailBody) {
      const previewContainer = document.createElement("div");
      previewContainer.style.cssText =
        `margin-bottom:10px; border:1px solid ${THEME.gray300}; padding:10px; background:${THEME.light}; max-height:300px; overflow-y:auto; font-family:sans-serif;`;

      const header = document.createElement("div");
      header.innerText = "📧 Email Preview (Test Mode):";
      header.style.cssText =
        `font-weight:bold; margin-bottom:5px; color:${THEME.gray700}; font-size:0.9em;`;
      previewContainer.appendChild(header);

      const content = document.createElement("div");
      content.innerHTML = emailBody;
      previewContainer.appendChild(content);

      dialog.appendChild(previewContainer);
    }

    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultValue;
    input.style.padding = "8px";
    input.style.border = `1px solid ${THEME.gray400}`;
    input.style.borderRadius = "4px";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    dialog.appendChild(input);

    const btnContainer = document.createElement("div");
    btnContainer.style.cssText =
      "display:flex;justify-content:flex-end;gap:10px;margin-top:10px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.innerText = "Cancel";
    cancelBtn.style.cssText =
      `padding:8px 12px;border:1px solid ${THEME.gray400};background:${THEME.white};border-radius:4px;cursor:pointer;`;

    const okBtn = document.createElement("button");
    okBtn.innerText = "OK";
    okBtn.style.cssText =
      `padding:8px 12px;border:none;background:${THEME.primary};color:${THEME.white};border-radius:4px;cursor:pointer;`;

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
      if (e.key === "Enter") okBtn.click();
      if (e.key === "Escape") cancelBtn.click();
    };

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(okBtn);
    dialog.appendChild(btnContainer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    input.focus();
  });
}
