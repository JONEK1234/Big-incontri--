import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Encounter } from "../types";
import { ImageIcon, Eye, Heart, Calendar, Sparkles, ChevronLeft, ChevronRight, X, Settings } from "lucide-react";
import PhotoActionModal from "./PhotoActionModal";

interface PhotoGalleryProps {
  encounters: Encounter[];
  currentUser: string;
}

export default function PhotoGallery({ encounters, currentUser }: PhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  // States for managing a selected photo from the gallery (replaces long-press modal popup)
  const [selectedPhotoToManage, setSelectedPhotoToManage] = useState<{
    url: string;
    uploadedBy: string;
    encounter: Encounter;
  } | null>(null);

  // Collect all photos from all encounters, paired with encounter info, author and parent encounter object
  const allPhotos = encounters.flatMap((enc) => {
    if (enc.photosWithAuthor && enc.photosWithAuthor.length > 0) {
      return enc.photosWithAuthor.map((p) => ({
        url: p.url,
        uploadedBy: p.uploadedBy,
        date: enc.date,
        title: enc.title,
        encounter: enc,
      }));
    }
    const photosList = enc.photos || [];
    return photosList.map((photo) => ({
      url: photo,
      uploadedBy: "Samuel", // Fallback for legacy photos
      date: enc.date,
      title: enc.title,
      encounter: enc,
    }));
  });

  // Sort photos chronologically by date descending
  const sortedPhotos = [...allPhotos].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const selectedPhoto = selectedIndex !== null ? sortedPhotos[selectedIndex] : null;

  const handleNext = () => {
    if (selectedIndex !== null && sortedPhotos.length > 0) {
      setSelectedIndex((prevIndex) => (prevIndex! + 1) % sortedPhotos.length);
    }
  };

  const handlePrev = () => {
    if (selectedIndex !== null && sortedPhotos.length > 0) {
      setSelectedIndex((prevIndex) => (prevIndex! - 1 + sortedPhotos.length) % sortedPhotos.length);
    }
  };

  // Touch Swipe handlers
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
    const swipeThreshold = 50; // minimum pixels for a swipe

    if (diffX > swipeThreshold) {
      // Swiped Left -> show next photo
      handleNext();
    } else if (diffX < -swipeThreshold) {
      // Swiped Right -> show previous photo
      handlePrev();
    }

    setTouchStartX(null);
    setTouchEndX(null);
  };

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "Escape") {
        setSelectedIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIndex]);

  const formatDateLabel = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("it-IT", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (sortedPhotos.length === 0) {
    return (
      <div id="empty-gallery" className="text-center py-16 px-4 bg-white rounded-3xl border border-brand-100 shadow-sm space-y-4">
        <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto text-brand-400">
          <ImageIcon className="w-8 h-8 stroke-1" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-brand-900 text-lg">La galleria è vuota</h3>
          <p className="text-sm text-brand-500 max-w-xs mx-auto">
            Aggiungete una foto caricandola nei vostri incontri per vederla comparire qui in questo rullino magico!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gallery stats */}
      <div className="bg-gradient-to-r from-sky-400 to-brand-500 text-white p-5 rounded-3xl shadow-md flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-sky-100">I vostri scatti</span>
          <h2 className="text-xl font-extrabold font-display mt-0.5">Rullino dei Ricordi</h2>
          <p className="text-xs text-sky-50 mt-1">
            {sortedPhotos.length} foto scattate insieme 📸
          </p>
        </div>
        <div className="bg-white/10 p-2.5 rounded-2xl">
          <Sparkles className="w-5 h-5 text-yellow-200" />
        </div>
      </div>

      {/* Grid displaying the date under each thumbnail */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-5">
        {sortedPhotos.map((photo, index) => {
          const isSamuel = photo.uploadedBy === "Samuel";
          return (
            <div
              id={`gallery-item-${index}`}
              key={index}
              onClick={() => setSelectedIndex(index)}
              className="flex flex-col items-stretch cursor-pointer group active:scale-95 transition"
            >
              {/* Image box */}
              <div className="relative aspect-square rounded-2xl overflow-hidden border border-brand-100 shadow-sm bg-brand-50">
                <img
                  src={photo.url}
                  alt={photo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                
                {/* Author badge on bottom-right of thumbnail */}
                <div className={`absolute bottom-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow border bg-white flex items-center gap-0.5 ${
                  isSamuel ? "text-sky-600 border-sky-100" : "text-rose-600 border-rose-100"
                }`}>
                  <span>{isSamuel ? "👦 S" : "👧 I"}</span>
                </div>

                <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <Eye className="w-5 h-5 text-white drop-shadow" />
                </div>
              </div>
              
              {/* Caption beneath photo */}
              <div className="mt-1 text-center flex flex-col justify-center px-1">
                <span className="text-[10px] font-bold text-brand-800 tracking-tight leading-tight truncate" title={photo.title}>
                  {photo.title}
                </span>
                <span className="text-[9px] font-medium text-brand-400 mt-0.5 whitespace-nowrap">
                  {formatDateLabel(photo.date)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fullscreen Photo Lightbox Modal with Mobile Optimization and Swiping */}
      {selectedPhoto && typeof document !== "undefined" && createPortal(
        <div
          id="gallery-lightbox"
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center select-none touch-none animate-in fade-in duration-200"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => setSelectedIndex(null)}
        >
          {/* Top-Right Close Button */}
          <button
            id="close-gallery-lightbox"
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 text-white transition-colors cursor-pointer z-50 shadow-lg"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Left Arrow Button */}
          {sortedPhotos.length > 1 && (
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
          )}

          {/* Right Arrow Button */}
          {sortedPhotos.length > 1 && (
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
          )}

          {/* Centered Image Container (Full screen, true fullscreen) */}
          <div 
            className="w-full h-full flex items-center justify-center p-2 animate-in zoom-in-95 duration-200"
            onClick={() => setSelectedIndex(null)}
          >
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.title || "Immagine ricordo"}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Subtle floating overlay at the bottom */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none text-center flex flex-col items-center gap-2">
              <div className="bg-neutral-900/90 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-2xl flex flex-col items-center gap-1 shadow-2xl max-w-[90vw] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                {selectedPhoto.title && (
                  <p className="text-white text-xs font-extrabold tracking-wide truncate max-w-[220px]">
                    {selectedPhoto.title}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-[10px] text-white/60 font-medium">
                  <span className="font-bold text-white/80">{selectedIndex! + 1} di {sortedPhotos.length}</span>
                  <span>•</span>
                  <span>{formatDateLabel(selectedPhoto.date)}</span>
                  <span>•</span>
                  <span className={selectedPhoto.uploadedBy === "Samuel" ? "text-sky-300" : "text-rose-300"}>
                    {selectedPhoto.uploadedBy}
                  </span>
                </div>

                {/* Extremely small and elegant settings/management button */}
                {selectedPhoto.encounter && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoToManage({
                        url: selectedPhoto.url,
                        uploadedBy: selectedPhoto.uploadedBy,
                        encounter: selectedPhoto.encounter,
                      });
                      setSelectedIndex(null); // Close the lightbox to refresh state seamlessly
                    }}
                    className="mt-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 active:scale-95 transition-all text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Settings className="w-2.5 h-2.5 text-white/80" />
                    Gestisci Ricordo
                  </button>
                )}
              </div>
              {sortedPhotos.length > 1 && (
                <span className="text-white/30 text-[9px] font-medium tracking-wide mt-2 block md:hidden">
                  ← Scorri per cambiare foto →
                </span>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PHOTO ACTION MODAL (DELETE, REPLACE, MOVE) */}
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
