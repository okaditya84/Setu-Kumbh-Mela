"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, AlertCircle, Loader2, Cloud } from "lucide-react";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { IntakeDraft } from "@/lib/types";

interface Props {
  // Called when the user stops; transcript may be "" if transcription produced nothing.
  // The audioBlob is the recorded sample (uploaded by the parent to store on the case).
  onResult: (transcript: string, audioBlob: Blob | null) => void;
  onInterim?: (text: string) => void;
  // Called when the server STT returns a parsed draft → used to prefill the form.
  onServerDraft?: (draft: IntakeDraft) => void;
  // The case type, forwarded to the server STT endpoint for better parsing.
  caseType?: string;
  // Incrementing this stops listening immediately (e.g. parent pressed "Find matches").
  stopSignal?: number;
}

export function VoiceCapture({ onResult, onInterim, onServerDraft, caseType, stopSignal }: Props) {
  const { t, speechLocale } = useI18n();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const recognitionRef = useRef<any>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalRef = useRef("");
  const streamRef = useRef<MediaStream | null>(null);
  const listeningRef = useRef(false);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parent-driven stop (e.g. on submit). Ignore the initial mount value.
  const firstSignal = useRef(true);
  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    if (listeningRef.current) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSignal]);

  function setListeningState(v: boolean) {
    listeningRef.current = v;
    setListening(v);
  }

  function isOnline() {
    return typeof navigator === "undefined" || navigator.onLine;
  }

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
    setFinalText("");
    finalRef.current = "";
    chunksRef.current = [];

    // 1) Audio capture — this is the PRIMARY transcription source: the blob is
    //    sent to the server which auto-detects the spoken language.
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.start();
    } catch {
      // Mic blocked — warn the user.
      setError(t("intake.permMic"));
    }

    // 2) On-device speech-to-text: used for the LIVE CAPTION always, and as the
    //    transcription fallback only when offline / the server call fails.
    //    speechLocale is just a weak hint — it never decides the spoken language.
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.lang = speechLocale; // weak hint only
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
        setFinalText(finalRef.current);
        onInterim?.(finalRef.current + interimText);
      };
      rec.onerror = (e: any) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") setError(t("intake.permMic"));
      };
      rec.onend = () => {
        // IMPORTANT: do NOT stop the session here. In Brave/Safari the speech
        // service is blocked and fires onend immediately — that must not end the
        // recording. MediaRecorder owns the session; the server transcribes the
        // audio on stop. Just release the recognition handle.
        recognitionRef.current = null;
      };
      recognitionRef.current = rec;
      try {
        rec.start();
      } catch {
        recognitionRef.current = null;
      }
    } else if (!mediaRef.current) {
      // Neither speech API nor mic available.
      setError(t("intake.noSpeech"));
    }
    setListeningState(true);
    // Safety auto-stop so a forgotten recording can't run forever.
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = setTimeout(() => {
      if (listeningRef.current) finish();
    }, 45000);
  }

  function finish() {
    if (!listeningRef.current) return;
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    setListeningState(false);
    stopAll();
    const stream = streamRef.current;
    const finalize = () => {
      const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type: "audio/webm" }) : null;
      stream?.getTracks().forEach((tk) => tk.stop());
      streamRef.current = null;
      const onDeviceTranscript = finalRef.current.trim();

      // PRIMARY: send the audio to the server for auto-detected transcription.
      if (blob && isOnline()) {
        void serverTranscribe(blob, onDeviceTranscript);
        return;
      }
      // OFFLINE fallback: use whatever the on-device engine captured.
      onResult(onDeviceTranscript, blob);
    };
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.onstop = finalize;
      mediaRef.current.stop();
    } else {
      finalize();
    }
  }

  // Server transcription with language="" → backend auto-detects the spoken language.
  // `onDeviceTranscript` is the offline-captured text, used only if the server fails.
  async function serverTranscribe(blob: Blob, onDeviceTranscript: string) {
    setUploading(true);
    try {
      const res = await api.intakeVoice(blob, caseType, "");
      const transcript = (res.transcript || "").trim();
      if (transcript) {
        finalRef.current = transcript + " ";
        setFinalText(transcript);
        setInterim("");
      }
      // Prefill from the server-parsed draft when available.
      if (res.draft) onServerDraft?.(res.draft);
      if (!transcript && !res.stt_available && !onDeviceTranscript) {
        setError(t("intake.noSpeech"));
      }
      // Report the best transcript we have (server preferred, else on-device) + blob.
      onResult(transcript || onDeviceTranscript, blob);
    } catch {
      // Server failed → fall back to the on-device transcript if we have one.
      if (onDeviceTranscript) {
        onResult(onDeviceTranscript, blob);
      } else {
        setError(t("intake.noSpeech"));
        onResult("", blob);
      }
    } finally {
      setUploading(false);
    }
  }

  const caption = (finalText + (interim ? (finalText ? " " : "") + interim : "")).trim();

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => (listening ? finish() : start())}
        disabled={uploading}
        className="relative grid place-items-center h-36 w-36 rounded-full focus:outline-none disabled:opacity-60"
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
          {uploading ? (
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          ) : listening ? (
            <Square className="h-12 w-12 text-white" />
          ) : (
            <Mic className="h-14 w-14 text-white" />
          )}
        </span>
      </button>

      <p className="font-semibold text-slate-700">
        {uploading ? (
          <span className="inline-flex items-center gap-1.5">
            <Cloud className="h-4 w-4" /> Transcribing…
          </span>
        ) : listening ? (
          t("intake.listening")
        ) : (
          t("intake.tapToSpeak")
        )}
      </p>

      {/* Persistent live caption: shows accumulated final + interim text while speaking. */}
      {(listening || caption) && (
        <div className="w-full max-w-sm min-h-[3.25rem] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
          {caption ? (
            <p className="text-sm text-slate-700">
              {finalText}
              {interim && <span className="text-slate-400 italic"> {interim}</span>}
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic">{t("intake.listening")}…</p>
          )}
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-amber-700 max-w-sm text-center">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {!listening && !uploading && <p className="text-xs text-slate-400 max-w-sm text-center">{t("intake.speakHint")}</p>}
    </div>
  );
}
