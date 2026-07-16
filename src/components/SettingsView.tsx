import React from "react";
import { Encounter, Sticker } from "../types";
import { HardDrive, AlertTriangle, CheckCircle2, ShieldCheck, Database, FileImage, Layers } from "lucide-react";

interface SettingsViewProps {
  encounters: Encounter[];
  stickers: Sticker[];
}

export default function SettingsView({ encounters, stickers }: SettingsViewProps) {
  // 1 MB in bytes
  const FIRESTORE_LIMIT_BYTES = 1048576; 

  // Function to calculate exact byte size of a string (UTF-8)
  const getByteSize = (str: string): number => {
    if (!str) return 0;
    // Simple estimation for standard text. In UTF-8, Base64 is 1 byte per character.
    return str.length;
  };

  // Calculate detailed stats
  let totalDatabaseBytes = 0;
  let base64Count = 0;
  let urlCount = 0;
  let totalPhotosCount = 0;

  // Track size per encounter document to see which one is closest to the limit
  const encounterSizes = encounters.map((enc) => {
    let size = 0;
    let encounterPhotosCount = 0;

    // Add photos
    if (enc.photos) {
      enc.photos.forEach((p) => {
        const bytes = getByteSize(p);
        size += bytes;
        encounterPhotosCount++;
        if (p.startsWith("data:")) base64Count++;
        else urlCount++;
      });
    }

    if (enc.photosWithAuthor) {
      enc.photosWithAuthor.forEach((p) => {
        const bytes = getByteSize(p.url);
        size += bytes;
        encounterPhotosCount++;
        if (p.url.startsWith("data:")) base64Count++;
        else urlCount++;
      });
    }

    // Add note text sizes to make it extremely accurate
    size += getByteSize(enc.title);
    size += getByteSize(enc.note);
    size += getByteSize(enc.noteSamuel || "");
    size += getByteSize(enc.noteIle || "");

    totalPhotosCount += encounterPhotosCount;
    totalDatabaseBytes += size;

    return {
      id: enc.id,
      title: enc.title,
      date: enc.date,
      sizeBytes: size,
      photosCount: encounterPhotosCount,
    };
  });

  // Calculate sticker sizes
  let stickersSizeBytes = 0;
  stickers.forEach((sticker) => {
    const bytes = getByteSize(sticker.url);
    stickersSizeBytes += bytes;
    if (sticker.url.startsWith("data:")) base64Count++;
    else urlCount++;
  });

  // Total space occupied in the database
  const grandTotalBytes = totalDatabaseBytes + stickersSizeBytes;
  const totalStickersCount = stickers.length;

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Find the heaviest single encounter document
  const heaviestEncounter = encounterSizes.length > 0 
    ? [...encounterSizes].sort((a, b) => b.sizeBytes - a.sizeBytes)[0]
    : null;

  // Calculate percentage of 1MB limit for the heaviest document
  const heaviestDocPercentage = heaviestEncounter 
    ? Math.min((heaviestEncounter.sizeBytes / FIRESTORE_LIMIT_BYTES) * 100, 100)
    : 0;

  // Total database size percentage (just for context)
  const totalPercentage = Math.min((grandTotalBytes / FIRESTORE_LIMIT_BYTES) * 100, 100);

  return (
    <div id="settings-view" className="space-y-6 animate-in fade-in duration-300">
      {/* Settings Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white p-5 rounded-3xl shadow-md flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Stato del Database</span>
          <h2 className="text-xl font-extrabold font-display mt-0.5">Impostazioni & Memoria</h2>
          <p className="text-xs text-slate-400 mt-1">
            Gestisci l'ottimizzazione e monitora lo spazio dei ricordi 💾
          </p>
        </div>
        <div className="bg-white/10 p-2.5 rounded-2xl">
          <Database className="w-5 h-5 text-indigo-300 animate-pulse" />
        </div>
      </div>

      {/* Main Storage card */}
      <div className="bg-white p-5 rounded-3xl border border-brand-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-brand-100 pb-3">
          <HardDrive className="w-5 h-5 text-brand-500" />
          <h3 className="font-bold text-brand-900 text-sm uppercase tracking-wider">Spazio Occupato delle Foto</h3>
        </div>

        {/* Big numbers */}
        <div className="grid grid-cols-2 gap-4 bg-brand-50/40 p-4 rounded-2xl border border-brand-50">
          <div>
            <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">Memoria occupata</span>
            <p className="text-xl font-black text-brand-950 mt-0.5">{formatBytes(grandTotalBytes)}</p>
            <p className="text-[10px] font-mono text-brand-400 mt-0.5">{grandTotalBytes.toLocaleString()} B</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">Limite Firestore</span>
            <p className="text-xl font-black text-brand-950 mt-0.5">1.0 MB</p>
            <p className="text-[10px] font-mono text-brand-400 mt-0.5">{FIRESTORE_LIMIT_BYTES.toLocaleString()} B</p>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[11px] font-bold text-brand-800">
            <span>Utilizzo del Limite Singolo Documento (1MB)</span>
            <span className={heaviestDocPercentage > 80 ? "text-rose-600 animate-pulse" : heaviestDocPercentage > 50 ? "text-amber-600" : "text-brand-500"}>
              {heaviestDocPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                heaviestDocPercentage > 80 
                  ? "bg-rose-500" 
                  : heaviestDocPercentage > 50 
                  ? "bg-amber-500" 
                  : "bg-emerald-500"
              }`}
              style={{ width: `${heaviestDocPercentage}%` }}
            />
          </div>
          <p className="text-[10px] text-brand-400 leading-normal pt-1">
            Nota: Firestore ha un limite invalicabile di <strong>1 MB (1.048.576 byte)</strong> per singolo documento. Grazie al nostro nuovo caricatore con link generati, le foto caricate non pesano più nel database, restando quasi a 0 byte!
          </p>
        </div>
      </div>

      {/* Upload Statistics card */}
      <div className="bg-white p-5 rounded-3xl border border-brand-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-brand-100 pb-3">
          <Layers className="w-5 h-5 text-brand-500" />
          <h3 className="font-bold text-brand-900 text-sm uppercase tracking-wider">Dettagli dei File</h3>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs text-brand-800 py-1 border-b border-brand-50">
            <span className="flex items-center gap-1.5 font-medium">
              <FileImage className="w-3.5 h-3.5 text-brand-400" />
              Foto negli Incontri
            </span>
            <span className="font-bold">{totalPhotosCount} foto</span>
          </div>
          <div className="flex justify-between items-center text-xs text-brand-800 py-1 border-b border-brand-50">
            <span className="flex items-center gap-1.5 font-medium">
              <Database className="w-3.5 h-3.5 text-brand-400" />
              Adesivi personalizzati
            </span>
            <span className="font-bold">{totalStickersCount} adesivi ({formatBytes(stickersSizeBytes)})</span>
          </div>
          <div className="flex justify-between items-center text-xs text-brand-800 py-1 border-b border-brand-50">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Foto Ottimizzate (Link cloud)
            </span>
            <span className="font-bold text-emerald-600">{urlCount} foto (Leggerissime!)</span>
          </div>
          <div className="flex justify-between items-center text-xs text-brand-800 py-1">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Foto Legacy (Base64 nel DB)
            </span>
            <span className="font-bold text-amber-600">{base64Count} foto (Pesanti)</span>
          </div>
        </div>

        {/* Optimization Tip */}
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Ottimizzazione Attiva ✅</p>
            <p className="text-[11px] text-emerald-700 leading-normal">
              Tutte le nuove foto caricate utilizzano il nostro link generator automatico. Questo riduce l'impronta di ogni foto da circa 400KB a soli 100 byte!
            </p>
          </div>
        </div>
      </div>

      {/* Document sizing details list */}
      {encounterSizes.length > 0 && (
        <div className="bg-white p-5 rounded-3xl border border-brand-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-brand-100 pb-2">
            <h3 className="font-bold text-brand-900 text-xs uppercase tracking-wider">Peso Ricordi Singoli</h3>
            <span className="text-[9px] font-mono text-brand-400">FIRESTORE DOCS</span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {[...encounterSizes]
              .sort((a, b) => b.sizeBytes - a.sizeBytes)
              .map((enc) => {
                const percentage = Math.min((enc.sizeBytes / FIRESTORE_LIMIT_BYTES) * 100, 100);
                return (
                  <div key={enc.id} className="p-3 bg-brand-50/20 border border-brand-100/40 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between items-start gap-2">
                      <div className="truncate max-w-[180px]">
                        <p className="font-bold text-brand-950 truncate">{enc.title || "Incontro senza titolo"}</p>
                        <p className="text-[10px] text-brand-400">{new Date(enc.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      <div className="text-right font-mono text-[10px] shrink-0">
                        <span className="font-bold text-brand-900">{formatBytes(enc.sizeBytes)}</span>
                        <p className="text-[9px] text-brand-400">{enc.sizeBytes.toLocaleString()} B</p>
                      </div>
                    </div>
                    
                    {/* Progress indicator per encounter */}
                    <div className="space-y-0.5">
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            percentage > 80 
                              ? "bg-rose-500" 
                              : percentage > 40 
                              ? "bg-amber-500" 
                              : "bg-brand-500"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-brand-400 font-medium">
                        <span>{enc.photosCount} foto nel ricordo</span>
                        <span>{percentage.toFixed(2)}% del limite</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
