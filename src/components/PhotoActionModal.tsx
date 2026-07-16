import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Trash2, ArrowLeftRight, RefreshCw, Move, FileImage, Calendar, ChevronRight, HelpCircle, Loader2, ChevronLeft } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { Encounter, EncounterPhoto } from "../types";
import { compressImage } from "../utils/imageCompressor";
import { uploadImageToStorage } from "../utils/imageUploader";

interface PhotoActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string;
  photoAuthor: string;
  encounter: Encounter;
  allEncounters: Encounter[];
  currentUser: string;
}

export default function PhotoActionModal({
  isOpen,
  onClose,
  photoUrl,
  photoAuthor,
  encounter: initialEncounter,
  allEncounters,
  currentUser,
}: PhotoActionModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionStep, setActionStep] = useState<"menu" | "move_encounter" | "swap_select">("menu");
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(photoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Resolve the live encounter dynamically from allEncounters to get real-time state updates!
  const encounter = allEncounters.find((e) => e.id === initialEncounter.id) || initialEncounter;

  // Extract photos list reactively
  const getPhotoLists = () => {
    const listWithAuthor = encounter.photosWithAuthor || [];
    const listLegacy = encounter.photos || [];
    
    // Create a unified list of photos for display & interactive reordering
    let unifiedPhotos: { url: string; uploadedBy: string }[] = [];
    if (listWithAuthor.length > 0) {
      unifiedPhotos = listWithAuthor.map((p) => ({ url: p.url, uploadedBy: p.uploadedBy }));
    } else {
      unifiedPhotos = listLegacy.map((url) => ({ url, uploadedBy: "Samuel" }));
    }

    return { listWithAuthor, listLegacy, unifiedPhotos };
  };

  const { listWithAuthor, listLegacy, unifiedPhotos } = getPhotoLists();

  // Find index of currently managed photo
  const currentPhotoIdx = unifiedPhotos.findIndex((p) => p.url === currentPhotoUrl);
  const activePhoto = unifiedPhotos[currentPhotoIdx] || { url: currentPhotoUrl, uploadedBy: photoAuthor };

  // 1. DELETE PHOTO
  const handleDelete = async () => {
    if (!window.confirm("Sei sicuro di voler eliminare definitivamente questa foto da questo ricordo?")) return;
    setIsProcessing(true);

    try {
      const encounterRef = doc(db, "meetings", encounter.id);

      if (encounter.photosWithAuthor && encounter.photosWithAuthor.length > 0) {
        const updated = encounter.photosWithAuthor.filter((p) => p.url !== currentPhotoUrl);
        await updateDoc(encounterRef, { photosWithAuthor: updated })
          .catch((err) => handleFirestoreError(err, OperationType.UPDATE, `meetings/${encounter.id}`));
        
        // If other photos exist, switch active photo, otherwise close
        if (updated.length > 0) {
          setCurrentPhotoUrl(updated[0].url);
        } else {
          onClose();
        }
      } else {
        const updated = (encounter.photos || []).filter((url) => url !== currentPhotoUrl);
        await updateDoc(encounterRef, { photos: updated })
          .catch((err) => handleFirestoreError(err, OperationType.UPDATE, `meetings/${encounter.id}`));

        if (updated.length > 0) {
          setCurrentPhotoUrl(updated[0]);
        } else {
          onClose();
        }
      }
    } catch (err) {
      console.error("Failed to delete photo:", err);
      alert("Errore durante l'eliminazione della foto.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. REPLACE PHOTO (TRIGGER FILE SELECTOR)
  const handleReplaceClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsProcessing(true);

    try {
      const file = files[0];
      // Compress new image
      const compressedBase64 = await compressImage(file, 600, 600, 0.7);
      // Upload
      const folderPath = `meetings/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const finalUrl = await uploadImageToStorage(compressedBase64, folderPath);

      const encounterRef = doc(db, "meetings", encounter.id);

      if (encounter.photosWithAuthor && encounter.photosWithAuthor.length > 0) {
        const updated = [...encounter.photosWithAuthor];
        if (currentPhotoIdx !== -1) {
          updated[currentPhotoIdx] = {
            url: finalUrl,
            uploadedBy: currentUser,
          };
        } else {
          updated.push({ url: finalUrl, uploadedBy: currentUser });
        }
        await updateDoc(encounterRef, { photosWithAuthor: updated })
          .catch((err) => handleFirestoreError(err, OperationType.UPDATE, `meetings/${encounter.id}`));
      } else {
        const updated = [...(encounter.photos || [])];
        if (currentPhotoIdx !== -1) {
          updated[currentPhotoIdx] = finalUrl;
        } else {
          updated.push(finalUrl);
        }
        await updateDoc(encounterRef, { photos: updated })
          .catch((err) => handleFirestoreError(err, OperationType.UPDATE, `meetings/${encounter.id}`));
      }

      // Switch active photo to the new one!
      setCurrentPhotoUrl(finalUrl);
    } catch (err) {
      console.error("Failed to replace photo:", err);
      alert("Errore durante la sostituzione della foto.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 3. REORDER / MOVE LEFT OR RIGHT IN ARRAY (STAYS OPEN FOR CONTINUOUS INTERACTION)
  const handleReorder = async (direction: "left" | "right") => {
    if (currentPhotoIdx === -1) return;
    const targetIdx = direction === "left" ? currentPhotoIdx - 1 : currentPhotoIdx + 1;
    
    if (targetIdx < 0 || targetIdx >= unifiedPhotos.length) return;

    setIsProcessing(true);
    try {
      const encounterRef = doc(db, "meetings", encounter.id);

      if (encounter.photosWithAuthor && encounter.photosWithAuthor.length > 0) {
        const reordered = [...encounter.photosWithAuthor];
        const temp = reordered[currentPhotoIdx];
        reordered[currentPhotoIdx] = reordered[targetIdx];
        reordered[targetIdx] = temp;

        await updateDoc(encounterRef, { photosWithAuthor: reordered })
          .catch((err) => handleFirestoreError(err, OperationType.UPDATE, `meetings/${encounter.id}`));
      } else {
        const reordered = [...(encounter.photos || [])];
        const temp = reordered[currentPhotoIdx];
        reordered[currentPhotoIdx] = reordered[targetIdx];
        reordered[targetIdx] = temp;

        await updateDoc(encounterRef, { photos: reordered })
          .catch((err) => handleFirestoreError(err, OperationType.UPDATE, `meetings/${encounter.id}`));
      }
      
      // Do NOT close! The real-time listener will update the list on-screen immediately.
    } catch (err) {
      console.error("Failed to reorder photo:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. MOVE TO A DIFFERENT ENCOUNTER (CROSS-DOCUMENT MOVE)
  const handleMoveToEncounter = async (targetEncounter: Encounter) => {
    if (targetEncounter.id === encounter.id) return;
    setIsProcessing(true);

    try {
      // Step 1: Remove from current encounter
      const sourceWithAuthor = encounter.photosWithAuthor || [];
      const sourceLegacy = encounter.photos || [];

      const updatedSourceWithAuthor = sourceWithAuthor.filter((p) => p.url !== currentPhotoUrl);
      const updatedSourceLegacy = sourceLegacy.filter((url) => url !== currentPhotoUrl);

      // Step 2: Append to target encounter
      const targetWithAuthor = targetEncounter.photosWithAuthor || [];
      const targetLegacy = targetEncounter.photos || [];

      const movingPhoto: EncounterPhoto = {
        url: currentPhotoUrl,
        uploadedBy: activePhoto.uploadedBy,
      };

      const updatedTargetWithAuthor = [...targetWithAuthor, movingPhoto];
      const updatedTargetLegacy = [...targetLegacy, currentPhotoUrl];

      // Perform updates using a Firestore Batch to guarantee atomic execution!
      const batch = writeBatch(db);
      
      const sourceRef = doc(db, "meetings", encounter.id);
      batch.update(sourceRef, {
        photosWithAuthor: updatedSourceWithAuthor,
        photos: updatedSourceLegacy,
      });

      const targetRef = doc(db, "meetings", targetEncounter.id);
      batch.update(targetRef, {
        photosWithAuthor: updatedTargetWithAuthor,
        photos: updatedTargetLegacy,
      });

      await batch.commit();
      
      // If the current encounter still has photos left, select the first one, otherwise close
      if (updatedSourceWithAuthor.length > 0) {
        setCurrentPhotoUrl(updatedSourceWithAuthor[0].url);
        setActionStep("menu");
      } else if (updatedSourceLegacy.length > 0) {
        setCurrentPhotoUrl(updatedSourceLegacy[0]);
        setActionStep("menu");
      } else {
        onClose();
      }
    } catch (err) {
      console.error("Failed to move photo across encounters:", err);
      alert("Errore durante lo spostamento della foto.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwapPhotos = async (url1: string, url2: string) => {
    setIsProcessing(true);
    try {
      const encounterRef = doc(db, "meetings", encounter.id);

      if (encounter.photosWithAuthor && encounter.photosWithAuthor.length > 0) {
        const updated = [...encounter.photosWithAuthor];
        const idx1 = updated.findIndex((p) => p.url === url1);
        const idx2 = updated.findIndex((p) => p.url === url2);

        if (idx1 !== -1 && idx2 !== -1) {
          const temp = updated[idx1];
          updated[idx1] = updated[idx2];
          updated[idx2] = temp;

          await updateDoc(encounterRef, { photosWithAuthor: updated })
            .catch((err) => handleFirestoreError(err, OperationType.UPDATE, `meetings/${encounter.id}`));
        }
      } else {
        const updated = [...(encounter.photos || [])];
        const idx1 = updated.indexOf(url1);
        const idx2 = updated.indexOf(url2);

        if (idx1 !== -1 && idx2 !== -1) {
          const temp = updated[idx1];
          updated[idx1] = updated[idx2];
          updated[idx2] = temp;

          await updateDoc(encounterRef, { photos: updated })
            .catch((err) => handleFirestoreError(err, OperationType.UPDATE, `meetings/${encounter.id}`));
        }
      }
    } catch (err) {
      console.error("Failed to swap photos:", err);
      alert("Errore durante lo scambio di posizione delle foto.");
    } finally {
      setIsProcessing(false);
    }
  };

  const otherEncounters = allEncounters.filter((e) => e.id !== encounter.id);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-brand-100 flex items-center justify-between bg-brand-50/50">
          <div className="flex items-center gap-1.5">
            <FileImage className="w-4 h-4 text-brand-500" />
            <h4 className="font-extrabold text-brand-900 text-xs uppercase tracking-wider">
              {actionStep === "menu" 
                ? "Gestione Foto Ricordo" 
                : actionStep === "move_encounter"
                ? "Sposta in un altro ricordo"
                : "Scambia posizione foto"}
            </h4>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-brand-100 text-brand-400 hover:text-brand-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isProcessing ? (
          <div className="p-10 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <p className="text-xs text-brand-500 font-bold uppercase tracking-wider">Applicazione modifiche...</p>
          </div>
        ) : actionStep === "menu" ? (
          <div className="p-5 space-y-4">
            {/* 1. INTERACTIVE MINI-GALLERY / PHOTO STRIP */}
            {unifiedPhotos.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">
                    Foto del ricordo ({unifiedPhotos.length})
                  </p>
                  <span className="text-[9px] font-mono text-brand-400">
                    Seleziona una foto per gestirla
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 pt-1.5 scrollbar-none snap-x max-w-full">
                  {unifiedPhotos.map((photo, idx) => {
                    const isActive = photo.url === currentPhotoUrl;
                    const isSamuel = photo.uploadedBy === "Samuel";
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCurrentPhotoUrl(photo.url);
                        }}
                        className={`relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition active:scale-95 snap-center ${
                          isActive
                            ? isSamuel
                              ? "border-sky-500 ring-2 ring-sky-100"
                              : "border-rose-500 ring-2 ring-rose-100"
                            : "border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <img src={photo.url} alt={`Photo ${idx}`} className="w-full h-full object-cover" />
                        {isActive && (
                          <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                            <div className="bg-white rounded-full p-0.5 shadow-sm">
                              <div className={`w-1.5 h-1.5 rounded-full ${isSamuel ? "bg-sky-500" : "bg-rose-500"}`} />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. ENHANCED ACTIVE PHOTO CAROUSEL BOX (WITH SWAPPING CONTROLS IN REALTIME) */}
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-brand-100/60 bg-slate-50 flex items-center justify-center shadow-inner group">
              <img src={currentPhotoUrl} alt="Selected preview" className="max-w-full max-h-full object-contain" />
              
              {/* Overlay arrows inside the preview box for super direct, natural reordering! */}
              {unifiedPhotos.length > 1 && (
                <div className="absolute inset-x-2 bottom-2 flex justify-between pointer-events-none">
                  <button
                    type="button"
                    disabled={currentPhotoIdx <= 0}
                    onClick={() => handleReorder("left")}
                    className="p-1.5 bg-black/75 hover:bg-black/85 disabled:opacity-30 disabled:pointer-events-none text-white rounded-full active:scale-90 transition pointer-events-auto shadow-md"
                    title="Sposta a sinistra"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={currentPhotoIdx === -1 || currentPhotoIdx >= unifiedPhotos.length - 1}
                    onClick={() => handleReorder("right")}
                    className="p-1.5 bg-black/75 hover:bg-black/85 disabled:opacity-30 disabled:pointer-events-none text-white rounded-full active:scale-90 transition pointer-events-auto shadow-md"
                    title="Sposta a destra"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Uploaded by small badge */}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                Caricata da: {activePhoto.uploadedBy === "Samuel" ? "Samuel 👦" : "Ile 👧"}
              </div>

              {/* Carousel Position Badge */}
              {currentPhotoIdx !== -1 && (
                <div className="absolute top-2 right-2 bg-brand-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                  {currentPhotoIdx + 1} / {unifiedPhotos.length}
                </div>
              )}
            </div>

            {/* 3. REORDER FEEDBACK TEXT */}
            {unifiedPhotos.length > 1 && (
              <p className="text-[10px] text-brand-400 text-center font-medium">
                Usa le freccette ◀ ▶ sull'immagine per spostarla nell'ordine del ricordo!
              </p>
            )}

            {/* Actions List */}
            <div className="space-y-2 pt-1">
              {/* REPLACE BUTTON */}
              <button
                type="button"
                onClick={handleReplaceClick}
                className="w-full p-3 bg-brand-50 hover:bg-brand-100/80 text-brand-900 hover:text-brand-950 rounded-2xl text-xs font-bold flex items-center justify-between border border-brand-100/50 active:scale-[0.99] transition text-left"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-brand-500" />
                  Sostituisci Foto Selezionata 📸
                </span>
                <ChevronRight className="w-4 h-4 text-brand-400" />
              </button>

              {/* SWAP POSITION BUTTON */}
              {unifiedPhotos.length > 1 && (
                <button
                  type="button"
                  onClick={() => setActionStep("swap_select")}
                  className="w-full p-3 bg-brand-50 hover:bg-brand-100/80 text-brand-900 hover:text-brand-950 rounded-2xl text-xs font-bold flex items-center justify-between border border-brand-100/50 active:scale-[0.99] transition text-left"
                >
                  <span className="flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-brand-500" />
                    Scambia di posto con un'altra foto 🔄
                  </span>
                  <ChevronRight className="w-4 h-4 text-brand-400" />
                </button>
              )}

              {/* MOVE CROSS-ENCOUNTER BUTTON */}
              <button
                type="button"
                onClick={() => setActionStep("move_encounter")}
                className="w-full p-3 bg-brand-50 hover:bg-brand-100/80 text-brand-900 hover:text-brand-950 rounded-2xl text-xs font-bold flex items-center justify-between border border-brand-100/50 active:scale-[0.99] transition text-left"
              >
                <span className="flex items-center gap-2">
                  <Move className="w-4 h-4 text-brand-500" />
                  Sposta questa foto in un altro ricordo 📂
                </span>
                <ChevronRight className="w-4 h-4 text-brand-400" />
              </button>

              {/* DELETE BUTTON */}
              <button
                type="button"
                onClick={handleDelete}
                className="w-full p-3 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 rounded-2xl text-xs font-extrabold flex items-center justify-between border border-rose-100 active:scale-[0.99] transition text-left mt-1"
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  Elimina Foto Selezionata 🗑️
                </span>
                <ChevronRight className="w-4 h-4 text-rose-400" />
              </button>
            </div>

            {/* Tip */}
            <div className="flex items-center gap-1 text-[9px] text-brand-400 justify-center">
              <HelpCircle className="w-3 h-3 shrink-0" />
              <span>Ora puoi riordinare e scambiare le foto all'infinito senza chiudere!</span>
            </div>

            {/* Hidden Input File for replacing */}
            <input 
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        ) : actionStep === "swap_select" ? (
          /* Swap positions (Rullino) step */
          <div className="p-5 space-y-4 animate-in fade-in slide-in-from-right-5 duration-200">
            <button
              onClick={() => setActionStep("menu")}
              className="text-xs font-bold text-brand-500 hover:text-brand-700 flex items-center gap-1 mb-1 active:scale-95 transition text-left"
            >
              ← Torna indietro
            </button>

            <div className="bg-amber-50/75 border border-amber-100 rounded-2xl p-3 flex items-start gap-2 text-amber-950 text-xs">
              <span className="text-base shrink-0 mt-0.5">🔄</span>
              <div className="space-y-0.5">
                <p className="font-extrabold text-amber-900">Scegli la foto di scambio</p>
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  Clicca su una delle foto nel rullino qui sotto per scambiarla di posto con la foto attiva.
                </p>
              </div>
            </div>

            {/* Currently selected photo preview */}
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Foto corrente (Attiva)</p>
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                <img src={currentPhotoUrl} alt="Active photo" className="max-h-full max-w-full object-contain" />
                <div className="absolute top-2 left-2 bg-amber-500 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  Attiva
                </div>
              </div>
            </div>

            {/* Filmstrip Roll / Grid of other photos */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-brand-500 uppercase tracking-wider">
                Rullino delle altre foto ({unifiedPhotos.length - 1})
              </p>
              
              <div className="grid grid-cols-3 gap-2.5 max-h-[170px] overflow-y-auto p-2 bg-slate-50 border border-slate-200/60 rounded-2xl">
                {unifiedPhotos.map((photo, idx) => {
                  const isSelf = photo.url === currentPhotoUrl;
                  const isSamuel = photo.uploadedBy === "Samuel";
                  if (isSelf) return null; // Only show other photos to swap with!
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={async () => {
                        await handleSwapPhotos(currentPhotoUrl, photo.url);
                        setActionStep("menu");
                      }}
                      className="group relative aspect-square rounded-xl overflow-hidden border-2 border-slate-200/80 hover:border-amber-400 active:scale-95 transition bg-white shadow-sm flex flex-col"
                    >
                      <img src={photo.url} alt={`Other photo ${idx}`} className="w-full h-full object-cover" />
                      
                      {/* Hover Overlay with swap icon */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <ArrowLeftRight className="w-5 h-5 text-white animate-pulse" />
                      </div>

                      {/* Upload author label */}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5 text-center text-[8px] text-white font-medium truncate px-1">
                        {isSamuel ? "Samuel 👦" : "Ile 👧"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Move across encounters step */
          <div className="p-5 space-y-3">
            <button
              onClick={() => setActionStep("menu")}
              className="text-xs font-bold text-brand-500 hover:text-brand-700 flex items-center gap-1 mb-2 active:scale-95 transition text-left"
            >
              ← Torna al riordino
            </button>

            <p className="text-xs text-brand-500 mb-2">Seleziona a quale incontro spostare questa foto:</p>

            {otherEncounters.length === 0 ? (
              <p className="text-xs text-brand-400 italic text-center py-4">Nessun altro incontro disponibile.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {otherEncounters.map((enc) => (
                  <button
                    key={enc.id}
                    onClick={() => handleMoveToEncounter(enc)}
                    className="w-full p-3 bg-brand-50/50 hover:bg-brand-50 text-left rounded-xl border border-brand-100 hover:border-brand-300 transition text-xs flex items-center justify-between"
                  >
                    <div className="truncate max-w-[200px]">
                      <p className="font-bold text-brand-900 truncate">{enc.title || "Incontro senza titolo"}</p>
                      <span className="text-[10px] text-brand-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(enc.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-brand-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
