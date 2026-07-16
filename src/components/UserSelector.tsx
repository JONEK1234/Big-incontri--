import React from "react";
import { User, Users } from "lucide-react";

interface UserSelectorProps {
  currentUser: string;
  setCurrentUser: (user: string) => void;
}

export default function UserSelector({ currentUser, setCurrentUser }: UserSelectorProps) {
  return (
    <div id="user-selector" className="bg-gradient-to-r from-brand-100 to-sky-50 p-4 rounded-2xl border border-brand-100 flex items-center justify-between mb-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-brand-500 text-white rounded-xl shadow-md shadow-brand-200">
          <Users className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-brand-900 tracking-tight">Chi sta usando l'app?</h2>
          <p className="text-xs text-brand-600">Personalizza le tue dediche e messaggi</p>
        </div>
      </div>
      
      <div className="flex gap-2 bg-white/60 p-1 rounded-xl border border-brand-100">
        <button
          id="select-samuel"
          onClick={() => setCurrentUser("Samuel")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            currentUser === "Samuel"
              ? "bg-brand-500 text-white shadow-sm scale-105"
              : "text-brand-700 hover:bg-brand-50/50"
          }`}
        >
          👦 Samuel
        </button>
        <button
          id="select-ilenia"
          onClick={() => setCurrentUser("Ile")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            currentUser === "Ile"
              ? "bg-brand-500 text-white shadow-sm scale-105"
              : "text-brand-700 hover:bg-brand-50/50"
          }`}
        >
          👧 Ile
        </button>
      </div>
    </div>
  );
}
