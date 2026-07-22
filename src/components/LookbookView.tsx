import React, { useState } from "react";
import { LookbookItem } from "../types";
import {
  Plus,
  Upload,
  Trash2,
  Sparkles,
  Shirt,
  UserCheck,
  MapPin,
  Eye,
  ChevronLeft,
  ChevronRight,
  Check,
  Smile,
  X,
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";

interface LookbookViewProps {
  lookbookItems: LookbookItem[];
  currentUser: string;
}

type CategoryType = "samu_look" | "ile_look" | "place";

export default function LookbookView({
  lookbookItems,
  currentUser,
}: LookbookViewProps) {
  const [activeTab, setActiveTab] = useState<CategoryType>("samu_look");
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedBy, setUploadedBy] = useState<string>(currentUser);
  const [isUploading, setIsUploading] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<LookbookItem | null>(null);
  const [addedStickerSuccessId, setAddedStickerSuccessId] = useState<string | null>(null);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Filter items for current category
  const filteredItems = lookbookItems.filter(
    (item) => item.category === activeTab
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (evt) => {
        setPreviewUrl(evt.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !previewUrl) {
      alert("Seleziona una foto prima di salvare!");
      return;
    }

    setIsUploading(true);

    try {
      let imageDataUrl = previewUrl;

      if (!imageDataUrl && selectedFile) {
        imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(selectedFile);
          reader.onload = (evt) => resolve(evt.target?.result as string);
          reader.onerror = (err) => reject(err);
        });
      }

      if (!imageDataUrl) {
        throw new Error("Impossibile caricare l'immagine");
      }

      // Save to Firestore
      await addDoc(collection(db, "lookbook_items"), {
        category: activeTab,
        url: imageDataUrl,
        title: newTitle.trim() || undefined,
        uploadedBy: uploadedBy || currentUser,
        createdAt: new Date().toISOString(),
      });

      // Reset form
      setNewTitle("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsAddFormOpen(false);
    } catch (error) {
      console.error("Error saving lookbook item:", error);
      handleFirestoreError(error, OperationType.WRITE, "lookbook_items");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteItem = async (item: LookbookItem) => {
    try {
      await deleteDoc(doc(db, "lookbook_items", item.id));
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting lookbook item:", error);
      handleFirestoreError(error, OperationType.DELETE, `lookbook_items/${item.id}`);
    }
  };

  const handleCreateSticker = async (item: LookbookItem) => {
    try {
      const categoryLabel =
        item.category === "samu_look"
          ? "Samu Look"
          : item.category === "ile_look"
          ? "Ile Look"
          : "Place";

      await addDoc(collection(db, "stickers"), {
        url: item.url,
        title: item.title ? `${categoryLabel}: ${item.title}` : `Adesivo ${categoryLabel}`,
        uploadedBy: currentUser,
        associatedMeetingIds: [],
        createdAt: new Date().toISOString(),
      });

      setAddedStickerSuccessId(item.id);
      setTimeout(() => setAddedStickerSuccessId(null), 2500);
    } catch (error) {
      console.error("Error creating sticker from lookbook item:", error);
      handleFirestoreError(error, OperationType.WRITE, "stickers");
    }
  };

  // Lightbox navigation
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const nextLightbox = () => {
    if (lightboxIndex !== null && filteredItems.length > 0) {
      setLightboxIndex((lightboxIndex + 1) % filteredItems.length);
    }
  };

  const prevLightbox = () => {
    if (lightboxIndex !== null && filteredItems.length > 0) {
      setLightboxIndex(
        (lightboxIndex - 1 + filteredItems.length) % filteredItems.length
      );
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 50) {
      nextLightbox();
    } else if (diff < -50) {
      prevLightbox();
    }
    setTouchStartX(null);
  };

  const categories = [
    {
      id: "samu_look" as CategoryType,
      label: "Samu look",
      icon: Shirt,
      color: "bg-sky-50 text-sky-700 border-sky-200",
      activeColor: "bg-sky-600 text-white shadow-sm",
      count: lookbookItems.filter((i) => i.category === "samu_look").length,
    },
    {
      id: "ile_look" as CategoryType,
      label: "Ile look",
      icon: UserCheck,
      color: "bg-rose-50 text-rose-700 border-rose-200",
      activeColor: "bg-rose-600 text-white shadow-sm",
      count: lookbookItems.filter((i) => i.category === "ile_look").length,
    },
    {
      id: "place" as CategoryType,
      label: "Place",
      icon: MapPin,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      activeColor: "bg-emerald-600 text-white shadow-sm",
      count: lookbookItems.filter((i) => i.category === "place").length,
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. View Header Banner */}
      <div className="bg-white rounded-3xl border border-brand-100 p-5 shadow-sm space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-200/30 to-orange-200/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-brand-950 text-lg font-display">
              Look & Posti 📸
            </h3>
            <p className="text-xs text-brand-500 font-medium">
              Outfit di Samuel & Ilenia, e i vostri posti speciali
            </p>
          </div>
        </div>

        {/* Categories Tabs */}
        <div className="flex gap-2 overflow-x-auto pt-2 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveTab(cat.id);
                  setIsAddFormOpen(false);
                }}
                className={`flex-1 min-w-[105px] py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition duration-200 cursor-pointer ${
                  isActive
                    ? cat.activeColor
                    : "bg-brand-50/70 text-brand-700 border border-brand-100 hover:bg-brand-100/70"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-white/80 text-brand-600 border border-brand-100"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Add New Photo Button / Form */}
      {!isAddFormOpen ? (
        <button
          onClick={() => setIsAddFormOpen(true)}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white p-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition active:scale-[0.99] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-wider">
            Aggiungi Foto in{" "}
            {activeTab === "samu_look"
              ? "Samu look"
              : activeTab === "ile_look"
              ? "Ile look"
              : "Place"}
          </span>
        </button>
      ) : (
        <form
          onSubmit={handleSaveItem}
          className="bg-white border border-brand-100 p-5 rounded-3xl space-y-4 relative shadow-sm animate-in fade-in duration-200"
        >
          <button
            type="button"
            onClick={() => {
              setIsAddFormOpen(false);
              setPreviewUrl(null);
              setSelectedFile(null);
              setNewTitle("");
            }}
            className="absolute top-4 right-4 p-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 text-neutral-900">
            <Upload className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-black uppercase tracking-wider">
              Nuova Foto per{" "}
              {activeTab === "samu_look"
                ? "Samu look 👔"
                : activeTab === "ile_look"
                ? "Ile look 👗"
                : "Place 📍"}
            </h4>
          </div>

          {/* Title input */}
          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
              Titolo / Nome Outfit o Posto (Opzionale)
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={
                activeTab === "samu_look"
                  ? "Es: Giacca elegante grigia"
                  : activeTab === "ile_look"
                  ? "Es: Abito floreale primaverile"
                  : "Es: Caffè al centro storico"
              }
              className="w-full text-xs p-3 bg-brand-50/50 rounded-2xl border border-brand-100 focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-800"
            />
          </div>

          {/* Author Selector */}
          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
              Caricato da
            </label>
            <div className="flex gap-2">
              {["Samuel", "Ilenia"].map((user) => (
                <button
                  key={user}
                  type="button"
                  onClick={() => setUploadedBy(user)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    uploadedBy === user
                      ? user === "Samuel"
                        ? "bg-sky-500 text-white border-sky-600"
                        : "bg-rose-500 text-white border-rose-600"
                      : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                  }`}
                >
                  {user}
                </button>
              ))}
            </div>
          </div>

          {/* Photo Input & Preview */}
          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
              Seleziona Foto (Qualità Originale)
            </label>
            {previewUrl ? (
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/5 border border-neutral-200">
                <img
                  src={previewUrl}
                  alt="Anteprima"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(null);
                    setSelectedFile(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black cursor-pointer transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50/50 hover:bg-amber-100/50 cursor-pointer transition text-center group">
                <Upload className="w-6 h-6 text-amber-500 mb-2 group-hover:scale-110 transition" />
                <span className="text-xs font-bold text-amber-900">
                  Sfoglia o scatta foto
                </span>
                <span className="text-[9px] text-amber-600 mt-0.5 font-medium">
                  Formati supportati: JPG, PNG, WEBP
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Form submit button */}
          <button
            type="submit"
            disabled={isUploading || !previewUrl}
            className="w-full py-3 bg-neutral-900 hover:bg-black text-white rounded-2xl text-xs font-bold disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Salva Foto in {activeTab === "samu_look" ? "Samu look" : activeTab === "ile_look" ? "Ile look" : "Place"}</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* 3. Grid of Items */}
      {filteredItems.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-3xl border border-brand-100 px-4 shadow-sm space-y-2">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center mb-1">
            <Sparkles className="w-6 h-6" />
          </div>
          <h4 className="text-xs font-black text-brand-900 uppercase tracking-wider">
            Nessuna foto ancora inserita
          </h4>
          <p className="text-[10px] text-brand-500 font-medium max-w-xs mx-auto">
            Aggiungi le tue foto preferite per{" "}
            {activeTab === "samu_look"
              ? "i look di Samuel"
              : activeTab === "ile_look"
              ? "i look di Ilenia"
              : "i vostri posti del cuore"}
            !
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {filteredItems.map((item, idx) => (
            <div
              key={item.id}
              className="group relative bg-white border border-brand-100 rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition duration-200 flex flex-col"
            >
              {/* Photo container */}
              <div
                onClick={() => openLightbox(idx)}
                className="aspect-square w-full bg-slate-900/5 relative cursor-pointer overflow-hidden"
              >
                <img
                  src={item.url}
                  alt={item.title || "Look or Place"}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                
                {/* Fullscreen Overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white drop-shadow-md" />
                </div>

                {/* Author badge */}
                <span
                  className={`absolute top-2.5 left-2.5 text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-xs backdrop-blur-md ${
                    item.uploadedBy === "Samuel"
                      ? "bg-sky-500/90 text-white"
                      : "bg-rose-500/90 text-white"
                  }`}
                >
                  {item.uploadedBy}
                </span>
              </div>

              {/* Info & Action Footer */}
              <div className="p-3 flex-1 flex flex-col justify-between gap-1.5 bg-white">
                {item.title ? (
                  <p className="text-[11px] font-extrabold text-brand-950 truncate" title={item.title}>
                    {item.title}
                  </p>
                ) : (
                  <p className="text-[10px] font-bold text-brand-400 italic">
                    Senza titolo
                  </p>
                )}

                <div className="flex items-center gap-1.5 pt-1.5 border-t border-brand-100/60">
                  {/* Create sticker button */}
                  <button
                    type="button"
                    onClick={() => handleCreateSticker(item)}
                    title="Crea Sticker da questa foto"
                    className="flex-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60 rounded-xl text-[9px] font-bold flex items-center justify-center gap-1 transition cursor-pointer active:scale-95"
                  >
                    {addedStickerSuccessId === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Creato!</span>
                      </>
                    ) : (
                      <>
                        <Smile className="w-3 h-3 text-amber-600" />
                        <span>Sticker</span>
                      </>
                    )}
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => setItemToDelete(item)}
                    title="Elimina"
                    className="p-1.5 text-brand-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {itemToDelete && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl text-center space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-neutral-900">
                Eliminare questa foto?
              </h4>
              <p className="text-xs text-neutral-500 mt-1 font-medium">
                L'operazione non può essere annullata.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleDeleteItem(itemToDelete)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-sm"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox for Lookbook Photos */}
      {lightboxIndex !== null && filteredItems[lightboxIndex] && (
        <div
          className="fixed inset-0 z-70 bg-black/95 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200"
          onClick={() => setLightboxIndex(null)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Lightbox Header */}
          <div className="p-4 flex items-center justify-between text-white z-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full border border-white/10">
                {activeTab === "samu_look"
                  ? "Samu look"
                  : activeTab === "ile_look"
                  ? "Ile look"
                  : "Place"}
              </span>
              <span className="text-xs text-white/60 font-medium">
                {lightboxIndex + 1} / {filteredItems.length}
              </span>
            </div>
            <button
              onClick={() => setLightboxIndex(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lightbox Image View */}
          <div className="flex-1 relative flex items-center justify-center p-2 sm:p-6 overflow-hidden">
            {filteredItems.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevLightbox();
                }}
                className="absolute left-2 sm:left-4 z-50 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/90 border border-white/20 transition cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={filteredItems[lightboxIndex].url}
              alt={filteredItems[lightboxIndex].title || "Lookbook Image"}
              className="max-h-full max-w-full object-contain select-none rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {filteredItems.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextLightbox();
                }}
                className="absolute right-2 sm:right-4 z-50 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/90 border border-white/20 transition cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Lightbox Footer Title */}
          <div className="p-4 bg-gradient-to-t from-black via-black/80 to-transparent text-center z-50">
            <p className="text-white text-sm font-extrabold">
              {filteredItems[lightboxIndex].title || "Foto senza titolo"}
            </p>
            <p className="text-[10px] text-white/60 font-medium mt-0.5">
              Caricato da {filteredItems[lightboxIndex].uploadedBy}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
