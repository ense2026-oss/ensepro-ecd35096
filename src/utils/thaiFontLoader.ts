/* ───────────── Thai Font Loader for jsPDF ───────────── */
import jsPDF from "jspdf";

// Import font files as URLs (Vite handles this)
import THSarabunNewUrl from "@/assets/fonts/THSarabunNew.ttf";
import THSarabunNewBoldUrl from "@/assets/fonts/THSarabunNew-Bold.ttf";

let fontsLoaded = false;

async function loadFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Register THSarabunNew fonts with jsPDF (call once, cached) */
export async function registerThaiFont(doc: jsPDF): Promise<void> {
  const [normalBase64, boldBase64] = await Promise.all([
    loadFontAsBase64(THSarabunNewUrl),
    loadFontAsBase64(THSarabunNewBoldUrl),
  ]);

  doc.addFileToVFS("THSarabunNew.ttf", normalBase64);
  doc.addFont("THSarabunNew.ttf", "THSarabunNew", "normal");

  doc.addFileToVFS("THSarabunNew-Bold.ttf", boldBase64);
  doc.addFont("THSarabunNew-Bold.ttf", "THSarabunNew", "bold");

  doc.setFont("THSarabunNew", "normal");
}
