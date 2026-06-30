"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, AlertCircle, Loader2, Cloud } from "lucide-react";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { IntakeDraft } from "@/lib/types";

interface Props {
  onResult: (transcript: string, audioBlob: Blob | null) => void;
  onInterim?: (text: string) => void;
  onServerDraft?: (draft: IntakeDraft) => void;
  caseType?: string;
  stopSignal?: number;
}

type Phase = "idle" | "recording" | "transcribing";

function pickMime(): string {
  const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
    for (const c of cands) if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export function VoiceCapture({ onResult, onInterim, onServerDraft, caseType, stopSignal }: Props) {
  const { t, speechLocale } = useI18n();
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("");
  const phaseRef = useRef<Phase>("idle");
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setPhaseBoth(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  useEffect(() => () => cleanup(), []);

  // Parent-driven stop (e.g. on "Find matches"). Ignore initial mount.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (phaseRef.current === "recording") stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSignal]);

  function cleanup() {
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;
    try {
      if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
  }

  async function start() {
    setError(null);
    setCaption("");
    chunksRef.current = [];

    // The MICROPHONE is the gate. If it fails we do NOT enter "recording".
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(t("intake.permMic"));
      return;
    }
    streamRef.current = stream;

    let mr: MediaRecorder;
    try {
      const mime = pickMime();
      mimeRef.current = mime;
      mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setError(t("intake.permMic"));
      return;
    }
    mediaRef.current = mr;
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => void finalize();
    mr.start(500); // timeslice → chunks accumulate reliably during recording

    // Best-effort LIVE CAPTION via on-device recognition. It can NEVER stop the
    // recording (Brave/Safari fire onend instantly). Pure decoration.
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      try {
        const rec = new SR();
        rec.lang = speechLocale;
        rec.continuous = true;
        rec.interimResults = true;
        let finalCap = "";
        rec.onresult = (e: any) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const tr = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalCap += tr + " ";
            else interim += tr;
          }
          const c = (finalCap + interim).trim();
          setCaption(c);
          onInterim?.(c);
        };
        rec.onend = () => {
          recognitionRef.current = null;
        };
        rec.onerror = () => {};
        recognitionRef.current = rec;
        rec.start();
      } catch {
        recognitionRef.current = null;
      }
    }

    setPhaseBoth("recording");
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = setTimeout(() => {
      if (phaseRef.current === "recording") stop();
    }, 45000);
  }

  function stop() {
    if (phaseRef.current !== "recording") return;
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;
    // Triggers mr.onstop → finalize(). Request the trailing chunk first.
    try {
      mediaRef.current?.requestData?.();
    } catch {}
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    else void finalize();
  }

  async function finalize() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const type = mimeRef.current || "audio/webm";
    const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type }) : null;
    const captured = caption.trim();

    if (!blob || blob.size < 500) {
      setPhaseBoth("idle");
      setError("No audio was captured. Please allow the microphone and try again.");
      onResult(captured, blob);
      return;
    }

    // Online → server (Sarvam) auto-detects the spoken language. Offline → caption.
    if (typeof navigator !== "undefined" && navigator.onLine) {
      setPhaseBoth("transcribing");
      try {
        const res = await api.intakeVoice(blob, caseType, "");
        const transcript = (res.transcript || "").trim();
        if (transcript) setCaption(transcript);
        if (res.draft) onServerDraft?.(res.draft);
        if (!transcript && !captured) {
          setError("Could not transcribe the audio. Please try again or fill the form.");
        }
        onResult(transcript || captured, blob);
      } catch {
        if (captured) onResult(captured, blob);
        else {
          setError("Transcription service is unavailable. Please fill the form.");
          onResult("", blob);
        }
      } finally {
        setPhaseBoth("idle");
      }
    } else {
      setPhaseBoth("idle");
      onResult(captured, blob);
    }
  }

  const recording = phase === "recording";
  const busy = phase === "transcribing";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => (recording ? stop() : start())}
        disabled={busy}
        className="relative grid place-items-center h-36 w-36 rounded-full focus:outline-none disabled:opacity-60"
        aria-label={recording ? "stop recording" : "start recording"}
      >
        {recording && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-400/40 animate-pulsering" />
            <span className="absolute inset-0 rounded-full bg-red-400/30 animate-pulsering [animation-delay:0.6s]" />
          </>
        )}
        <span
          className={`relative grid place-items-center h-32 w-32 rounded-full shadow-lg transition ${
            recording ? "bg-red-600" : "bg-saffron-600"
          }`}
        >
          {busy ? (
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          ) : recording ? (
            <Square className="h-12 w-12 text-white" />
          ) : (
            <Mic className="h-14 w-14 text-white" />
          )}
        </span>
      </button>

      <div className="text-center min-h-[2.5rem]">
        {busy ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-saffron-700 dark:text-saffron-300">
            <Cloud className="h-4 w-4 animate-pulse" /> Transcribing your recording…
          </span>
        ) : recording ? (
          <div>
            <p className="inline-flex items-center gap-1.5 font-semibold text-red-600">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" /> Recording…
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tap the red button when you finish - we&apos;ll transcribe it</p>
          </div>
        ) : (
          <p className="font-semibold text-slate-700 dark:text-slate-200">{t("intake.tapToSpeak")}</p>
        )}
      </div>

      {(recording || busy || caption) && (
        <div className="w-full max-w-sm min-h-[3rem] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-center">
          {caption ? (
            <p className="text-sm text-slate-700 dark:text-slate-200">{caption}</p>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">
              {busy ? "Transcribing…" : "Speak now - your words appear here after you tap stop."}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-300 max-w-sm text-center">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {phase === "idle" && !error && (
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm text-center">{t("intake.speakHint")}</p>
      )}
    </div>
  );
}
