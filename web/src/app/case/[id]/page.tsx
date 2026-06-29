"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Volume2, Play, ShieldCheck, CheckCircle2, Hospital, Megaphone, Mic, Square } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { MatchCard } from "@/components/MatchCard";
import { Spinner, Modal, Scanning, Toast } from "@/components/ui";
import { StatusBadge, TypeTag } from "@/components/CaseBadges";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { CaseOut, MatchResponse } from "@/lib/types";

export default function CaseDetailPage() {
  const { t, announceName, speechLocale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<CaseOut | null>(null);
  const [matches, setMatches] = useState<MatchResponse | null>(null);
  const [voices, setVoices] = useState<any[]>([]);
  const [announce, setAnnounce] = useState<{ text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; message: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [announcePlaying, setAnnouncePlaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Fetch the voice sample WITH auth, then play it from an object URL.
  async function playVoice(sampleId: string) {
    setPlayingId(sampleId);
    let url: string | null = null;
    try {
      url = await api.audioBlobUrl(sampleId);
      const audio = new Audio(url);
      const cleanup = () => {
        if (url) URL.revokeObjectURL(url);
        setPlayingId((p) => (p === sampleId ? null : p));
      };
      audio.onended = cleanup;
      audio.onerror = () => {
        cleanup();
        setToast("Could not play this recording.");
      };
      await audio.play();
    } catch {
      if (url) URL.revokeObjectURL(url);
      setPlayingId((p) => (p === sampleId ? null : p));
      setToast("Could not play this recording.");
    }
  }

  async function load() {
    const [cc, m, v] = await Promise.all([api.getCase(id), api.caseMatches(id), api.listVoice(id)]);
    setC(cc);
    setMatches(m);
    setVoices(v);
  }
  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  async function makeAnnouncement() {
    if (!c) return;
    setBusy(true);
    try {
      const a = await api.announcement(id, announceName);
      setAnnounce(a);
    } finally {
      setBusy(false);
    }
  }
  // Play the PA announcement aloud. Browser speechSynthesis can't speak most
  // Indian languages, so try the server TTS first (real audio in the target
  // language); only fall back to the browser engine if the server has none.
  async function speak(text: string) {
    setAnnouncePlaying(true);
    let url: string | null = null;
    try {
      const blob = await api.tts(text, announceName);
      if (blob) {
        url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        const cleanup = () => {
          if (url) URL.revokeObjectURL(url);
          setAnnouncePlaying(false);
        };
        audio.onended = cleanup;
        audio.onerror = () => {
          cleanup();
          browserSpeak(text);
        };
        await audio.play();
        return;
      }
    } catch {
      if (url) URL.revokeObjectURL(url);
      // fall through to browser TTS
    }
    // No server TTS (204) or it failed → browser speechSynthesis fallback.
    browserSpeak(text);
  }

  function browserSpeak(text: string) {
    if (!("speechSynthesis" in window)) {
      setAnnouncePlaying(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    // Use the BCP-47 locale for the currently selected language (e.g. gu-IN, ta-IN).
    const locale = speechLocale || "hi-IN";
    u.lang = locale;
    u.onend = () => setAnnouncePlaying(false);
    u.onerror = () => setAnnouncePlaying(false);
    const code2 = locale.slice(0, 2).toLowerCase();
    const pickVoice = () => {
      const voices = speechSynthesis.getVoices();
      const match =
        voices.find((v) => v.lang?.toLowerCase() === locale.toLowerCase()) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith(code2));
      if (match) u.voice = match;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    };
    const voicesNow = speechSynthesis.getVoices();
    if (voicesNow.length === 0) {
      // Voices not loaded yet — wait for them once, then speak.
      const handler = () => {
        speechSynthesis.removeEventListener("voiceschanged", handler);
        pickVoice();
      };
      speechSynthesis.addEventListener("voiceschanged", handler);
      // Safety fallback if the event never fires.
      setTimeout(() => {
        speechSynthesis.removeEventListener("voiceschanged", handler);
        if (speechSynthesis.speaking || speechSynthesis.pending) return;
        pickVoice();
      }, 500);
    } else {
      pickVoice();
    }
  }

  async function confirmMatch(candidateCaseId: string) {
    if (!c) return;
    setBusy(true);
    const missing = c.case_type === "missing" ? c.id : candidateCaseId;
    const found = c.case_type === "found" ? c.id : candidateCaseId;
    try {
      await api.decideMatch(missing, found, "confirm");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await api.updateStatus(id, status);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function doVerify() {
    setVerifyResult(await api.verify(id, answer));
  }

  async function toggleRecord() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecording(false);
        await api.uploadVoice(id, blob, "description", announceName);
        await load();
      };
      recRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }

  if (!c) return <AppFrame><div className="mt-10"><Scanning label={t("common.loading")} /></div></AppFrame>;

  return (
    <AppFrame>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-6 lg:items-start">
      {/* Left column: case info + actions */}
      <div className="lg:sticky lg:top-20">
      {/* header */}
      <div className="card p-4 mb-3">
        <div className="flex items-start gap-3">
          {c.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover border" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800 text-2xl font-bold text-slate-400 dark:text-slate-500">
              {(c.person_name || "?")[0]}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <TypeTag caseType={c.case_type} t={t} className="mb-0.5" />
                <p className="font-bold text-lg truncate">{c.person_name || t("common.unknown")}</p>
              </div>
              <StatusBadge status={c.status} t={t} className="shrink-0 mt-0.5" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{c.case_id} · {c.gender} · {c.age_band}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{c.language} · {c.state} · {c.last_seen_location}</p>
          </div>
        </div>
        {c.physical_description && <p className="mt-3 text-sm bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">{c.physical_description}</p>}
        {c.reporter_mobile_masked && <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">📞 {c.reporter_mobile_masked}</p>}
      </div>

      {/* actions */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button onClick={makeAnnouncement} disabled={busy} className="btn-ghost">
          <Megaphone className="h-4 w-4" /> {t("case.generateAnnouncement")}
        </button>
        <button onClick={toggleRecord} className={recording ? "btn-primary" : "btn-ghost"}>
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {t("intake.recordVoice")}
        </button>
        {c.has_secret && (
          <button onClick={() => setVerifyOpen(true)} className="btn-ghost">
            <ShieldCheck className="h-4 w-4" /> {t("case.verify")}
          </button>
        )}
        {c.status !== "Reunited" && (
          <>
            <button onClick={() => setStatus("Reunited")} disabled={busy} className="btn-teal">
              <CheckCircle2 className="h-4 w-4" /> {t("case.markReunited")}
            </button>
            <button onClick={() => setStatus("Transferred to hospital")} disabled={busy} className="btn-ghost">
              <Hospital className="h-4 w-4" /> {t("case.markHospital")}
            </button>
          </>
        )}
      </div>

      {announce && (
        <div className="card p-4 mb-3 bg-saffron-50 dark:bg-saffron-950/40 border-saffron-200 dark:border-saffron-900">
          <p className="text-sm font-semibold text-saffron-800 dark:text-saffron-300 mb-1">{t("case.announcement")}</p>
          <p className="text-sm">{announce.text}</p>
          <button onClick={() => speak(announce.text)} disabled={announcePlaying} className="btn-primary mt-2 py-2 text-sm">
            {announcePlaying ? <Spinner className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} {t("case.playAnnouncement")}
          </button>
        </div>
      )}

      {/* voice samples */}
      {voices.length > 0 && (
        <div className="card p-4 mb-3">
          <p className="font-semibold mb-2">{t("case.voiceSamples")}</p>
          {voices.map((v) => (
            <div key={v.id} className="flex items-center gap-2 py-1">
              <button onClick={() => playVoice(v.id)} disabled={playingId === v.id} className="btn-ghost py-1.5 px-3 text-sm">
                {playingId === v.id ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />} {v.kind}
              </button>
              {v.transcript && <span className="text-xs text-slate-500 dark:text-slate-400 italic">“{v.transcript}”</span>}
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Right column: matches */}
      <div>
      <h2 className="font-bold">{t("match.title")}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
        Other reports that may be the SAME person, from any center — confirm to reunite.
      </p>
      {busy && <div className="mb-2"><Spinner className="h-5 w-5 text-saffron-600" /></div>}
      <div className="space-y-3">
        {matches && matches.candidates.length > 0 ? (
          matches.candidates.map((m) => (
            <MatchCard key={m.case.id} cand={m} onConfirm={c.status !== "Reunited" ? () => confirmMatch(m.case.id) : undefined} confirming={busy} />
          ))
        ) : (
          <div className="card p-8 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-300">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">{t("match.noMatches")}</p>
          </div>
        )}
      </div>
      </div>
      </div>

      <Modal open={verifyOpen} onClose={() => { setVerifyOpen(false); setVerifyResult(null); }} title={t("case.verify")}>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{t("case.verifyPrompt")}</p>
        {c.secret_question && <p className="text-sm font-medium mb-2">❝ {c.secret_question} ❞</p>}
        <input className="input mb-3" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <button className="btn-primary w-full" onClick={doVerify}>{t("common.confirm")}</button>
        {verifyResult && (
          <p className={`mt-3 text-sm font-medium ${verifyResult.verified ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {verifyResult.message}
          </p>
        )}
      </Modal>

      {toast && <Toast message={toast} kind="error" />}
    </AppFrame>
  );
}
