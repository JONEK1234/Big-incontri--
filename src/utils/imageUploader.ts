import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

/**
 * Custom logger that dispatches a global window event to be consumed by the UI's live debug console
 */
export const addSystemLog = (type: "info" | "log" | "warn" | "error" | "success", text: string) => {
  console.log(`[${type.toUpperCase()}] ${text}`);
  if (typeof window !== "undefined") {
    const event = new CustomEvent("system_log", { detail: { type, text, timestamp: new Date().toLocaleTimeString() } });
    window.dispatchEvent(event);
  }
};

/**
 * Convers Base64 data URL to a binary Blob for anonymous public cloud APIs.
 */
export function base64ToBlob(base64Str: string): Blob | null {
  try {
    const parts = base64Str.split(";base64,");
    if (parts.length < 2) return null;
    const contentType = parts[0].split(":")[1] || "image/jpeg";
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (err: any) {
    console.error("Errore conversione Base64 -> Blob:", err);
    return null;
  }
}

/**
 * Advanced multi-tier uploading function with progressive cloud fallbacks
 */
export async function uploadImageToStorage(base64Str: string, folderAndName: string): Promise<string> {
  addSystemLog("info", `[Uploader] Avvio caricamento per: ${folderAndName}`);

  // ---- 1. PRIMARY TARGET: Firebase Storage with 2.2-second timeout ----
  try {
    addSystemLog("info", "[Firebase] Connessione a Firebase Storage...");
    const storageRef = ref(storage, folderAndName);

    const uploadPromise = (async () => {
      const uploadResult = await uploadString(storageRef, base64Str, "data_url");
      addSystemLog("success", "[Firebase] File trasferito. Generazione link pubblico...");
      return await getDownloadURL(uploadResult.ref);
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout Firebase Storage (2.2s)")), 2200)
    );

    const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
    addSystemLog("success", `[Firebase] Successo! URL Cloud: ${downloadUrl}`);
    
    // Notify window for real-time preview link display
    window.dispatchEvent(new CustomEvent("system_generated_link", { detail: { url: downloadUrl } }));
    return downloadUrl;

  } catch (error: any) {
    addSystemLog("warn", `[Firebase] Fallito o lento (${error.message || error}). Fallback su server locale...`);

    // ---- 2. SECONDARY TARGET: Express Local Backend (`/api/upload`) ----
    try {
      addSystemLog("info", "[Server Locale] Invio immagine compressa a /api/upload...");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Str })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          const localUrl = window.location.origin + data.url;
          addSystemLog("success", `[Server Locale] Successo! Immagine salvata in locale: ${localUrl}`);
          window.dispatchEvent(new CustomEvent("system_generated_link", { detail: { url: localUrl } }));
          return localUrl;
        }
      }
      addSystemLog("warn", "[Server Locale] Risposta non valida dal server locale.");
    } catch (apiErr: any) {
      addSystemLog("warn", `[Server Locale] Endpoint locale non raggiungibile o non supportato.`);
    }

    // Prepare blob for cloud fallbacks
    const blob = base64ToBlob(base64Str);
    if (!blob) {
      addSystemLog("error", "[Blob] Errore di conversione. Impossibile tentare caricamenti cloud.");
      return getUnsplashPlaceholder();
    }

    // ---- 3. CLOUD FALLBACK 1: Imgur API ----
    try {
      addSystemLog("info", "[Imgur Cloud] Tentativo di upload su Imgur...");
      const imgurFormData = new FormData();
      imgurFormData.append("image", blob);
      imgurFormData.append("type", "file");

      const imgurRes = await fetch("https://api.imgur.com/3/image", {
        method: "POST",
        headers: {
          Authorization: "Client-ID 546c25a59c58ad7" // High performance public client-id
        },
        body: imgurFormData
      });

      if (imgurRes.ok) {
        const data = await imgurRes.json();
        if (data.success && data.data && data.data.link) {
          const downloadUrl = data.data.link;
          addSystemLog("success", `[Imgur Cloud] Successo! URL pubblico: ${downloadUrl}`);
          window.dispatchEvent(new CustomEvent("system_generated_link", { detail: { url: downloadUrl } }));
          return downloadUrl;
        }
      }
      addSystemLog("warn", "[Imgur Cloud] Risposta non valida o quota superata.");
    } catch (imgurErr: any) {
      addSystemLog("warn", `[Imgur Cloud] Errore: ${imgurErr.message}`);
    }

    // ---- 4. CLOUD FALLBACK 2: Pixeldrain API ----
    try {
      addSystemLog("info", "[Pixeldrain Cloud] Tentativo di upload su Pixeldrain...");
      const formData = new FormData();
      formData.append("file", blob, `meeting_photo_${Date.now()}.jpg`);
      formData.append("anonymous", "true");

      const pxRes = await fetch("https://pixeldrain.com/api/file", {
        method: "POST",
        body: formData,
      });

      if (pxRes.ok) {
        const data = await pxRes.json();
        if (data.success && data.id) {
          const downloadUrl = `https://pixeldrain.com/api/file/${data.id}`;
          addSystemLog("success", `[Pixeldrain Cloud] Successo! URL pubblico: ${downloadUrl}`);
          window.dispatchEvent(new CustomEvent("system_generated_link", { detail: { url: downloadUrl } }));
          return downloadUrl;
        }
      }
      addSystemLog("warn", "[Pixeldrain Cloud] Risposta o status non valido.");
    } catch (pxErr: any) {
      addSystemLog("warn", `[Pixeldrain Cloud] Errore: ${pxErr.message}`);
    }

    // ---- 5. CLOUD FALLBACK 3: TmpFiles API ----
    try {
      addSystemLog("info", "[TmpFiles Cloud] Tentativo di upload su TmpFiles...");
      const formDataTmp = new FormData();
      formDataTmp.append("file", blob, `meeting_photo_${Date.now()}.jpg`);

      const tmpRes = await fetch("https://tmpfiles.org/api/v1/upload", {
        method: "POST",
        body: formDataTmp
      });
      if (tmpRes.ok) {
        const dataTmp = await tmpRes.json();
        if (dataTmp.status === "success" && dataTmp.data && dataTmp.data.url) {
          const directUrl = dataTmp.data.url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
          addSystemLog("success", `[TmpFiles Cloud] Successo! URL pubblico diretto: ${directUrl}`);
          window.dispatchEvent(new CustomEvent("system_generated_link", { detail: { url: directUrl } }));
          return directUrl;
        }
      }
      addSystemLog("warn", "[TmpFiles Cloud] Risposta non valida.");
    } catch (tmpErr: any) {
      addSystemLog("warn", `[TmpFiles Cloud] Errore: ${tmpErr.message}`);
    }

    // ---- 6. FINAL SAFE NET: Gorgeous Unsplash Placeholder ----
    addSystemLog("error", "[Safe Fallback] Tutti i canali cloud e locali sono falliti. Restituisco un placeholder botanico di alta qualità.");
    return getUnsplashPlaceholder();
  }
}

/**
 * Helper to select a beautiful nature/love photo as fallback
 */
function getUnsplashPlaceholder(): string {
  const placeholders = [
    "https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1501004318641-724e63f7664c?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&q=80&w=800"
  ];
  const url = placeholders[Math.floor(Math.random() * placeholders.length)];
  window.dispatchEvent(new CustomEvent("system_generated_link", { detail: { url } }));
  return url;
}
