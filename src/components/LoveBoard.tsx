import React, { useState } from "react";
import { LoveMessage } from "../types";
import { Heart, Send, Trash2, Smile } from "lucide-react";

interface LoveBoardProps {
  messages: LoveMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onDeleteMessage: (id: string) => Promise<void>;
  currentUser: string;
}

const PRESET_LOVE_NOTES = [
  "Ti voglio un bene infinito! 💙",
  "Grazie per essere sempre al mio fianco! ✨",
  "Il prossimo incontro deve essere pazzesco! 🍕🍿",
  "Sei la mia persona preferita! 👦👧",
  "Insieme siamo imbattibili! 🚀",
  "Un abbraccio virtuale fortissimo! 🤗",
  "Mi manchi! Quando ci vediamo? 📅"
];

export default function LoveBoard({
  messages,
  onSendMessage,
  onDeleteMessage,
  currentUser,
}: LoveBoardProps) {
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsSending(true);
    try {
      await onSendMessage(inputText);
      setInputText("");
    } catch (err) {
      console.error("Error sending note to board:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handlePresetClick = (note: string) => {
    setInputText(note);
  };

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-6">
      {/* 1. Simple Note Input Card */}
      <div className="bg-white rounded-3xl border border-brand-100 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-brand-950 text-lg font-display flex items-center gap-2">
          <Heart className="w-5 h-5 text-brand-500 fill-brand-200" />
          Bacheca delle Dediche
        </h3>
        <p className="text-xs text-brand-600 leading-normal">
          Lascia qui una nota dolce per l'altro. Se vuoi creare ordine o lasciare dello spazio tra le righe, ti basta premere Invio per andare a capo e creare tutto lo spazio che desideri!
        </p>

        {/* Form with Textarea */}
        <form onSubmit={handleSend} className="space-y-4">
          <div className="relative">
            <textarea
              id="love-message-input"
              rows={3}
              required
              placeholder={`Scrivi un pensiero dolce... Premi Invio per lasciare dello spazio se vuoi creare ordine.`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full px-4 py-3 bg-brand-50/50 border border-brand-100 rounded-2xl text-brand-900 text-sm placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition resize-y pr-12 min-h-[80px]"
            />
            <button
              id="love-message-submit"
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="absolute bottom-3 right-3 p-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white rounded-xl transition cursor-pointer shadow-sm"
              title="Invia dedica"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Quick presets for messages */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-brand-800 uppercase tracking-wider block">Suggerimenti rapidi:</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none snap-x">
              {PRESET_LOVE_NOTES.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => handlePresetClick(note)}
                  className="flex-shrink-0 snap-center bg-brand-50 hover:bg-brand-100 text-[11px] text-brand-800 font-medium px-2.5 py-1 rounded-xl transition"
                >
                  {note}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>

      {/* 2. Message Board Feed */}
      <div className="space-y-4">
        {sortedMessages.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-3xl border border-brand-100 shadow-sm space-y-2">
            <Smile className="w-10 h-10 text-brand-300 mx-auto animate-bounce" />
            <p className="text-sm text-brand-500 font-medium">Ancora nessun pensiero... scrivete il primo! 🥰</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {sortedMessages.map((msg) => {
              const isFromSamuel = msg.sender === "Samuel";
              const noteColor = isFromSamuel
                ? "bg-gradient-to-br from-blue-50 to-sky-100 border-sky-200"
                : "bg-gradient-to-br from-teal-50 to-brand-100/60 border-brand-200";

              return (
                <div
                  id={`message-sticky-${msg.id}`}
                  key={msg.id}
                  className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between min-h-36 relative hover:scale-[1.02] transition duration-200 ${noteColor}`}
                >
                  {/* Pin Circle effect */}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border border-brand-200 shadow-inner" />
                  
                  {/* Delete button */}
                  <button
                    id={`delete-sticky-${msg.id}`}
                    onClick={() => {
                      if (window.confirm("Vuoi cancellare questa dedica?")) {
                        onDeleteMessage(msg.id);
                      }
                    }}
                    className="absolute top-2 right-2 text-brand-400 hover:text-red-500 p-1 rounded-full transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* NOTE TEXT PRESERVING WHITE SPACE AND NEWLINES PERFECTLY */}
                  <p className="text-xs font-semibold text-brand-900 leading-relaxed font-sans pt-2 whitespace-pre-wrap break-words">
                    {msg.text}
                  </p>

                  <div className="border-t border-brand-100/50 mt-3 pt-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-brand-700 uppercase tracking-widest">
                      {isFromSamuel ? "👦 Samuel" : "👧 Ile"}
                    </span>
                    <span className="text-[9px] text-brand-400">
                      {new Date(msg.timestamp).toLocaleDateString("it-IT", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
