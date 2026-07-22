import React from "react";
import { History, Calendar, Heart, Image, PlusCircle, Settings, Shirt } from "lucide-react";

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAddModal: () => void;
}

export default function BottomNav({ activeTab, setActiveTab, onOpenAddModal }: BottomNavProps) {
  const tabs = [
    { id: "incontri", label: "Incontri", icon: History },
    { id: "gallery", label: "Galleria", icon: Image },
    { id: "lookbook", label: "Look & Posti", icon: Shirt },
    { id: "add", label: "Nuovo", icon: PlusCircle, isMiddle: true },
    { id: "calendar", label: "Date", icon: Calendar },
    { id: "board", label: "Bacheca", icon: Heart },
    { id: "settings", label: "Impostazioni", icon: Settings },
  ];

  return (
    <div id="bottom-nav" className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-t border-brand-100 shadow-lg px-2 pb-safe">
      <div className="max-w-md mx-auto flex justify-between items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isMiddle) {
            return (
              <button
                id="add-nav-btn"
                key={tab.id}
                onClick={onOpenAddModal}
                className="relative -top-4 flex flex-col items-center justify-center bg-brand-500 hover:bg-brand-600 active:scale-95 text-white w-14 h-14 rounded-full shadow-lg shadow-brand-400/50 transition-all duration-200"
                aria-label="Aggiungi nuovo incontro"
              >
                <Icon className="w-7 h-7" />
              </button>
            );
          }

          return (
            <button
              id={`nav-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 transition-all duration-200 ${
                isActive ? "text-brand-600 scale-105" : "text-brand-400 hover:text-brand-500"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
              <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-brand-600 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
