"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, AlertCircle } from "lucide-react";
import { useI18n } from "@/i18n";

interface Props {
  // Called when the user stops; transcript may be "" if on-device STT is absent
  // (the audioBlob can then be sent to the server for transcription).
  onResult: (transcript: string, audioBlob: Blob | null) => void;
  onInterim?: (text: string) => void;
}

export function VoiceCapture({ onResult, onInterim }: Props) {
  const { t, speechLocale } = useI18n();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalRef = useRef("");

  useEffect(() => {
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAll() {
    try {
      recognitionRef.current?.stop();
    } catch {}
    try {
      if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    } catch {}
  }

  async function start() {
    setError(null);
    setInterim("");
    finalRef.current = "";
    chunksRef.current = [];

    // 1) Audio capture for the stored voice sample (best-effort).
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.start();
    } catch {
      // Mic blocked — we can still try on-device speech (which uses its own pipeline)
      // but warn the user the audio sample won't be saved.
      setError(t("intake.permMic"));
    }

    // 2) On-device speech-to-text (no network → works on 2G).
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.lang = speechLocale;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e: any) => {
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const tr = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalRef.current += tr + " ";
          else interimText += tr;
        }
        setInterim(interimText);
        onInterim?.(finalRef.current + interimText);
      };
      rec.onerror = (e: any) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") setError(t("intake.permMic"));
      };
      rec.onend = () => {
        // If still flagged listening, the engine ended early; finalize.
        if (listening) finish(stream);
      };
      recognitionRef.current = rec;
      rec.start();
    } else if (!mediaRef.current) {
      // Neither speech API nor mic available.
      setError(t("intake.noSpeech"));
    }
    setListening(true);
  }

  function finish(stream: MediaStream | null) {
    setListening(false);
    stopAll();
    const finalize = () => {
      const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type: "audio/webm" }) : null;
      stream?.getTracks().forEach((tk) => tk.stop());
      onResult(finalRef.current.trim(), blob);
    };
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.onstop = finalize;
      mediaRef.current.stop();
    } else {
      finalize();
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => (listening ? finish(null) : start())}
        className="relative grid place-items-center h-36 w-36 rounded-full focus:outline-none"
        aria-label={listening ? "stop" : "speak"}
      >
        {listening && (
          <>
            <span className="absolute inset-0 rounded-full bg-saffron-400/40 animate-pulsering" />
            <span className="absolute inset-0 rounded-full bg-saffron-400/30 animate-pulsering [animation-delay:0.6s]" />
          </>
        )}
        <span
          className={`relative grid place-items-center h-32 w-32 rounded-full shadow-lg transition ${
            listening ? "bg-red-600" : "bg-saffron-600"
          }`}
        >
          {listening ? <Square className="h-12 w-12 text-white" /> : <Mic className="h-14 w-14 text-white" />}
        </span>
      </button>
      <p className="font-semibold text-slate-700">{listening ? t("intake.listening") : t("intake.tapToSpeak")}</p>
      {interim && <p className="text-sm text-slate-500 italic max-w-sm text-center">“{interim}”</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-amber-700 max-w-sm text-center">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {!listening && <p className="text-xs text-slate-400 max-w-sm text-center">{t("intake.speakHint")}</p>}
    </div>
  );
}
