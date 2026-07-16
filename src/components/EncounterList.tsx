import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Encounter, Sticker } from "../types";
import { calculateDaysBetween, formatDuration } from "../utils/imageCompressor";
import { Calendar, Trash2, Edit2, Heart, MessageSquare, ChevronLeft, ChevronRight, Image as ImageIcon, Eye, Sparkles, X, Smile, Plus, Upload, Link2, ExternalLink, Settings } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, updateDoc, addDoc, deleteDoc, collection } from "firebase/firestore";
import { compressImage } from "../utils/imageCompressor";
import { uploadImageToStorage } from "../utils/imageUploader";
import PhotoActionModal from "./PhotoActionModal";

interface EncounterListProps {
  encounters: Encounter[];
  stickers?: Sticker[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (encounter: Encounter) => void;
  currentUser: string;
}

export default function EncounterList({ encounters, stickers = [], onDelete, onEdit, currentUser }: EncounterListProps) {
  const [lightboxPhotos, setLightboxPhotos] = useState<{ url: string; uploadedBy: string; encounter?: Encounter }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  // States for managing photo (replaces long-press modal popup)
  const [selectedPhotoToManage, setSelectedPhotoToManage] = useState<{
    url: string;
    uploadedBy: string;
    encounter: Encounter;
  } | null>(null);

  // Custom Sticker Gallery states
  const [isStickerGalleryOpen, setIsStickerGalleryOpen] = useState(false);
  const [isUploaderExpanded, setIsUploaderExpanded] = useState(false);
  const [stickerFilter, setStickerFilter] = useState<string>("all");
  const [isUploadingSticker, setIsUploadingSticker] = useState(false);
  const [uploadStickerTitle, setUploadStickerTitle] = useState("");
  const [uploadStickerMeetingIds, setUploadStickerMeetingIds] = useState<string[]>([]);
  const [selectedDetailSticker, setSelectedDetailSticker] = useState<Sticker | null>(null);
  const [isLinkingOpen, setIsLinkingOpen] = useState(false); // To toggle linking drawer for selected sticker
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: "encounter" | "sticker";
    id: string;
    title: string;
  } | null>(null);

  const handleUploadSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingSticker(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedBase64 = await compressImage(file, 400, 400, 0.7);
        const folderPath = `stickers/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
        const finalUrl = await uploadImageToStorage(compressedBase64, folderPath);
        
        const fileTitle = files.length === 1
          ? (uploadStickerTitle.trim() || file.name.split(".")[0] || "Adesivo ricordo")
          : (uploadStickerTitle.trim() 
              ? `${uploadStickerTitle.trim()} (${i + 1})` 
              : (file.name.split(".")[0] || `Adesivo ricordo ${i + 1}`));

        await addDoc(collection(db, "stickers"), {
          url: finalUrl,
          title: fileTitle,
          uploadedBy: currentUser,
          associatedMeetingIds: uploadStickerMeetingIds,
          createdAt: new Date().toISOString(),
        }).catch((err) => handleFirestoreError(err, OperationType.CREATE, "stickers"));
      }

      // Reset
      setUploadStickerTitle("");
      setUploadStickerMeetingIds([]);
      setIsUploaderExpanded(false);
    } catch (error) {
      console.error("Errore nel caricamento degli adesivi:", error);
    } finally {
      setIsUploadingSticker(false);
    }
  };

  const handleDeleteSticker = (stickerId: string, title: string) => {
    setDeleteConfirmation({
      type: "sticker",
      id: stickerId,
      title: title,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;

    try {
      if (deleteConfirmation.type === "sticker") {
        await deleteDoc(doc(db, "stickers", deleteConfirmation.id)).catch((err) => handleFirestoreError(err, OperationType.DELETE, `stickers/${deleteConfirmation.id}`));
        setSelectedDetailSticker(null);
        setIsLinkingOpen(false);
      } else if (deleteConfirmation.type === "encounter") {
        await onDelete(deleteConfirmation.id);
      }
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
    } finally {
      setDeleteConfirmation(null);
    }
  };

  const handleToggleStickerAssociation = async (sticker: Sticker, meetingId: string) => {
    const currentAssociations = sticker.associatedMeetingIds || [];
    let newAssociations: string[];

    if (currentAssociations.includes(meetingId)) {
      newAssociations = currentAssociations.filter((id) => id !== meetingId);
    } else {
      newAssociations = [...currentAssociations, meetingId];
    }

    try {
      const stickerRef = doc(db, "stickers", sticker.id);
      await updateDoc(stickerRef, {
        associatedMeetingIds: newAssociations,
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `stickers/${sticker.id}`));

      // Update local detailed sticker view state if open
      if (selectedDetailSticker && selectedDetailSticker.id === sticker.id) {
        setSelectedDetailSticker({
          ...selectedDetailSticker,
          associatedMeetingIds: newAssociations,
        });
      }
    } catch (error) {
      console.error("Errore durante l'aggiornamento dell'associazione:", error);
    }
  };

  const handleNext = () => {
    if (lightboxIndex !== null && lightboxPhotos.length > 0) {
      setLightboxIndex((prev) => (prev! + 1) % lightboxPhotos.length);
    }
  };

  const handlePrev = () => {
    if (lightboxIndex !== null && lightboxPhotos.length > 0) {
      setLightboxIndex((prev) => (prev! - 1 + lightboxPhotos.length) % lightboxPhotos.length);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const diffX = touchStartX - touchEndX;
    const swipeThreshold = 50;

    if (diffX > swipeThreshold) {
      handleNext();
    } else if (diffX < -swipeThreshold) {
      handlePrev();
    }

    setTouchStartX(null);
    setTouchEndX(null);
  };

  // Close lightbox on Escape key and support arrows
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, lightboxPhotos.length]);

  // 1. Sort encounters chronologically ASCENDING to calculate absolute encounter numbers and durations
  const sortedChronological = [...encounters].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Create lookup for metadata: index (1-based) and days elapsed from previous
  const encounterMeta = new Map<
    string,
    { index: number; daysSincePrevious: number | null; formattedDays: string | null }
  >();

  sortedChronological.forEach((enc, idx) => {
    let daysSincePrevious: number | null = null;
    let formattedDays: string | null = null;

    if (idx > 0) {
      const prevEnc = sortedChronological[idx - 1];
      daysSincePrevious = calculateDaysBetween(prevEnc.date, enc.date);
      formattedDays = formatDuration(daysSincePrevious);
    }

    encounterMeta.set(enc.id, {
      index: idx + 1,
      daysSincePrevious,
      formattedDays,
    });
  });

  // 2. Render encounters sorted DESCENDING (most recent first) for a stream/diary experience
  const sortedRecent = [...encounters].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("it-IT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (encounters.length === 0) {
    return (
      <div id="empty-encounters" className="text-center py-16 px-4 bg-white rounded-3xl border border-brand-100 shadow-sm space-y-4">
        <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto text-brand-400">
          <Heart className="w-8 h-8 stroke-1 animate-pulse fill-brand-100" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-brand-900 text-lg">Nessun incontro registrato</h3>
          <p className="text-sm text-brand-500 max-w-xs mx-auto">
            Registrate il vostro primo incontro insieme toccando il tasto <strong className="text-brand-600">Nuovo</strong> in basso!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic count summary widget */}
      <div className="bg-gradient-to-br from-brand-500 to-sky-400 text-white p-5 rounded-3xl shadow-lg shadow-brand-200 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-sky-100">Il vostro legame</span>
          <h2 className="text-2xl font-black font-display mt-0.5">
            {encounters.length} Incontr{encounters.length === 1 ? "o" : "i"}
          </h2>
          <p className="text-xs text-sky-50/90 mt-1">
            Ogni momento passato insieme è un tesoro 💙
          </p>
        </div>
        <div className="bg-white/15 p-3 rounded-2xl border border-white/10 backdrop-blur-sm flex flex-col items-center">
          <Sparkles className="w-6 h-6 text-yellow-200 mb-0.5" />
          <span className="text-[10px] font-bold">BIG TIME</span>
        </div>
      </div>

      {/* Custom Sticker Gallery Quick Access */}
      <div
        id="sticker-gallery-trigger"
        onClick={() => setIsStickerGalleryOpen(true)}
        className="bg-gradient-to-r from-amber-50 to-orange-50/60 hover:from-amber-100 hover:to-orange-100/75 border border-amber-200/70 p-4 rounded-2xl flex items-center justify-between shadow-xs cursor-pointer transition duration-200 hover:shadow-sm active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-xs">
            <Smile className="w-5.5 h-5.5" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xs font-black text-amber-950 font-display tracking-tight uppercase">Bacheca Adesivi Ricordo ✨</h3>
            <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
              {stickers.length} {stickers.length === 1 ? "adesivo personalizzato" : "adesivi personalizzati"} • Vedi Tutti
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-amber-600" />
      </div>

      {/* Main List */}
      <div className="space-y-5">
        {sortedRecent.map((encounter) => {
          const meta = encounterMeta.get(encounter.id);
          const hasPhotos = encounter.photos && encounter.photos.length > 0;
          const customStickersForThisEncounter = stickers.filter((st) =>
            st.associatedMeetingIds?.includes(encounter.id)
          );

          return (
            <div
              id={`encounter-card-${encounter.id}`}
              key={encounter.id}
              className="bg-white rounded-3xl border border-brand-100 shadow-sm overflow-hidden flex flex-col transition duration-300 hover:shadow-md hover:border-brand-200"
            >
              {/* Card Header */}
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    {/* Dynamic Auto-number tag */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-100 text-brand-700">
                        {meta?.index}° Incontro
                      </span>
                      {meta?.formattedDays && (
                        <span className="text-xs text-brand-500 font-semibold italic">
                          ({meta.formattedDays})
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-extrabold text-brand-950 font-display tracking-tight leading-snug">
                      {encounter.title}
                    </h3>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      {/* Edit button */}
                      <button
                        id={`edit-btn-${encounter.id}`}
                        onClick={() => onEdit(encounter)}
                        className="p-2 text-brand-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition"
                        title="Modifica ricordo"
                        aria-label="Modifica ricordo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {/* Delete button */}
                      <button
                        id={`delete-btn-${encounter.id}`}
                        onClick={() => {
                          setDeleteConfirmation({
                            type: "encounter",
                            id: encounter.id,
                            title: encounter.title,
                          });
                        }}
                        className="p-2 text-brand-300 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                        title="Elimina ricordo"
                        aria-label="Elimina incontro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Smiley face button below edit/delete tools */}
                    {customStickersForThisEncounter.length > 0 && (
                      <button
                        onClick={() => {
                          setStickerFilter(encounter.id);
                          setIsStickerGalleryOpen(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full text-amber-950 hover:border-amber-300 transition active:scale-95 cursor-pointer shadow-xs font-bold mr-1"
                        title={`Vedi gli sticker di questo giorno (${customStickersForThisEncounter.length})`}
                      >
                        <span className="text-sm">🙂</span>
                        <span className="text-[10px] font-black text-amber-700">{customStickersForThisEncounter.length}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Date Row */}
                <div className="flex items-center justify-between gap-2 mt-2.5">
                  <div className="flex items-center gap-1.5 text-brand-500 text-xs font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDateLabel(encounter.date)}</span>
                  </div>
                </div>
              </div>

              {/* Photos Gallery */}
              {hasPhotos && (
                <div className="px-5 py-2">
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
                    {(() => {
                      const displayPhotos = (encounter.photosWithAuthor && encounter.photosWithAuthor.length > 0
                        ? encounter.photosWithAuthor
                        : (encounter.photos || []).map((url) => ({ url, uploadedBy: "Samuel" }))
                      ).map(photo => ({ ...photo, encounter }));

                      return displayPhotos.map((photo, pIdx) => {
                        const isSamuel = photo.uploadedBy === "Samuel";
                        return (
                          <div
                            key={pIdx}
                            onClick={() => {
                              setLightboxPhotos(displayPhotos);
                              setLightboxIndex(pIdx);
                            }}
                            className={`relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden border-2 snap-center cursor-pointer active:scale-95 transition ${
                              isSamuel ? "border-sky-200" : "border-rose-200"
                            }`}
                          >
                            <img
                              src={photo.url}
                              alt={`Memory ${pIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            
                            {/* Small author badge */}
                            <div className={`absolute bottom-1 right-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow border bg-white ${
                              isSamuel ? "text-sky-600 border-sky-100" : "text-rose-600 border-rose-100"
                            }`}>
                              {isSamuel ? "👦 S" : "👧 I"}
                            </div>

                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                              <Eye className="w-5 h-5 text-white drop-shadow-md" />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* General Shared Note / Dedication Box */}
              {encounter.note && (
                <div className="mx-5 mb-3 p-4 bg-brand-50/50 border border-brand-100 rounded-2xl relative">
                  <div className="absolute top-3 left-4 text-brand-300">
                    <MessageSquare className="w-4 h-4 fill-brand-100" />
                  </div>
                  <p className="text-sm text-brand-800 leading-relaxed pl-6 italic font-serif whitespace-pre-wrap break-words">
                    "{encounter.note}"
                  </p>
                </div>
              )}

              {/* Co-authored personal thoughts block */}
              <div className="mx-5 mb-5 space-y-2 border-t border-brand-100/60 pt-3">
                {/* Samuel's Note */}
                {encounter.noteSamuel ? (
                  <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-2xl">
                    <span className="text-[10px] font-bold text-sky-700 block mb-0.5">👦 Samuel dice:</span>
                    <p className="text-xs text-sky-950 font-serif italic whitespace-pre-wrap break-words">"{encounter.noteSamuel}"</p>
                  </div>
                ) : (
                  currentUser === "Samuel" && (
                    <button
                      onClick={() => onEdit(encounter)}
                      className="w-full p-2.5 border border-dashed border-sky-200 bg-sky-50/20 hover:bg-sky-50 hover:border-sky-300 rounded-xl text-center text-xs text-sky-600 font-semibold tracking-wide transition flex items-center justify-center gap-1"
                    >
                      <span>👦</span> Aggiungi il tuo ricordo di Samuel! ✍️
                    </button>
                  )
                )}

                {/* Ilenia's Note */}
                {encounter.noteIle ? (
                  <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-2xl">
                    <span className="text-[10px] font-bold text-rose-700 block mb-0.5">👧 Ilenia dice:</span>
                    <p className="text-xs text-rose-950 font-serif italic whitespace-pre-wrap break-words">"{encounter.noteIle}"</p>
                  </div>
                ) : (
                  currentUser === "Ile" && (
                    <button
                      onClick={() => onEdit(encounter)}
                      className="w-full p-2.5 border border-dashed border-rose-200 bg-rose-50/20 hover:bg-rose-50 hover:border-rose-300 rounded-xl text-center text-xs text-rose-600 font-semibold tracking-wide transition flex items-center justify-center gap-1"
                    >
                      <span>👧</span> Aggiungi il tuo ricordo di Ilenia! ✍️
                    </button>
                  )
                )}

                {/* Prompt for the other user when their note is empty but the viewer is not them */}
                {!encounter.noteSamuel && currentUser !== "Samuel" && (
                  <div className="text-center p-2 text-[10px] text-brand-400 italic">
                    In attesa del pensiero di Samuel... 👦⏳
                  </div>
                )}
                {!encounter.noteIle && currentUser !== "Ile" && (
                  <div className="text-center p-2 text-[10px] text-brand-400 italic">
                    In attesa del pensiero di Ilenia... 👧⏳
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fullscreen Photo Lightbox Modal */}
      {lightboxIndex !== null && lightboxPhotos[lightboxIndex] && typeof document !== "undefined" && createPortal(
        <div
          id="photo-lightbox"
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center select-none touch-none animate-in fade-in duration-200"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top-Right Close Button */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 text-white transition-colors cursor-pointer z-50 shadow-lg"
            aria-label="Chiudi foto"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Navigation Arrows for desktop */}
          {lightboxPhotos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white/80 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 p-3 rounded-full transition active:scale-95 hidden md:flex items-center justify-center cursor-pointer shadow-lg"
                aria-label="Precedente"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white/80 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 p-3 rounded-full transition active:scale-95 hidden md:flex items-center justify-center cursor-pointer shadow-lg"
                aria-label="Successivo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Centered Image Container (Full screen, true fullscreen) */}
          <div 
            className="w-full h-full flex items-center justify-center p-2 animate-in zoom-in-95 duration-200"
            onClick={() => setLightboxIndex(null)}
          >
            <img
              src={lightboxPhotos[lightboxIndex].url}
              alt="Expanded memory"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Subtle floating overlay at the bottom */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none text-center flex flex-col items-center gap-2">
              <div className="bg-neutral-900/90 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-2xl flex flex-col items-center gap-1 shadow-2xl max-w-[90vw] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                <p className="text-white text-xs font-extrabold tracking-wide">
                  Immagine ricordo {lightboxPhotos.length > 1 && `(${lightboxIndex + 1}/${lightboxPhotos.length})`}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-white/60 font-medium">
                  <span className={lightboxPhotos[lightboxIndex].uploadedBy === "Samuel" ? "text-sky-300" : "text-rose-300"}>
                    Caricata da {lightboxPhotos[lightboxIndex].uploadedBy === "Samuel" ? "Samuel" : "Ilenia"}
                  </span>
                </div>

                {/* Extremely small and elegant settings/management button */}
                {lightboxPhotos[lightboxIndex].encounter && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const photo = lightboxPhotos[lightboxIndex];
                      setSelectedPhotoToManage({
                        url: photo.url,
                        uploadedBy: photo.uploadedBy,
                        encounter: photo.encounter!,
                      });
                      setLightboxIndex(null); // Close the lightbox to refresh state seamlessly
                    }}
                    className="mt-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 active:scale-95 transition-all text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Settings className="w-2.5 h-2.5 text-white/80" />
                    Gestisci Ricordo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}



      {/* COMPREHENSIVE STICKER GALLERY PORTAL */}
      {isStickerGalleryOpen && typeof document !== "undefined" && createPortal(
        <div
          id="sticker-gallery-overlay"
          className="fixed inset-0 z-[9000] bg-sky-50 flex justify-center items-stretch select-none animate-in fade-in duration-300"
        >
          <div
            id="sticker-gallery-sheet"
            className="w-full max-w-md bg-slate-50 shadow-2xl border-x border-brand-100 flex flex-col h-full animate-in slide-in-from-right duration-300 relative"
          >
            {/* Title & Close Header */}
            <div className="px-5 py-4 border-b border-brand-100/60 bg-white flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-brand-950 font-display">Bacheca Adesivi 🎨</h3>
                  <p className="text-[9px] text-brand-400 font-bold uppercase tracking-wider">
                    I vostri sticker e foto ricordo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStickerGalleryOpen(false)}
                className="p-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors cursor-pointer flex items-center justify-center"
                aria-label="Chiudi galleria"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable container for Upload and Sticker Grid */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* UPLOADER CARD TRIGGER OR EXPANDED */}
              {!isUploaderExpanded ? (
                <button
                  onClick={() => setIsUploaderExpanded(true)}
                  className="w-full bg-gradient-to-r from-brand-50 to-amber-50 hover:from-brand-100 hover:to-amber-100 border border-brand-100 p-3.5 rounded-2xl flex items-center justify-between shadow-xs transition duration-200 active:scale-[0.99] cursor-pointer animate-in fade-in duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center text-white shadow-xs">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-xs font-black text-brand-950 font-display tracking-tight uppercase">Nuovo Sticker Ricordo 🎨</h4>
                      <p className="text-[9px] text-brand-600 font-bold uppercase tracking-wider">Carica foto per creare adesivi</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-brand-600" />
                </button>
              ) : (
                <div className="bg-white border border-brand-100 p-4 rounded-2xl shadow-xs space-y-4 relative animate-in fade-in duration-200">
                  <button
                    onClick={() => setIsUploaderExpanded(false)}
                    className="absolute top-3.5 right-3.5 p-1 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-600 cursor-pointer transition"
                    title="Riduci"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-2 text-brand-950">
                    <Upload className="w-4 h-4 text-brand-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider">Aggiungi Nuovo Sticker</h4>
                  </div>

                  <div className="space-y-3">
                    {/* Title input */}
                    <div className="space-y-1">
                      <label htmlFor="upload-sticker-title" className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                        Nome dell'Adesivo (Es: "Cena Sushi 🍣")
                      </label>
                      <input
                        id="upload-sticker-title"
                        type="text"
                        value={uploadStickerTitle}
                        onChange={(e) => setUploadStickerTitle(e.target.value)}
                        placeholder="Dai un titolo a questo sticker..."
                        className="w-full text-xs p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:bg-white text-neutral-800"
                      />
                    </div>

                    {/* Horizontal swipe encounters picker */}
                    {encounters.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                          Collega a uno o più Incontri (Opzionale)
                        </label>
                        <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none snap-x">
                          {encounters.map((enc) => {
                            const isSelected = uploadStickerMeetingIds.includes(enc.id);
                            return (
                              <button
                                type="button"
                                key={enc.id}
                                onClick={() => {
                                  if (isSelected) {
                                    setUploadStickerMeetingIds(prev => prev.filter(id => id !== enc.id));
                                  } else {
                                    setUploadStickerMeetingIds(prev => [...prev, enc.id]);
                                  }
                                }}
                                className={`flex-shrink-0 snap-center px-3 py-1.5 rounded-xl border text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                  isSelected
                                    ? "bg-amber-100 border-amber-300 text-amber-950 shadow-xs"
                                    : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                                }`}
                              >
                                <Calendar className="w-3 h-3" />
                                <span>{enc.date.split("-").reverse().join("/")} - {enc.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Upload button wrapper */}
                    <label className={`w-full flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl transition cursor-pointer ${
                      isUploadingSticker 
                        ? "border-neutral-300 bg-neutral-50 text-neutral-400" 
                        : "border-brand-200 hover:border-brand-400 bg-brand-50/25 hover:bg-brand-50/50 text-brand-600"
                    }`}>
                      {isUploadingSticker ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[11px] font-bold">Compressione e caricamento...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Plus className="w-5 h-5 mb-0.5" />
                          <span className="text-xs font-black uppercase tracking-wider">Seleziona Immagini Sticker</span>
                          <span className="text-[9px] text-neutral-400">Puoi selezionare più immagini contemporaneamente!</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleUploadSticker}
                        disabled={isUploadingSticker}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* STICKER FILTER TABS */}
              <div className="flex gap-1.5 p-1 bg-white border border-brand-100 rounded-2xl shadow-xs">
                <button
                  onClick={() => setStickerFilter("all")}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
                    stickerFilter === "all"
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-brand-800 hover:bg-brand-50/50"
                  }`}
                >
                  Tutti ({stickers.length})
                </button>
                <button
                  onClick={() => setStickerFilter("generic")}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
                    stickerFilter === "generic"
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-brand-800 hover:bg-brand-50/50"
                  }`}
                >
                  Generici ({stickers.filter(s => !s.associatedMeetingIds || s.associatedMeetingIds.length === 0).length})
                </button>
                <button
                  onClick={() => setStickerFilter("linked")}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
                    stickerFilter === "linked"
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-brand-800 hover:bg-brand-50/50"
                  }`}
                >
                  Legati ({stickers.filter(s => s.associatedMeetingIds && s.associatedMeetingIds.length > 0).length})
                </button>
              </div>

              {/* ACTIVE ENCOUNTER FILTER BANNER */}
              {(() => {
                const activeFilterEncounter = encounters.find(e => e.id === stickerFilter);
                if (!activeFilterEncounter) return null;
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between text-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-amber-950">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <p className="font-bold text-[11px] uppercase tracking-wide">Filtro Incontro Attivo</p>
                        <p className="text-[10px] text-amber-700 italic font-medium">"{activeFilterEncounter.title}"</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setStickerFilter("all")}
                      className="px-2.5 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-[9px] uppercase tracking-wider rounded-xl transition cursor-pointer"
                    >
                      Annulla
                    </button>
                  </div>
                );
              })()}

              {/* GRID OF STICKERS */}
              {(() => {
                const filteredStickers = stickers.filter((st) => {
                  if (stickerFilter === "generic") {
                    return !st.associatedMeetingIds || st.associatedMeetingIds.length === 0;
                  }
                  if (stickerFilter === "linked") {
                    return st.associatedMeetingIds && st.associatedMeetingIds.length > 0;
                  }
                  if (stickerFilter !== "all") {
                    return st.associatedMeetingIds && st.associatedMeetingIds.includes(stickerFilter);
                  }
                  return true;
                });

                const getStickerTime = (st: Sticker) => {
                  if (st.associatedMeetingIds && st.associatedMeetingIds.length > 0) {
                    const dates = st.associatedMeetingIds
                      .map((mId) => encounters.find((e) => e.id === mId)?.date)
                      .filter((date): date is string => !!date);
                    if (dates.length > 0) {
                      dates.sort();
                      return new Date(dates[dates.length - 1]).getTime();
                    }
                  }
                  return new Date(st.createdAt || 0).getTime();
                };

                const sortedStickers = [...filteredStickers].sort((a, b) => getStickerTime(b) - getStickerTime(a));

                if (sortedStickers.length === 0) {
                  return (
                    <div className="text-center py-10 space-y-2 bg-white rounded-2xl border border-brand-100 p-4">
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Nessun adesivo trovato</p>
                      <p className="text-[11px] text-neutral-400">Caricate la vostra prima foto ricordo sopra!</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 gap-3.5">
                    {sortedStickers.map((st) => {
                      const isSelected = selectedDetailSticker?.id === st.id;
                      return (
                        <div
                          key={st.id}
                          className={`bg-white rounded-2xl border-2 p-3 flex flex-col space-y-2.5 transition duration-200 relative ${
                            isSelected 
                              ? "border-amber-400 shadow-md scale-[1.01]" 
                              : "border-neutral-100 shadow-xs hover:border-neutral-200"
                          }`}
                        >
                          {/* Image box */}
                          <div 
                            onClick={() => setSelectedDetailSticker(isSelected ? null : st)}
                            className="aspect-square w-full rounded-xl overflow-hidden bg-slate-50 relative cursor-pointer"
                          >
                            <img
                              src={st.url}
                              alt={st.title}
                              className="w-full h-full object-cover transition hover:scale-105"
                            />
                            {/* Author label */}
                            <span className={`absolute top-1.5 right-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow border bg-white ${
                              st.uploadedBy === "Samuel" ? "text-sky-600 border-sky-100" : "text-rose-600 border-rose-100"
                            }`}>
                              {st.uploadedBy === "Samuel" ? "Samuel" : "Ilenia"}
                            </span>
                          </div>

                          {/* Info section */}
                          <div className="space-y-1.5 min-w-0 flex-1">

                            
                            {/* Linked events section */}
                            <div className="space-y-1">
                              {st.associatedMeetingIds && st.associatedMeetingIds.length > 0 ? (
                                st.associatedMeetingIds.map((mId) => {
                                  const enc = encounters.find((e) => e.id === mId);
                                  if (!enc) return null;
                                  return (
                                    <div key={mId} className="flex items-start gap-1 text-[8px] font-bold text-amber-800 bg-amber-50/70 border border-amber-100/60 p-1 rounded-md">
                                      <Calendar className="w-2.5 h-2.5 text-amber-600 shrink-0 mt-0.5" />
                                      <div className="truncate min-w-0">
                                        <span className="font-mono">{enc.date.split("-").reverse().join("/")}</span>: {enc.title}
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-[8px] font-bold text-neutral-400 bg-neutral-50 border border-neutral-100 p-1 rounded-md flex items-center gap-0.5">
                                  <span>📌 Ricordo Generale</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Footer action buttons */}
                          <div className="flex gap-1.5 pt-1 mt-auto border-t border-neutral-50">
                            <button
                              onClick={() => {
                                setSelectedDetailSticker(st);
                                setIsLinkingOpen(true);
                              }}
                              className="flex-1 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/60 text-neutral-700 font-extrabold text-[9px] rounded-lg uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                            >
                              <Link2 className="w-3 h-3 text-neutral-500" />
                              <span>Collega</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSticker(st.id, st.title)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg cursor-pointer transition active:scale-95"
                              title="Elimina Sticker"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Bottom Actions */}
            <div className="px-6 py-4 border-t border-brand-100/60 bg-white flex gap-3">
              <button
                onClick={() => setIsStickerGalleryOpen(false)}
                className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm rounded-2xl transition active:scale-98 shadow-sm cursor-pointer text-center"
              >
                Chiudi Galleria ✨
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ASSOCIATION LINKING DRAWER */}
      {isLinkingOpen && selectedDetailSticker && typeof document !== "undefined" && createPortal(
        <div
          id="sticker-linking-overlay"
          className="fixed inset-0 z-[11000] bg-black/60 backdrop-blur-xs flex items-end justify-center select-none animate-in fade-in duration-200"
          onClick={() => setIsLinkingOpen(false)}
        >
          <div
            id="sticker-linking-sheet"
            className="w-full max-w-md bg-white rounded-t-[32px] shadow-2xl border-t border-brand-100 flex flex-col max-h-[70vh] animate-in slide-in-from-bottom-5 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header indicator bar */}
            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mt-3.5 mb-1 cursor-pointer" onClick={() => setIsLinkingOpen(false)} />

            {/* Header */}
            <div className="px-6 pt-2 pb-4 border-b border-brand-100/60 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-brand-950 font-display">Collega Incontri</h3>
                <p className="text-[10px] text-brand-400 font-bold uppercase tracking-wider truncate max-w-[280px]">
                  {selectedDetailSticker.title}
                </p>
              </div>
              <button
                onClick={() => setIsLinkingOpen(false)}
                className="p-1.5 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-600 transition-colors cursor-pointer"
                aria-label="Chiudi collegamento"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable list of encounters */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <p className="text-xs text-brand-500 font-medium">
                Seleziona a quali incontri associare questo adesivo ricordo:
              </p>

              {encounters.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-xs">
                  Nessun incontro disponibile per il collegamento.
                </div>
              ) : (
                <div className="space-y-2">
                  {encounters.map((enc) => {
                    const isLinked = selectedDetailSticker.associatedMeetingIds?.includes(enc.id);
                    return (
                      <label
                        key={enc.id}
                        className={`flex items-start gap-3 p-3 rounded-2xl border-2 transition cursor-pointer ${
                          isLinked
                            ? "border-amber-400 bg-amber-50/50 text-amber-950"
                            : "border-neutral-100 hover:bg-neutral-50 text-neutral-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isLinked}
                          onChange={() => handleToggleStickerAssociation(selectedDetailSticker, enc.id)}
                          className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-neutral-300 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-extrabold truncate">{enc.title}</p>
                          <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                            {enc.date.split("-").reverse().join("/")}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="px-6 py-4 border-t border-brand-100/60 bg-brand-50/50 flex gap-3">
              <button
                onClick={() => setIsLinkingOpen(false)}
                className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm rounded-2xl transition active:scale-98 shadow-sm cursor-pointer text-center"
              >
                Salva Collegamenti ✨
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SAFE CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteConfirmation && typeof document !== "undefined" && createPortal(
        <div
          id="custom-delete-confirm-overlay"
          className="fixed inset-0 z-[12000] bg-black/65 backdrop-blur-xs flex items-center justify-center select-none animate-in fade-in duration-200 p-4"
          onClick={() => setDeleteConfirmation(null)}
        >
          <div
            id="custom-delete-confirm-card"
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-neutral-100 p-6 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-neutral-900 font-display">Sei assolutamente sicuro?</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Stai per eliminare definitivamente:
                <br />
                <span className="font-bold text-neutral-800 italic">"{deleteConfirmation.title}"</span>.
                <br />
                Questa azione è irreversibile e i dati non potranno essere recuperati.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-2xl transition cursor-pointer active:scale-95 text-center uppercase tracking-wider"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-2xl transition cursor-pointer active:scale-95 text-center uppercase tracking-wider shadow-sm"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PHOTO ACTIONS MODAL (DELETE, REPLACE, MOVE) */}
      {selectedPhotoToManage && (
        <PhotoActionModal
          isOpen={selectedPhotoToManage !== null}
          onClose={() => setSelectedPhotoToManage(null)}
          photoUrl={selectedPhotoToManage.url}
          photoAuthor={selectedPhotoToManage.uploadedBy}
          encounter={selectedPhotoToManage.encounter}
          allEncounters={encounters}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

// Inline fallback since Lucide-react doesn't have custom X icon occasionally
function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
