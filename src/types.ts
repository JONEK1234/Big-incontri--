export interface EncounterPhoto {
  url: string;
  uploadedBy: string; // "Samuel" | "Ile"
}

export interface Encounter {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  note: string; // Shared or general note
  noteSamuel?: string; // Samuel's personal note/dedication
  noteIle?: string; // Ilenia's personal note/dedication
  photos: string[]; // Base64 or image URLs (fallback)
  photosWithAuthor?: EncounterPhoto[]; // Photos tagged with who uploaded them
  stickers?: string[]; // Custom stickers added to the encounter
  createdAt: string;
}

export interface SpecialDate {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  type: "anniversary" | "special_date" | "milestone";
}

export interface LoveMessage {
  id: string;
  sender: string; // "Samuel" | "Ilenia"
  text: string;
  timestamp: string;
}

export interface Sticker {
  id: string;
  url: string;
  title?: string;
  uploadedBy: string; // "Samuel" | "Ilenia"
  associatedMeetingIds: string[]; // IDs of encounters this sticker is associated with
  createdAt: string;
}

