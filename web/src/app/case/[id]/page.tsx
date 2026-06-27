"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Volume2, Play, ShieldCheck, CheckCircle2, Hospital, Megaphone, Mic, Square } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { MatchCard } from "@/components/MatchCard";
import { Chip, Spinner, Modal, Scanning } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { CaseOut, MatchResponse } from "@/lib/types";

export default function CaseDetailPage() {
  const { t, announceName } = useI18n();
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
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    // Best-effort locale selection for TTS.
    u.lang = (c?.language || announceName).toLowerCase().startsWith("hin") ? "hi-IN" : "hi-IN";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
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
      {/* header */}
      <div className="card p-4 mb-3">
        <div className="flex items-start gap-3">
          {c.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover border" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-100 text-2xl font-bold text-slate-400">
              {(c.person_name || "?")[0]}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-bold text-lg">{c.person_name || t("common.unknown")}</p>
              <Chip color={c.case_type === "missing" ? "saffron" : "teal"}>
                {c.case_type === "missing" ? t("common.missing") : t("common.found")}
              </Chip>
            </div>
            <p className="text-sm text-slate-500">{c.case_id} · {c.gender} · {c.age_band}</p>
            <p className="text-sm text-slate-500">{c.language} · {c.state} · {c.last_seen_location}</p>
            <Chip color={c.status === "Reunited" ? "green" : "slate"}>{c.status}</Chip>
          </div>
        </div>
        {c.physical_description && <p className="mt-3 text-sm bg-slate-50 rounded-lg p-2.5">{c.physical_description}</p>}
        {c.reporter_mobile_masked && <p className="mt-2 text-xs text-slate-400">📞 {c.reporter_mobile_masked}</p>}
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
        <div className="card p-4 mb-3 bg-saffron-50 border-saffron-200">
          <p className="text-sm font-semibold text-saffron-800 mb-1">{t("case.announcement")}</p>
          <p className="text-sm">{announce.text}</p>
          <button onClick={() => speak(announce.text)} className="btn-primary mt-2 py-2 text-sm">
            <Volume2 className="h-4 w-4" /> {t("case.playAnnouncement")}
          </button>
        </div>
      )}

      {/* voice samples */}
      {voices.length > 0 && (
        <div className="card p-4 mb-3">
          <p className="font-semibold mb-2">{t("case.voiceSamples")}</p>
          {voices.map((v) => (
            <div key={v.id} className="flex items-center gap-2 py-1">
              <button onClick={() => new Audio(api.audioUrl(v.id)).play()} className="btn-ghost py-1.5 px-3 text-sm">
                <Play className="h-4 w-4" /> {v.kind}
              </button>
              {v.transcript && <span className="text-xs text-slate-500 italic">“{v.transcript}”</span>}
            </div>
          ))}
        </div>
      )}

      {/* matches */}
      <h2 className="font-bold mb-2">{t("match.title")}</h2>
      {busy && <div className="mb-2"><Spinner className="h-5 w-5 text-saffron-600" /></div>}
      <div className="space-y-3">
        {matches && matches.candidates.length > 0 ? (
          matches.candidates.map((m) => (
            <MatchCard key={m.case.id} cand={m} onConfirm={c.status !== "Reunited" ? () => confirmMatch(m.case.id) : undefined} confirming={busy} />
          ))
        ) : (
          <div className="card p-6 text-center text-slate-500">{t("match.noMatches")}</div>
        )}
      </div>

      <Modal open={verifyOpen} onClose={() => { setVerifyOpen(false); setVerifyResult(null); }} title={t("case.verify")}>
        <p className="text-sm text-slate-600 mb-2">{t("case.verifyPrompt")}</p>
        {c.secret_question && <p className="text-sm font-medium mb-2">❝ {c.secret_question} ❞</p>}
        <input className="input mb-3" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <button className="btn-primary w-full" onClick={doVerify}>{t("common.confirm")}</button>
        {verifyResult && (
          <p className={`mt-3 text-sm font-medium ${verifyResult.verified ? "text-green-600" : "text-red-600"}`}>
            {verifyResult.message}
          </p>
        )}
      </Modal>
    </AppFrame>
  );
}
