import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Calendar as CalendarIcon, FileText, Camera, Plus, Trash2, Heart, Sparkles, User, MessageCircle, Check, Copy, ExternalLink, Terminal, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { compressImage } from "../utils/imageCompressor";
import { Encounter, EncounterPhoto } from "../types";
import { uploadImageToStorage, addSystemLog } from "../utils/imageUploader";

interface AddEncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (encounter: {
    id?: string;
    date: string;
    title: string;
    note: string;
    noteSamuel?: string;
    noteIle?: string;
    photos: string[];
    photosWithAuthor?: EncounterPhoto[];
  }) => Promise<void>;
  currentUser: string;
  encounterToEdit?: Encounter | null;
}

const PRESET_EMOJIS = ["❤️", "✨", "🍕", "🎬", "🚗", "🏖️", "🍨", "☕", "🏡", "🌳", "🍿", "🎁", "🎡", "👩‍❤️‍👨"];

interface UploadQueueItem {
  id: string;
  name: string;
  status: "compressing" | "uploading" | "completed" | "error";
  url?: string;
  uploadedBy: string;
  progressText: string;
}

export default function AddEncounterModal({
  isOpen,
  onClose,
  onSave,
  currentUser,
  encounterToEdit,
}: AddEncounterModalProps) {
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [noteSamuel, setNoteSamuel] = useState("");
  const [noteIle, setNoteIle] = useState("");
  const [photosWithAuthor, setPhotosWithAuthor] = useState<EncounterPhoto[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoadedRef = useRef(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // States for uploading queue, live console logs, and visual triggers
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [debugLogs, setDebugLogs] = useState<{ type: string; text: string; timestamp: string }[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // Global custom event listener for system logs emitted by the imageUploader
  useEffect(() => {
    const handleLog = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setDebugLogs((prev) => [customEvent.detail, ...prev].slice(0, 40));
      }
    };
    window.addEventListener("system_log", handleLog);
    return () => window.removeEventListener("system_log", handleLog);
  }, []);

  // Lock scroll of the page when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Load state when modal opens or encounterToEdit changes, checking for a saved draft
  useEffect(() => {
    if (isOpen) {
      const key = encounterToEdit ? `bigincontri_draft_edit_${encounterToEdit.id}` : "bigincontri_draft_new";
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          setDate(draft.date || "");
          setTitle(draft.title || "");
          setNote(draft.note || "");
          setNoteSamuel(draft.noteSamuel || "");
          setNoteIle(draft.noteIle || "");
          setPhotosWithAuthor(draft.photosWithAuthor || []);
          setHasRestoredDraft(true);
          isLoadedRef.current = true;
          return;
        } catch (err) {
          console.error("Error parsing saved draft:", err);
        }
      }

      // No draft found, load original/empty values
      setHasRestoredDraft(false);
      if (encounterToEdit) {
        setDate(encounterToEdit.date || "");
        setTitle(encounterToEdit.title || "");
        setNote(encounterToEdit.note || "");
        setNoteSamuel(encounterToEdit.noteSamuel || "");
        setNoteIle(encounterToEdit.noteIle || "");
        
        if (encounterToEdit.photosWithAuthor && encounterToEdit.photosWithAuthor.length > 0) {
          setPhotosWithAuthor(encounterToEdit.photosWithAuthor);
        } else if (encounterToEdit.photos && encounterToEdit.photos.length > 0) {
          // Fallback migration: default to Samuel
          setPhotosWithAuthor(
            encounterToEdit.photos.map((url) => ({ url, uploadedBy: "Samuel" }))
          );
        } else {
          setPhotosWithAuthor([]);
        }
      } else {
        const today = new Date();
        setDate(today.toISOString().split("T")[0]);
        setTitle("");
        setNote("");
        setNoteSamuel("");
        setNoteIle("");
        setPhotosWithAuthor([]);
      }
      isLoadedRef.current = true;
    } else {
      isLoadedRef.current = false;
      setHasRestoredDraft(false);
    }
  }, [encounterToEdit, isOpen]);

  // Save state to localStorage on changes, once state is fully initialized/loaded
  useEffect(() => {
    if (!isOpen || !isLoadedRef.current) return;

    const hasContent = title.trim() || note.trim() || noteSamuel.trim() || noteIle.trim() || photosWithAuthor.length > 0;
    const key = encounterToEdit ? `bigincontri_draft_edit_${encounterToEdit.id}` : "bigincontri_draft_new";

    if (!hasContent) {
      localStorage.removeItem(key);
      setHasRestoredDraft(false);
      return;
    }

    const draftData = {
      date,
      title,
      note,
      noteSamuel,
      noteIle,
      photosWithAuthor,
    };

    try {
      localStorage.setItem(key, JSON.stringify(draftData));
    } catch (err) {
      console.warn("Storage draft failed (probably storage full):", err);
    }
  }, [date, title, note, noteSamuel, noteIle, photosWithAuthor, isOpen, encounterToEdit]);

  const handleResetDraft = () => {
    const key = encounterToEdit ? `bigincontri_draft_edit_${encounterToEdit.id}` : "bigincontri_draft_new";
    localStorage.removeItem(key);
    setHasRestoredDraft(false);

    // Restore original empty or to-edit values
    if (encounterToEdit) {
      setDate(encounterToEdit.date || "");
      setTitle(encounterToEdit.title || "");
      setNote(encounterToEdit.note || "");
      setNoteSamuel(encounterToEdit.noteSamuel || "");
      setNoteIle(encounterToEdit.noteIle || "");
      
      if (encounterToEdit.photosWithAuthor && encounterToEdit.photosWithAuthor.length > 0) {
        setPhotosWithAuthor(encounterToEdit.photosWithAuthor);
      } else if (encounterToEdit.photos && encounterToEdit.photos.length > 0) {
        setPhotosWithAuthor(
          encounterToEdit.photos.map((url) => ({ url, uploadedBy: "Samuel" }))
        );
      } else {
        setPhotosWithAuthor([]);
      }
    } else {
      const today = new Date();
      setDate(today.toISOString().split("T")[0]);
      setTitle("");
      setNote("");
      setNoteSamuel("");
      setNoteIle("");
      setPhotosWithAuthor([]);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const itemsToUpload: UploadQueueItem[] = [];
    
    // Add all files to the uploading queue in compressing state
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempId = Math.random().toString(36).substring(2, 9);
      itemsToUpload.push({
        id: tempId,
        name: file.name,
        status: "compressing",
        uploadedBy: currentUser,
        progressText: "Compressione immagine...",
      });
    }

    setUploadQueue((prev) => [...prev, ...itemsToUpload]);

    // Process each file in the queue
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const queueItem = itemsToUpload[i];

      try {
        // Step 1: Compress image
        const compressedBase64 = await compressImage(file, 600, 600, 0.7);
        
        // Update status to uploading
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === queueItem.id
              ? { ...item, status: "uploading", progressText: "Caricamento in corso..." }
              : item
          )
        );

        // Step 2: Upload with multi-fallback logic
        const folderPath = `meetings/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
        const finalUrl = await uploadImageToStorage(compressedBase64, folderPath);

        // Update status to completed with the URL
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === queueItem.id
              ? {
                  ...item,
                  status: "completed",
                  progressText: "Foto caricata con successo!",
                  url: finalUrl,
                }
              : item
          )
        );

        // Automatically add to photos list immediately!
        setPhotosWithAuthor((prev) => [
          ...prev,
          {
            url: finalUrl,
            uploadedBy: currentUser,
          },
        ]);
        addSystemLog("success", `👦👧 Foto aggiunta automaticamente ai ricordi.`);
      } catch (err: any) {
        console.error("Upload process failed:", err);
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === queueItem.id
              ? {
                  ...item,
                  status: "error",
                  progressText: `Errore: ${err.message || "Generazione link fallita"}`,
                }
              : item
          )
        );
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeQueueItem = (id: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
    addSystemLog("info", `[Uploader] Elemento rimosso dalla coda.`);
  };

  const copyToClipboard = (url: string, itemId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedIndex(itemId);
    setTimeout(() => setCopiedIndex(null), 2000);
    addSystemLog("info", `[Clipboard] Link copiato negli appunti.`);
  };

  const removePhoto = (index: number) => {
    setPhotosWithAuthor((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEmojiClick = (emoji: string) => {
    setTitle((prev) => prev + " " + emoji);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    setIsSubmitting(true);
    try {
      const simplePhotos = photosWithAuthor.map((p) => p.url);
      await onSave({
        id: encounterToEdit?.id,
        date,
        title: title.trim(),
        note: note.trim(),
        noteSamuel: noteSamuel.trim(),
        noteIle: noteIle.trim(),
        photos: simplePhotos,
        photosWithAuthor,
      });

      // Clear draft on successful save
      const key = encounterToEdit ? `bigincontri_draft_edit_${encounterToEdit.id}` : "bigincontri_draft_new";
      localStorage.removeItem(key);
      setHasRestoredDraft(false);

      // Reset form
      setTitle("");
      setNote("");
      setNoteSamuel("");
      setNoteIle("");
      setPhotosWithAuthor([]);
      onClose();
    } catch (err) {
      console.error("Error saving encounter:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!encounterToEdit;

  if (!isOpen) return null;

  return createPortal(
    <div 
      id="add-encounter-overlay" 
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="add-encounter-panel"
        className="w-full max-w-md bg-white rounded-2xl max-h-[85vh] shadow-2xl border border-brand-100 flex flex-col overflow-hidden transition-all duration-300 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100 bg-brand-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-500" />
            <h3 className="font-bold text-brand-950 text-base font-display">
              {isEditing ? "Modifica Incontro" : "Aggiungi Incontro"}
            </h3>
          </div>
          <button
            id="close-add-modal"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-brand-50 text-brand-400 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form with inner scroll structure */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* Scrollable Content Area */}
          <div className="p-6 space-y-5 flex-1 overflow-y-auto">
            {/* Active draft banner */}
            {hasRestoredDraft && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-2.5 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-amber-950">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                  <div>
                    <p className="font-bold text-[11px] uppercase tracking-wider">Bozza ripristinata automaticamente 🙂</p>
                    <p className="text-[10px] text-amber-700 font-medium">I tuoi testi e le deine foto sono al sicuro!</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-[9px] uppercase tracking-widest rounded-xl transition cursor-pointer active:scale-95 shrink-0"
                >
                  Ricomincia 🗑️
                </button>
              </div>
            )}
            
            {/* Date Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-900 flex items-center gap-1.5 uppercase tracking-wider">
                <CalendarIcon className="w-3.5 h-3.5 text-brand-500" />
                Quando vi siete visti?
              </label>
              <input
                id="encounter-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-brand-50/50 border border-brand-100 rounded-xl text-brand-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition"
              />
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-900 flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-brand-500" />
                Cosa avete fatto? (Titolo)
              </label>
              <input
                id="encounter-title"
                type="text"
                required
                placeholder="E.g. Pomeriggio al mare, Cinema insieme, Cena stellata..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-brand-50/50 border border-brand-100 rounded-xl text-brand-900 text-sm placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition"
              />
              {/* Quick emoji helper */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {PRESET_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    className="w-7 h-7 flex items-center justify-center text-xs bg-brand-50 hover:bg-brand-100 rounded-lg active:scale-90 transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Shared Note / Story */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-900 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                La Nostra Storia / Nota Condivisa
              </label>
              <textarea
                id="encounter-note"
                placeholder="Un riassunto generale o descrizione di quello che avete fatto insieme... (Premi Invio se desideri andare a capo e creare dello spazio)"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-3 bg-brand-50/50 border border-brand-100 rounded-xl text-brand-900 text-sm placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition resize-y min-h-[90px]"
              />
            </div>

            {/* Co-authoring Split Blocks */}
            <div className="border-t border-brand-100 pt-4 space-y-4">
              <h4 className="text-xs font-extrabold text-brand-800 uppercase tracking-widest flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-brand-500 fill-brand-200" />
                I Vostri Pensieri Personali (Co-Autori)
              </h4>
              
              {/* Samuel's Thought Field */}
              <div className={`p-4 rounded-2xl border transition ${
                currentUser === "Samuel" 
                  ? "bg-sky-50/70 border-sky-200 ring-1 ring-sky-300" 
                  : "bg-brand-50/30 border-brand-100"
              }`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs font-bold text-sky-700 flex items-center gap-1">
                    👦 Il pensiero di Samuel
                  </span>
                  {currentUser === "Samuel" && (
                    <span className="text-[10px] bg-sky-500 text-white font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      Tu
                    </span>
                  )}
                </div>
                <textarea
                  id="encounter-note-samuel"
                  disabled={currentUser !== "Samuel"}
                  placeholder={
                    currentUser === "Samuel"
                      ? "Samuel, aggiungi il tuo pensiero... (Premi Invio per lasciare dello spazio)"
                      : "Ancora nessun pensiero da parte di Samuel."
                  }
                  rows={3}
                  value={noteSamuel}
                  onChange={(e) => setNoteSamuel(e.target.value)}
                  className="w-full p-2 bg-white/90 border border-brand-100 rounded-lg text-brand-900 text-xs placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-sky-400 transition resize-y"
                />
              </div>

              {/* Ilenia's Thought Field */}
              <div className={`p-4 rounded-2xl border transition ${
                currentUser === "Ile" 
                  ? "bg-rose-50/70 border-rose-200 ring-1 ring-rose-300" 
                  : "bg-brand-50/30 border-brand-100"
              }`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                    👧 Il pensiero di Ilenia
                  </span>
                  {currentUser === "Ile" && (
                    <span className="text-[10px] bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      Tu
                    </span>
                  )}
                </div>
                <textarea
                  id="encounter-note-ile"
                  disabled={currentUser !== "Ile"}
                  placeholder={
                    currentUser === "Ile"
                      ? "Ilenia, aggiungi il tuo pensiero... (Premi Invio per lasciare dello spazio)"
                      : "Ancora nessun pensiero da parte di Ilenia."
                  }
                  rows={3}
                  value={noteIle}
                  onChange={(e) => setNoteIle(e.target.value)}
                  className="w-full p-2 bg-white/90 border border-brand-100 rounded-lg text-brand-900 text-xs placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-rose-400 transition resize-y"
                />
              </div>
            </div>

            {/* Gallery Upload */}
            <div className="space-y-4 border-t border-brand-100 pt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-brand-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Camera className="w-3.5 h-3.5 text-brand-500" />
                  Foto del Giorno (Confermate)
                </label>
                <span className="text-[10px] text-brand-400">
                  {photosWithAuthor.length} {photosWithAuthor.length === 1 ? "foto" : "foto"} nel ricordo
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {/* Photo Previews with Author Distinction */}
                {photosWithAuthor.map((photo, index) => {
                  const isSamuel = photo.uploadedBy === "Samuel";
                  return (
                    <div
                      key={index}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 group shadow-sm bg-brand-50 transition ${
                        isSamuel ? "border-sky-300" : "border-rose-300"
                      }`}
                    >
                      <img src={photo.url} alt="Preview" className="w-full h-full object-cover" />
                      
                      {/* Small tag showing who uploaded */}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5 text-center text-[8px] text-white font-semibold">
                        {isSamuel ? "👦 Samuel" : "👧 Ile"}
                      </div>

                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500/90 text-white rounded-full hover:bg-red-600 transition shadow z-10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}

                {/* Upload Trigger Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-brand-200 hover:border-brand-400 rounded-xl text-brand-400 hover:text-brand-500 hover:bg-brand-50/20 active:scale-95 transition cursor-pointer"
                >
                  <Plus className="w-5 h-5 mb-0.5 text-brand-400" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Aggiungi</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              
              {/* Real-time Uploading Queue (Link Generator) */}
              {uploadQueue.length > 0 && (
                <div className="space-y-2 border border-brand-100 bg-brand-50/30 rounded-xl p-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-1.5 border-b border-brand-100 pb-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <h5 className="text-[11px] font-extrabold text-brand-900 uppercase tracking-widest">
                      Coda di Generazione Link ({uploadQueue.length})
                    </h5>
                  </div>
                  
                  <div className="space-y-2.5">
                    {uploadQueue.map((item) => {
                      const isCompleted = item.status === "completed";
                      const isError = item.status === "error";
                      const isProcessing = item.status === "compressing" || item.status === "uploading";

                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl border text-xs space-y-2 transition ${
                            isCompleted
                              ? "bg-emerald-50/40 border-emerald-100"
                              : isError
                              ? "bg-red-50/40 border-red-100"
                              : "bg-blue-50/40 border-blue-100"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <p className="font-semibold text-brand-950 truncate max-w-[180px]">{item.name}</p>
                              <p className="text-[10px] text-brand-500 font-medium flex items-center gap-1">
                                {isProcessing && <span className="w-2.5 h-2.5 border border-brand-500 border-t-transparent rounded-full animate-spin inline-block shrink-0" />}
                                {item.progressText}
                              </p>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => removeQueueItem(item.id)}
                              className="text-brand-400 hover:text-red-500 p-0.5 rounded transition shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* If completed, display the link and action buttons */}
                          {isCompleted && item.url && (
                            <div className="space-y-2 pt-1 border-t border-dashed border-emerald-100">
                              <div className="flex items-center gap-1.5 text-[10px] text-emerald-800 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Link generato con successo:</span>
                              </div>
                              
                              {/* Scrollable Link block */}
                              <div className="flex items-center gap-1 bg-white border border-emerald-100 p-1.5 rounded-lg">
                                <code className="text-[10px] text-brand-700 font-mono flex-1 truncate break-all select-all">
                                  {item.url}
                                </code>
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Copy Button */}
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(item.url!, item.id)}
                                    className="p-1 text-brand-500 hover:bg-brand-50 rounded transition"
                                    title="Copia link"
                                  >
                                    {copiedIndex === item.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  {/* External View */}
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 text-brand-500 hover:bg-brand-50 rounded transition flex items-center justify-center"
                                    title="Vedi foto"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live Terminal Logger Panel */}
              <div className="border border-zinc-800 bg-zinc-950 rounded-xl overflow-hidden font-mono text-[10px] text-zinc-300">
                <div className="bg-zinc-900 px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Uploader Terminal Log</span>
                  </div>
                  <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Live Logs</span>
                </div>
                <div className="p-3 max-h-[110px] overflow-y-auto space-y-1.5 select-text">
                  {debugLogs.length === 0 ? (
                    <p className="text-zinc-600 italic">Pronto per caricare immagini... Seleziona uno o più file.</p>
                  ) : (
                    debugLogs.map((log, idx) => {
                      let typeColor = "text-zinc-400";
                      if (log.type === "success") typeColor = "text-emerald-400 font-semibold";
                      if (log.type === "warn") typeColor = "text-amber-400";
                      if (log.type === "error") typeColor = "text-rose-400 font-bold";
                      return (
                        <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                          <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                          <span className={typeColor}>{log.text}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <p className="text-[10px] text-brand-400">Le foto vengono caricate a nome di <strong className="text-brand-600">{currentUser === "Samuel" ? "Samuel 👦" : "Ile 👧"}</strong>.</p>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="p-4 border-t border-brand-100 bg-brand-50/30 shrink-0">
            <button
              id="save-encounter-submit"
              type="submit"
              disabled={isSubmitting || !title.trim() || isCompressing}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-brand-200 active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvataggio in corso...
                </span>
              ) : isEditing ? (
                "Salva Modifiche ✏️"
              ) : (
                "Salva Ricordo ✨"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
