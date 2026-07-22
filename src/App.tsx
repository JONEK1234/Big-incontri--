import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "./firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { Encounter, SpecialDate, LoveMessage, EncounterPhoto, Sticker, LookbookItem } from "./types";
import BottomNav from "./components/BottomNav";
import UserSelector from "./components/UserSelector";
import EncounterList from "./components/EncounterList";
import AddEncounterModal from "./components/AddEncounterModal";
import CalendarView from "./components/CalendarView";
import LoveBoard from "./components/LoveBoard";
import PhotoGallery from "./components/PhotoGallery";
import LookbookView from "./components/LookbookView";
import SettingsView from "./components/SettingsView";
import { Heart, Sparkles, AlertCircle } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<string>(() => {
    try {
      return localStorage.getItem("big_incontri_user") || "Samuel";
    } catch (e) {
      console.warn("Storage access not available:", e);
      return "Samuel";
    }
  });

  const [activeTab, setActiveTab] = useState<string>("incontri");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [encounterToEdit, setEncounterToEdit] = useState<Encounter | null>(null);

  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [lookbookItems, setLookbookItems] = useState<LookbookItem[]>([]);
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  const [loveMessages, setLoveMessages] = useState<LoveMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync user selection to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("big_incontri_user", currentUser);
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }, [currentUser]);

  // Firestore real-time sync for Encounters
  useEffect(() => {
    const q = query(collection(db, "meetings"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Encounter[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          date: data.date || "",
          title: data.title || "",
          note: data.note || "",
          noteSamuel: data.noteSamuel || "",
          noteIle: data.noteIle || "",
          photos: data.photos || [],
          photosWithAuthor: data.photosWithAuthor || [],
          stickers: data.stickers || [],
          createdAt: data.createdAt || "",
        });
      });
      setEncounters(list);
      setIsLoading(false);

      // If empty, auto-seed some initial cute examples so the app isn't blank
      if (snapshot.empty && !isLoading) {
        seedInitialData();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "meetings");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Firestore real-time sync for Special Dates
  useEffect(() => {
    const q = query(collection(db, "special_dates"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SpecialDate[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          date: data.date || "",
          title: data.title || "",
          description: data.description || "",
          type: data.type || "special_date",
        });
      });
      setSpecialDates(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "special_dates");
    });

    return () => unsubscribe();
  }, []);

  // Firestore real-time sync for Love Messages
  useEffect(() => {
    const q = query(collection(db, "love_messages"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: LoveMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          sender: data.sender || "",
          text: data.text || "",
          timestamp: data.timestamp || "",
        });
      });
      setLoveMessages(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "love_messages");
    });

    return () => unsubscribe();
  }, []);

  // Firestore real-time sync for Stickers
  useEffect(() => {
    const q = query(collection(db, "stickers"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Sticker[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          url: data.url || "",
          title: data.title || "",
          uploadedBy: data.uploadedBy || "",
          associatedMeetingIds: data.associatedMeetingIds || [],
          createdAt: data.createdAt || "",
        });
      });
      setStickers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "stickers");
    });

    return () => unsubscribe();
  }, []);

  // Firestore real-time sync for Lookbook Items (Samu look, Ile look, Place)
  useEffect(() => {
    const q = query(collection(db, "lookbook_items"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: LookbookItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          category: data.category || "samu_look",
          url: data.url || "",
          title: data.title || "",
          uploadedBy: data.uploadedBy || "",
          createdAt: data.createdAt || "",
        });
      });
      setLookbookItems(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "lookbook_items");
    });

    return () => unsubscribe();
  }, []);

  // Auto-seed initial warm welcome data for Samuel & Ilenia if database collections are brand new
  const seedInitialData = async () => {
    try {
      // 1. Add first meeting
      await addDoc(collection(db, "meetings"), {
        date: "2025-07-07",
        title: "Il nostro primo giorno speciale! 🌟",
        note: "Questo è il giorno in cui tutto è iniziato. Un anno fa, il 7 luglio 2025, è nata la nostra splendida amicizia! Che avventura fantastica.",
        photos: [], // Empty initially, they can add their own
        createdAt: new Date().toISOString(),
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, "meetings"));

      // 2. Add anniversary special date
      await addDoc(collection(db, "special_dates"), {
        date: "2025-07-07",
        title: "Anniversario dell'Amicizia 💙",
        description: "Il giorno in cui ci siamo conosciuti e abbiamo iniziato questo fantastico cammino insieme!",
        type: "anniversary",
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, "special_dates"));

      // 3. Add a sticky greeting note
      await addDoc(collection(db, "love_messages"), {
        sender: "Samuel",
        text: "Benvenuta nella nostra bacheca personale! Lasciamo qui tutte le nostre dediche speciali ✨",
        timestamp: new Date().toISOString(),
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, "love_messages"));
    } catch (e) {
      console.error("Error seeding initial data:", e);
    }
  };

  // Save handers
  const handleSaveEncounter = async (enc: {
    id?: string;
    date: string;
    title: string;
    note: string;
    noteSamuel?: string;
    noteIle?: string;
    photos: string[];
    photosWithAuthor?: EncounterPhoto[];
  }) => {
    try {
      if (enc.id) {
        const encounterRef = doc(db, "meetings", enc.id);
        await updateDoc(encounterRef, {
          date: enc.date,
          title: enc.title,
          note: enc.note,
          noteSamuel: enc.noteSamuel || "",
          noteIle: enc.noteIle || "",
          photos: enc.photos || [],
          photosWithAuthor: enc.photosWithAuthor || [],
        }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `meetings/${enc.id}`));
      } else {
        await addDoc(collection(db, "meetings"), {
          date: enc.date,
          title: enc.title,
          note: enc.note,
          noteSamuel: enc.noteSamuel || "",
          noteIle: enc.noteIle || "",
          photos: enc.photos || [],
          photosWithAuthor: enc.photosWithAuthor || [],
          stickers: [],
          createdAt: new Date().toISOString(),
        }).catch((err) => handleFirestoreError(err, OperationType.CREATE, "meetings"));
      }
    } catch (err) {
      console.error("Failed to save encounter:", err);
      alert("Errore durante il salvataggio dell'incontro.");
    }
  };

  const handleDeleteEncounter = async (id: string) => {
    try {
      await deleteDoc(doc(db, "meetings", id)).catch((err) => handleFirestoreError(err, OperationType.DELETE, `meetings/${id}`));
    } catch (err) {
      console.error("Failed to delete encounter:", err);
    }
  };

  const handleAddSpecialDate = async (sd: { date: string; title: string; description: string; type: "anniversary" | "special_date" | "milestone" }) => {
    try {
      await addDoc(collection(db, "special_dates"), {
        ...sd,
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, "special_dates"));
    } catch (err) {
      console.error("Failed to add special date:", err);
    }
  };

  const handleDeleteSpecialDate = async (id: string) => {
    try {
      await deleteDoc(doc(db, "special_dates", id)).catch((err) => handleFirestoreError(err, OperationType.DELETE, `special_dates/${id}`));
    } catch (err) {
      console.error("Failed to delete special date:", err);
    }
  };

  const handleSendLoveMessage = async (text: string) => {
    try {
      await addDoc(collection(db, "love_messages"), {
        sender: currentUser,
        text,
        timestamp: new Date().toISOString(),
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, "love_messages"));
    } catch (err) {
      console.error("Failed to send love message:", err);
    }
  };

  const handleDeleteLoveMessage = async (id: string) => {
    try {
      await deleteDoc(doc(db, "love_messages", id)).catch((err) => handleFirestoreError(err, OperationType.DELETE, `love_messages/${id}`));
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "incontri":
        return (
          <EncounterList
            encounters={encounters}
            stickers={stickers}
            lookbookItems={lookbookItems}
            onDelete={handleDeleteEncounter}
            onEdit={(encounter) => {
              setEncounterToEdit(encounter);
              setIsAddModalOpen(true);
            }}
            currentUser={currentUser}
            onNavigateToLookbook={() => setActiveTab("lookbook")}
          />
        );
      case "gallery":
        return <PhotoGallery encounters={encounters} currentUser={currentUser} />;
      case "lookbook":
        return (
          <LookbookView
            lookbookItems={lookbookItems}
            currentUser={currentUser}
          />
        );
      case "calendar":
        return (
          <CalendarView
            specialDates={specialDates}
            encounters={encounters}
            onAddSpecialDate={handleAddSpecialDate}
            onDeleteSpecialDate={handleDeleteSpecialDate}
          />
        );
      case "board":
        return (
          <LoveBoard
            messages={loveMessages}
            onSendMessage={handleSendLoveMessage}
            onDeleteMessage={handleDeleteLoveMessage}
            currentUser={currentUser}
          />
        );
      case "settings":
        return <SettingsView encounters={encounters} stickers={stickers} lookbookItems={lookbookItems} />;
      default:
        return null;
    }
  };

  return (
    <div id="app-frame" className="min-h-screen bg-sky-50 flex justify-center items-stretch font-sans antialiased">
      {/* Mobile-centric centered frame */}
      <div id="mobile-viewport" className="w-full max-w-md bg-brand-50 shadow-2xl border-x border-brand-100 flex flex-col pb-24 relative overflow-x-hidden min-h-screen">
        
        {/* Sticky App Header */}
        <header id="app-header" className="sticky top-0 z-40 bg-white/85 backdrop-blur-md px-5 py-4 border-b border-brand-100/60 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white shadow-sm shadow-brand-200">
              <Heart className="w-5 h-5 fill-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black font-display text-brand-950 tracking-tight">Big incontri</h1>
              <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">Samuel & Ilenia</p>
            </div>
          </div>
          
          {/* Active sync indicator */}
          <div className="flex items-center gap-1.5 bg-brand-100 text-brand-700 px-2.5 py-1 rounded-full text-[10px] font-bold">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
            <span>Real-time Sync</span>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main id="app-main" className="flex-1 px-4 py-5 overflow-y-auto space-y-5">
          {/* Profile Switcher at Top */}
          <UserSelector currentUser={currentUser} setCurrentUser={setCurrentUser} />

          {/* Loader */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-brand-500 font-medium">Caricamento dei vostri ricordi...</p>
            </div>
          ) : (
            <div className="page-transition-enter page-transition-enter-active">
              {renderActiveTab()}
            </div>
          )}
        </main>

        {/* Bottom Nav Bar */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onOpenAddModal={() => setIsAddModalOpen(true)}
        />

        {/* Global Modal to Add/Edit Encounter */}
        <AddEncounterModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setEncounterToEdit(null);
          }}
          onSave={handleSaveEncounter}
          currentUser={currentUser}
          encounterToEdit={encounterToEdit}
        />
      </div>
    </div>
  );
}
