import { MAX_IMG_CACHE_PERCENT, MAX_IMGS, DEFAULT_IMG_CACHE, APP_VERSION } from './constants.js';

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

export const setVersionDisplay = () => {
  const versionElements = document.querySelectorAll('.version-tag');
  versionElements.forEach(element => {
    element.textContent = `v${APP_VERSION}`;
  });
};

export function injectLoadingMask() {
  if (document.getElementById('loading-mask')) return;

  const style = document.createElement('style');
  style.innerHTML = `
    #loading-mask {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(81, 134, 97, 0.9);
        z-index: 10000;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
    .cactus-spinner {
        width: 300px;
        height: auto;
        border-radius: 50%;
    }
    #loading-text {
        margin-top: 20px;
        font-size: 1.5rem;
        font-weight: bold;
        color: #2c3e50;
        font-family: sans-serif;
    }
  `;
  document.head.appendChild(style);

  const mask = document.createElement('div');
  mask.id = 'loading-mask';
  mask.innerHTML = '<img src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGhobHJza2x6c3I0NmFoYjFteHRjcHJocTQ3dXVwcDd2Y2gyN3hwYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/2XPiOKpTiLOG4NeXm7/giphy.gif" class="cactus-spinner" alt="Loading..."><div id="loading-text">Processing...</div>';
  document.body.appendChild(mask);
}

export function showLoadingMask(text: string) {
  const mask = document.getElementById('loading-mask');
  const txt = document.getElementById('loading-text');
  if (mask && txt) {
    txt.innerText = text || "Loading...";
    mask.style.display = 'flex';
  }
}

export function hideLoadingMask() {
  const mask = document.getElementById('loading-mask');
  if (mask) {
    mask.style.display = 'none';
  }
}

export function getStorageKey(key: string, currentUser: string | null) {
  return currentUser ? `${key}_${currentUser}` : key;
}


