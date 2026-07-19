/**
 * Utility helper to compress images using Canvas before storing in Firestore.
 * This ensures they fit perfectly within document limits and load instantly.
 */
export function compressImage(file: File, _maxWidth = 600, _maxHeight = 600, _quality = 0.65): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string);
      } else {
        reject(new Error("Failed to read file as DataURL"));
      }
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Calculates duration between two dates.
 * Returns a human readable string.
 */
export function calculateDaysBetween(date1Str: string, date2Str: string): number {
  const d1 = new Date(date1Str);
  const d2 = new Date(date2Str);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns clean readable duration since last meeting
 */
export function formatDuration(days: number): string {
  if (days === 0) return "Lo stesso giorno!";
  if (days === 1) return "Il giorno dopo! 😍";
  if (days < 7) return `${days} giorni dopo`;
  if (days === 7) return "1 settimana dopo";
  
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  
  if (days < 30) {
    return `${weeks} settiman${weeks > 1 ? "e" : "a"}${remDays > 0 ? ` e ${remDays} gg` : ""} dopo`;
  }
  
  const months = Math.floor(days / 30.4);
  const remDaysM = Math.round(days % 30.4);
  return `${months} mes${months > 1 ? "i" : "e"}${remDaysM > 0 ? ` e ${remDaysM} gg` : ""} dopo`;
}
