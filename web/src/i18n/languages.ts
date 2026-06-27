// Registry of supported languages.
//
// `ui` = a full UI dictionary ships for this language (en/hi/mr today).
// Every language is still fully usable for VOICE input (speechLocale, used by
// the browser SpeechRecognition API) and for PA ANNOUNCEMENTS (announceName,
// passed to the backend LLM) — so the *data* path is multilingual for all of
// India even where the UI chrome falls back to English. Adding a UI language is
// just dropping a dictionary in ./dictionaries and flipping `ui: true`.

export interface LangDef {
  code: string;        // app language code
  label: string;       // native label shown in the switcher
  speechLocale: string; // BCP-47 tag for SpeechRecognition / TTS
  announceName: string; // language name sent to the announcement generator
  ui: boolean;
  rtl?: boolean;
}

export const LANGUAGES: LangDef[] = [
  { code: "en", label: "English", speechLocale: "en-IN", announceName: "English", ui: true },
  { code: "hi", label: "हिन्दी", speechLocale: "hi-IN", announceName: "Hindi", ui: true },
  { code: "mr", label: "मराठी", speechLocale: "mr-IN", announceName: "Marathi", ui: true },
  { code: "bn", label: "বাংলা", speechLocale: "bn-IN", announceName: "Bengali", ui: false },
  { code: "ta", label: "தமிழ்", speechLocale: "ta-IN", announceName: "Tamil", ui: false },
  { code: "te", label: "తెలుగు", speechLocale: "te-IN", announceName: "Telugu", ui: false },
  { code: "gu", label: "ગુજરાતી", speechLocale: "gu-IN", announceName: "Gujarati", ui: false },
  { code: "kn", label: "ಕನ್ನಡ", speechLocale: "kn-IN", announceName: "Kannada", ui: false },
  { code: "ml", label: "മലയാളം", speechLocale: "ml-IN", announceName: "Malayalam", ui: false },
  { code: "pa", label: "ਪੰਜਾਬੀ", speechLocale: "pa-IN", announceName: "Punjabi", ui: false },
  { code: "or", label: "ଓଡ଼ିଆ", speechLocale: "or-IN", announceName: "Odia", ui: false },
  { code: "as", label: "অসমীয়া", speechLocale: "as-IN", announceName: "Assamese", ui: false },
  { code: "ur", label: "اردو", speechLocale: "ur-IN", announceName: "Urdu", ui: false, rtl: true },
];

export function langByCode(code: string): LangDef {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}
