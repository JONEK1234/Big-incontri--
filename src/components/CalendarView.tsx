import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { SpecialDate, Encounter } from "../types";
import { getAnniversaryStatus } from "../utils/anniversaryHelper";
import { Calendar as CalendarIcon, Star, Gift, Heart, CalendarDays, Plus, Trash2, ArrowRight, Sparkles, X, MessageSquare, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarViewProps {
  specialDates: SpecialDate[];
  encounters: Encounter[];
  onAddSpecialDate: (date: { date: string; title: string; description: string; type: "anniversary" | "special_date" | "milestone" }) => Promise<void>;
  onDeleteSpecialDate: (id: string) => Promise<void>;
}

export default function CalendarView({ specialDates, encounters, onAddSpecialDate, onDeleteSpecialDate }: CalendarViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"anniversary" | "special_date" | "milestone">("anniversary");
  const [isSaving, setIsSaving] = useState(false);

  // Encounter detailed view popover
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [lightboxTouchStartX, setLightboxTouchStartX] = useState<number | null>(null);
  const [lightboxTouchEndX, setLightboxTouchEndX] = useState<number | null>(null);

  // Get photos list of currently opened encounter
  const currentEncounterPhotos = selectedEncounter ? (() => {
    const encPhotos: { url: string; uploadedBy?: string }[] = [];
    if (selectedEncounter.photosWithAuthor && selectedEncounter.photosWithAuthor.length > 0) {
      selectedEncounter.photosWithAuthor.forEach(p => {
        encPhotos.push({ url: p.url, uploadedBy: p.uploadedBy });
      });
    } else if (selectedEncounter.photos && selectedEncounter.photos.length > 0) {
      selectedEncounter.photos.forEach(p => {
        encPhotos.push({ url: p, uploadedBy: "Samuel" });
      });
    }
    return encPhotos;
  })() : [];

  const handleLightboxNext = () => {
    if (activeLightboxIndex !== null && currentEncounterPhotos.length > 0) {
      setActiveLightboxIndex((prev) => (prev! + 1) % currentEncounterPhotos.length);
    }
  };

  const handleLightboxPrev = () => {
    if (activeLightboxIndex !== null && currentEncounterPhotos.length > 0) {
      setActiveLightboxIndex((prev) => (prev! - 1 + currentEncounterPhotos.length) % currentEncounterPhotos.length);
    }
  };

  // Touch Swipe handlers for Calendar Lightbox
  const handleLightboxTouchStart = (e: React.TouchEvent) => {
    setLightboxTouchStartX(e.targetTouches[0].clientX);
    setLightboxTouchEndX(null);
  };

  const handleLightboxTouchMove = (e: React.TouchEvent) => {
    setLightboxTouchEndX(e.targetTouches[0].clientX);
  };

  const handleLightboxTouchEnd = () => {
    if (lightboxTouchStartX === null || lightboxTouchEndX === null) return;
    const diffX = lightboxTouchStartX - lightboxTouchEndX;
    const swipeThreshold = 50;

    if (diffX > swipeThreshold) {
      handleLightboxNext();
    } else if (diffX < -swipeThreshold) {
      handleLightboxPrev();
    }

    setLightboxTouchStartX(null);
    setLightboxTouchEndX(null);
  };

  // Keyboard navigation for Calendar Lightbox
  useEffect(() => {
    if (activeLightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        handleLightboxNext();
      } else if (e.key === "ArrowLeft") {
        handleLightboxPrev();
      } else if (e.key === "Escape") {
        setActiveLightboxIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeLightboxIndex, currentEncounterPhotos.length]);

  // Calendar rendering state
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const monthNames = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Generate calendar days for viewMonth and viewYear
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  // Adjust so Monday is first day of the week (standard in Italy)
  const adjustedStartDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const daysArray = [];
  // Empty slots for preceding days
  for (let i = 0; i < adjustedStartDay; i++) {
    daysArray.push(null);
  }
  // Actual days
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(i);
  }

  // Find occurrences (encounters and special dates) on a specific calendar day
  const getDayEvents = (dayNum: number) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, "0");
    const formattedDay = String(dayNum).padStart(2, "0");
    const checkDateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;

    // Match encounter
    const matchesEncounter = encounters.filter(e => e.date === checkDateStr);
    
    // Match special dates (anniversaries match by month and day, or specific year)
    const matchesSpecial = specialDates.filter(s => {
      if (s.type === "anniversary") {
        // Anniversaries repeat every year, compare month and day
        const sParts = s.date.split("-");
        return parseInt(sParts[1]) === (viewMonth + 1) && parseInt(sParts[2]) === dayNum;
      } else {
        // Exact match
        return s.date === checkDateStr;
      }
    });

    return { matchesEncounter, matchesSpecial };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;

    setIsSaving(true);
    try {
      await onAddSpecialDate({
        title: newTitle.trim(),
        date: newDate,
        description: newDesc.trim(),
        type: newType,
      });
      setNewTitle("");
      setNewDate("");
      setNewDesc("");
      setShowAddForm(false);
    } catch (err) {
      console.error("Error saving special date:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "anniversary":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "milestone":
        return "bg-indigo-100 text-indigo-700 border-indigo-200";
      default:
        return "bg-brand-100 text-brand-700 border-brand-200";
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "anniversary":
        return <Star className="w-4 h-4 text-amber-500 fill-amber-300" />;
      case "milestone":
        return <Gift className="w-4 h-4 text-indigo-500 fill-indigo-200" />;
      default:
        return <Heart className="w-4 h-4 text-red-500 fill-red-200" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Alerts */}
      <div className="bg-white rounded-3xl border border-brand-100 p-5 shadow-sm">
        <h3 className="font-bold text-brand-950 text-lg font-display flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-brand-500" />
          I Nostri Anniversari
        </h3>

        {/* List of active alerts and countdowns */}
        <div className="space-y-3">
          {specialDates.length === 0 ? (
            <p className="text-sm text-brand-500 italic">Nessun anniversario inserito. Aggiungine uno per vedere il conto alla rovescia!</p>
          ) : (
            specialDates.map((special) => {
              const status = getAnniversaryStatus(special.date);
              
              return (
                <div
                  id={`special-card-${special.id}`}
                  key={special.id}
                  className={`p-4 rounded-2xl border transition duration-200 ${
                    status.isToday
                      ? "bg-gradient-to-r from-yellow-50 to-amber-50 border-amber-300 shadow-sm animate-pulse"
                      : "bg-brand-50/30 border-brand-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{getIcon(special.type)}</div>
                      <div>
                        <h4 className="font-bold text-brand-950 text-sm">{special.title}</h4>
                        {special.description && (
                          <p className="text-xs text-brand-600 mt-0.5">{special.description}</p>
                        )}
                        <p className="text-[10px] text-brand-400 mt-1">
                          Data originale: {new Date(special.date).toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                      </div>
                    </div>

                    <button
                      id={`delete-special-${special.id}`}
                      onClick={() => {
                        if (window.confirm("Vuoi rimuovere questo anniversario?")) {
                          onDeleteSpecialDate(special.id);
                        }
                      }}
                      className="text-brand-300 hover:text-red-500 p-1 rounded-full transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Anniversary calculation badge */}
                  {special.type === "anniversary" && (
                    <div className="mt-3 flex items-center justify-between border-t border-dashed border-brand-100 pt-2.5">
                      {status.isToday ? (
                        <span className="text-xs font-black text-amber-700 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          OGGI: 🎉 Festeggiamo {status.yearsElapsed} ann{status.yearsElapsed === 1 ? "o" : "i"} di questo evento!
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-brand-600 flex items-center gap-1">
                          Prossimo traguardo: <strong className="text-brand-800 font-bold">{status.yearsToCelebrate} ann{status.yearsToCelebrate === 1 ? "o" : "i"}</strong> il {new Date(status.nextOccurrence).toLocaleDateString("it-IT", { month: "short", day: "numeric" })}
                        </span>
                      )}

                      {!status.isToday && (
                        <span className="text-[10px] bg-brand-100 text-brand-700 font-extrabold px-2 py-0.5 rounded-full">
                          Mancano {status.daysRemaining} giorni
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Toggle Form Button */}
        {!showAddForm ? (
          <button
            id="toggle-special-form"
            onClick={() => setShowAddForm(true)}
            className="mt-4 w-full py-2.5 px-4 border border-dashed border-brand-200 text-brand-600 hover:border-brand-400 hover:bg-brand-50/50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.99] transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Aggiungi Data Speciale
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 border-t border-brand-100 pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-800 uppercase">Titolo</label>
                <input
                  id="special-title"
                  type="text"
                  required
                  placeholder="Anniversario amicizia..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-50/50 border border-brand-100 rounded-xl text-xs text-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-800 uppercase">Quando è iniziato?</label>
                <input
                  id="special-date"
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-50/50 border border-brand-100 rounded-xl text-xs text-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-800 uppercase">Tipo</label>
                <select
                  id="special-type"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-brand-50/50 border border-brand-100 rounded-xl text-xs text-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:bg-white"
                >
                  <option value="anniversary">Anniversario 🌟</option>
                  <option value="milestone">Traguardo 🎁</option>
                  <option value="special_date">Data Importante ❤️</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-800 uppercase">Piccola descrizione</label>
                <input
                  id="special-desc"
                  type="text"
                  placeholder="La data del nostro primo..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-50/50 border border-brand-100 rounded-xl text-xs text-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3.5 py-1.5 border border-brand-100 hover:bg-brand-50 text-brand-600 rounded-xl text-xs font-semibold"
              >
                Annulla
              </button>
              <button
                id="save-special-btn"
                type="submit"
                disabled={isSaving}
                className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                {isSaving ? "Salvataggio..." : "Salva ✨"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. Interactive Monthly Calendar Grid */}
      <div className="bg-white rounded-3xl border border-brand-100 p-5 shadow-sm">
        {/* Calendar Nav */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-brand-950 text-base font-display">
            {monthNames[viewMonth]} {viewYear}
          </h3>
          <div className="flex gap-1.5">
            <button
              id="calendar-prev-month"
              onClick={handlePrevMonth}
              className="p-1.5 bg-brand-50 hover:bg-brand-100 rounded-lg text-brand-600 active:scale-90 transition cursor-pointer"
            >
              &larr;
            </button>
            <button
              id="calendar-next-month"
              onClick={handleNextMonth}
              className="p-1.5 bg-brand-50 hover:bg-brand-100 rounded-lg text-brand-600 active:scale-90 transition cursor-pointer"
            >
              &rarr;
            </button>
          </div>
        </div>

        {/* Week Days Header */}
        <div className="grid grid-cols-7 text-center text-[10px] font-black text-brand-400 uppercase tracking-wider mb-2">
          <div>Lun</div>
          <div>Mar</div>
          <div>Mer</div>
          <div>Gio</div>
          <div>Ven</div>
          <div>Sab</div>
          <div>Dom</div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {daysArray.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const { matchesEncounter, matchesSpecial } = getDayEvents(day);
            const isToday = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
            const hasEncounter = matchesEncounter.length > 0;
            const hasSpecial = matchesSpecial.length > 0;

            return (
              <div
                key={`day-${day}`}
                className={`aspect-square rounded-xl border flex flex-col justify-between p-1 relative group cursor-pointer transition ${
                  isToday
                    ? "border-brand-500 bg-brand-50/70"
                    : hasEncounter
                    ? "border-brand-200 bg-sky-50 hover:bg-sky-100"
                    : "border-brand-50 hover:bg-brand-50/40"
                }`}
                title={
                  matchesEncounter.map(e => e.title).join(", ") || 
                  matchesSpecial.map(s => s.title).join(", ")
                }
                onClick={() => {
                  if (hasEncounter) {
                    setSelectedEncounter(matchesEncounter[0]);
                  }
                }}
              >
                {/* Day Number */}
                <span className={`text-[11px] font-bold leading-none ${
                  isToday ? "text-brand-600 font-black" : "text-brand-900"
                }`}>
                  {day}
                </span>

                {/* Event Indicators */}
                <div className="flex gap-0.5 justify-end mt-auto">
                  {hasEncounter && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 block" title="Incontro!" />
                  )}
                  {hasSpecial && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 block" title="Anniversario!" />
                  )}
                </div>

                {/* Hover Quick Tip (custom tooltip simulation) */}
                {(hasEncounter || hasSpecial) && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-brand-950 text-white text-[9px] py-1 px-2 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition z-10 w-28 text-center shadow-lg mb-1">
                    {hasEncounter && `📸 ${matchesEncounter.length} Incontro`}
                    {hasEncounter && hasSpecial && " / "}
                    {hasSpecial && `🌟 Anniversario`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Encounter Details Popover Menu/Modal */}
      {selectedEncounter && (
        <div
          id="encounter-details-modal"
          className="fixed inset-0 z-40 bg-brand-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedEncounter(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-brand-100 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-sky-400 to-brand-500 p-5 text-white relative">
              <button
                id="close-encounter-modal"
                onClick={() => setSelectedEncounter(null)}
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/35 text-white p-1.5 rounded-full transition cursor-pointer"
                aria-label="Chiudi"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 text-sky-100 text-[10px] font-black uppercase tracking-wider">
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>
                  {new Date(selectedEncounter.date).toLocaleDateString("it-IT", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              
              <h4 className="text-lg font-black font-display mt-1 text-white leading-tight">
                {selectedEncounter.title}
              </h4>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-5">
              {/* Notes Sections */}
              <div className="space-y-4">
                {/* Shared note */}
                {selectedEncounter.note && (
                  <div className="bg-brand-50/50 border border-brand-100 rounded-2xl p-4 relative">
                    <div className="absolute top-3 left-4 text-brand-300">
                      <MessageSquare className="w-4 h-4 fill-brand-100" />
                    </div>
                    <span className="text-[10px] font-bold text-brand-500 pl-6 block mb-1">Nota condivisa</span>
                    <p className="text-sm text-brand-950 leading-relaxed pl-6 italic font-serif whitespace-pre-wrap break-words">
                      "{selectedEncounter.note}"
                    </p>
                  </div>
                )}

                {/* Samuel's note */}
                {selectedEncounter.noteSamuel && (
                  <div className="p-4 bg-sky-50/60 border border-sky-100 rounded-2xl">
                    <span className="text-[10px] font-black text-sky-700 block mb-1">👦 Samuel ha scritto:</span>
                    <p className="text-xs text-sky-950 font-serif italic whitespace-pre-wrap break-words">
                      "{selectedEncounter.noteSamuel}"
                    </p>
                  </div>
                )}

                {/* Ilenia's note */}
                {selectedEncounter.noteIle && (
                  <div className="p-4 bg-rose-50/60 border border-rose-100 rounded-2xl">
                    <span className="text-[10px] font-black text-rose-700 block mb-1">👧 Ilenia ha scritto:</span>
                    <p className="text-xs text-rose-950 font-serif italic whitespace-pre-wrap break-words">
                      "{selectedEncounter.noteIle}"
                    </p>
                  </div>
                )}

                {!selectedEncounter.note && !selectedEncounter.noteSamuel && !selectedEncounter.noteIle && (
                  <p className="text-center text-xs text-brand-400 italic py-4">Nessuna nota presente per questo giorno.</p>
                )}
              </div>

              {/* Photos Gallery Section */}
              {(() => {
                const encPhotos: { url: string; uploadedBy?: string }[] = [];
                if (selectedEncounter.photosWithAuthor && selectedEncounter.photosWithAuthor.length > 0) {
                  selectedEncounter.photosWithAuthor.forEach(p => {
                    encPhotos.push({ url: p.url, uploadedBy: p.uploadedBy });
                  });
                } else if (selectedEncounter.photos && selectedEncounter.photos.length > 0) {
                  selectedEncounter.photos.forEach(p => {
                    encPhotos.push({ url: p, uploadedBy: "Samuel" });
                  });
                }

                if (encPhotos.length === 0) return null;

                return (
                  <div className="space-y-2.5 border-t border-brand-100 pt-4">
                    <span className="text-xs font-black text-brand-900 flex items-center gap-1.5 uppercase tracking-wider">
                      <ImageIcon className="w-4 h-4 text-brand-500" />
                      Foto di quel giorno ({encPhotos.length})
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {encPhotos.map((photo, i) => {
                        const isSamuel = photo.uploadedBy === "Samuel";
                        return (
                          <div
                            key={i}
                            onClick={() => setActiveLightboxIndex(i)}
                            className="aspect-square rounded-xl overflow-hidden border border-brand-100 shadow-sm bg-brand-50 cursor-pointer active:scale-95 hover:opacity-90 transition relative group"
                          >
                            <img
                              src={photo.url}
                              alt="Scatto dell'incontro"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {photo.uploadedBy && (
                              <div className={`absolute bottom-1 right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow border bg-white flex items-center gap-0.5 ${
                                isSamuel ? "text-sky-600 border-sky-100" : "text-rose-600 border-rose-100"
                              }`}>
                                <span>{isSamuel ? "👦 S" : "👧 I"}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-brand-50/50 border-t border-brand-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEncounter(null)}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Fullscreen image lightbox with navigation & swipe for Calendar view */}
      {activeLightboxIndex !== null && currentEncounterPhotos[activeLightboxIndex] && typeof document !== "undefined" && createPortal(
        <div
          id="calendar-photo-lightbox"
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center select-none touch-none animate-in fade-in duration-200"
          onTouchStart={handleLightboxTouchStart}
          onTouchMove={handleLightboxTouchMove}
          onTouchEnd={handleLightboxTouchEnd}
          onClick={() => setActiveLightboxIndex(null)}
        >
          {/* Top-Right Close Button */}
          <button
            onClick={() => setActiveLightboxIndex(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 text-white transition-colors cursor-pointer z-50 shadow-lg"
            aria-label="Chiudi foto"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Left Arrow Button */}
          {currentEncounterPhotos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLightboxPrev();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white/80 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 p-3 rounded-full transition active:scale-95 hidden md:flex items-center justify-center cursor-pointer shadow-lg"
              aria-label="Precedente"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Right Arrow Button */}
          {currentEncounterPhotos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLightboxNext();
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
            onClick={() => setActiveLightboxIndex(null)}
          >
            <img
              src={currentEncounterPhotos[activeLightboxIndex].url}
              alt="Ingrandimento foto"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Subtle floating overlay at the bottom */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none text-center">
              <div className="bg-neutral-900/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl flex flex-col items-center gap-0.5 shadow-2xl max-w-[90vw]">
                {selectedEncounter?.title && (
                  <p className="text-white text-xs font-extrabold tracking-wide truncate max-w-[220px]">
                    {selectedEncounter.title}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-[10px] text-white/60 font-medium">
                  <span className="font-bold text-white/80">{activeLightboxIndex + 1} di {currentEncounterPhotos.length}</span>
                  <span>•</span>
                  <span>
                    {selectedEncounter && new Date(selectedEncounter.date).toLocaleDateString("it-IT", {
                      year: "numeric",
                      month: "short",
                      day: "numeric"
                    })}
                  </span>
                  {currentEncounterPhotos[activeLightboxIndex].uploadedBy && (
                    <>
                      <span>•</span>
                      <span className={currentEncounterPhotos[activeLightboxIndex].uploadedBy === "Samuel" ? "text-sky-300" : "text-rose-300"}>
                        {currentEncounterPhotos[activeLightboxIndex].uploadedBy}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {currentEncounterPhotos.length > 1 && (
                <span className="text-white/30 text-[9px] font-medium tracking-wide mt-2 block md:hidden">
                  ← Scorri per cambiare foto →
                </span>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
