// Registry of supported languages.
//
// `ui` = a full UI dictionary ships for this language (en/hi/mr today).
// Every language is still fully usable for VOICE input (speechLocale, used by
// the browser SpeechRecognition API) and for PA ANNOUNCEMENTS (announceName,
// passed to the backend LLM) - so the *data* path is multilingual for all of
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
  { code: "bn", label: "বাংলা", speechLocale: "bn-IN", announceName: "Bengali", ui: true },
  { code: "ta", label: "தமிழ்", speechLocale: "ta-IN", announceName: "Tamil", ui: true },
  { code: "te", label: "తెలుగు", speechLocale: "te-IN", announceName: "Telugu", ui: true },
  { code: "gu", label: "ગુજરાતી", speechLocale: "gu-IN", announceName: "Gujarati", ui: true },
  { code: "kn", label: "ಕನ್ನಡ", speechLocale: "kn-IN", announceName: "Kannada", ui: true },
  { code: "ml", label: "മലയാളം", speechLocale: "ml-IN", announceName: "Malayalam", ui: true },
  { code: "pa", label: "ਪੰਜਾਬੀ", speechLocale: "pa-IN", announceName: "Punjabi", ui: true },
  { code: "or", label: "ଓଡ଼ିଆ", speechLocale: "or-IN", announceName: "Odia", ui: true },
  { code: "as", label: "অসমীয়া", speechLocale: "as-IN", announceName: "Assamese", ui: true },
  { code: "ur", label: "اردو", speechLocale: "ur-IN", announceName: "Urdu", ui: true, rtl: true },
];

export function langByCode(code: string): LangDef {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}
