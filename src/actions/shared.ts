import { state } from '../state.js';
import { translations } from '../constants.js';

declare const window: any;

export function toggleLanguage() {
    const nextLang = state.currentLang === 'en' ? 'es' : 'en';
    const msg = translations[state.currentLang].alertLangChange;

    if (confirm(msg)) {
      state.currentLang = nextLang;
      localStorage.setItem('cactusLang', state.currentLang);
      window.location.reload();
    }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadFileToCloudinary(file: string, folder?: string): Promise<string> {
    const res = await fetch("/.netlify/functions/upload-image-signed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: file,
        folder: folder || "cactus",
      })
    });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return data.secure_url;
}
