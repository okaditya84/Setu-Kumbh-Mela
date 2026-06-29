"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sparkles, ChevronDown, Send, CheckCircle2, WifiOff, Search, Save } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { VoiceCapture } from "@/components/VoiceCapture";
import { PhotoCapture } from "@/components/PhotoCapture";
import { MatchCard } from "@/components/MatchCard";
import { Scanning, Chip, Spinner } from "@/components/ui";
import { useI18n } from "@/i18n";
import { LANGUAGES } from "@/i18n/languages";
import { api } from "@/lib/api";
import { AGE_BANDS, GENDERS } from "@/lib/config";
import { enqueueCase, uuid } from "@/lib/db";
import type { CaseDraft, CaseType, IntakeDraft, MatchResponse } from "@/lib/types";

function IntakeInner() {
  const { t, announceName } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const caseType = (params.get("type") === "missing" ? "missing" : "found") as CaseType;

  const [draft, setDraft] = useState<CaseDraft>({ case_type: caseType });
  const [photo, setPhoto] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Preview result (NOT persisted). Set by previewCase on "Find matches".
  const [matches, setMatches] = useState<MatchResponse | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  // The real persisted case id — set ONLY after the volunteer explicitly registers.
  const [registeredId, setRegisteredId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [reunited, setReunited] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  // Incremented to tell VoiceCapture to stop listening (e.g. on submit).
  const [stopSignal, setStopSignal] = useState(0);
  // Stable client_uuid for this report so preview→register→confirm stay idempotent.
  const clientUuidRef = useRef<string>(uuid());

  useEffect(() => {
    setDraft((d) => ({ ...d, case_type: caseType }));
  }, [caseType]);
  useEffect(() => {
    api.geoLocations().then((r) => setLocations(r.locations)).catch(() => {});
  }, []);

  const set = (k: keyof CaseDraft, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  // Map a parsed IntakeDraft onto the case draft (shared by /intake/parse and server STT).
  function applyDraft(parsed: IntakeDraft, fallbackDescription?: string) {
    setDraft((d) => ({
      ...d,
      person_name: parsed.person_name ?? d.person_name,
      gender: parsed.gender ?? d.gender,
      age_band: parsed.age_band ?? d.age_band,
      language: parsed.language ?? d.language,
      state: parsed.state ?? d.state,
      district: parsed.district ?? d.district,
      last_seen_location: parsed.last_seen_location ?? d.last_seen_location,
      physical_description: parsed.physical_description ?? fallbackDescription ?? d.physical_description,
    }));
  }

  // The server STT path returns an already-parsed draft, so when it fires we skip
  // the redundant client-side /intake/parse call in onVoice (which would clobber it).
  const serverDraftApplied = useRef(false);

  // Server STT returned a parsed draft (primary path) → prefill the form.
  function onServerDraft(parsed: IntakeDraft) {
    serverDraftApplied.current = true;
    setShowManual(true);
    applyDraft(parsed);
  }

  async function onVoice(transcript: string, blob: Blob | null) {
    setAudioBlob(blob);
    setShowManual(true);
    // If the server already parsed a draft this capture, just backfill the
    // description from the transcript if it's still empty, and skip re-parsing.
    if (serverDraftApplied.current) {
      serverDraftApplied.current = false;
      if (transcript) setDraft((d) => (d.physical_description ? d : { ...d, physical_description: transcript }));
      return;
    }
    if (!transcript) return;
    setParsing(true);
    try {
      const { draft: parsed } = await api.parseText(transcript, caseType);
      applyDraft(parsed, transcript);
    } catch {
      set("physical_description", transcript);
    } finally {
      setParsing(false);
    }
  }

  // Build the payload for preview/register/queue from the current draft + media.
  function buildPayload(): CaseDraft {
    return { ...draft, client_uuid: clientUuidRef.current, photo_url: photo };
  }

  // "Find matches" → PREVIEW ONLY. Does NOT persist anything.
  async function submit() {
    // Stop any active voice recognition before submitting.
    setStopSignal((s) => s + 1);
    setSubmitting(true);
    setSavedOffline(false);
    const payload = buildPayload();
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        // Offline: we can't preview against other centers, so queue the report
        // for registration when connectivity returns.
        await enqueueCase(payload, photo);
        setSavedOffline(true);
        return;
      }
      const res = await api.previewCase(payload);
      setMatches(res);
    } catch {
      // Network hiccup → queue it so nothing is lost.
      await enqueueCase(payload, photo);
      setSavedOffline(true);
    } finally {
      setSubmitting(false);
    }
  }

  // Explicitly persist the report (volunteer pressed "Register this report").
  // Returns the new case id, or null on failure. Idempotent via client_uuid.
  async function ensureRegistered(): Promise<string | null> {
    if (registeredId) return registeredId;
    const res = await api.createCase(buildPayload());
    const id = res.query_case_id;
    setRegisteredId(id);
    setMatches(res); // refresh against the now-persisted record
    if (audioBlob) {
      api.uploadVoice(id, audioBlob, "description", announceName).catch(() => {});
    }
    return id;
  }

  async function register() {
    setRegistering(true);
    try {
      await ensureRegistered();
    } finally {
      setRegistering(false);
    }
  }

  // Disambiguation: during preview there's no persisted id, so apply the chosen
  // answer to the draft and re-preview. After registration, refine the record.
  async function refine(field: string, value: string) {
    setSubmitting(true);
    try {
      if (registeredId) {
        const key = field === "stable" ? "add_stable" : field;
        const res = await api.refineCase(registeredId, { [key]: value });
        setMatches(res);
      } else {
        const next: CaseDraft =
          field === "stable"
            ? { ...draft, physical_description: [draft.physical_description, value].filter(Boolean).join(" ") }
            : { ...draft, [field]: value } as CaseDraft;
        setDraft(next);
        const res = await api.previewCase({ ...next, client_uuid: clientUuidRef.current, photo_url: photo });
        setMatches(res);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // "Confirm reunion" — register the report first (if not yet), then decide.
  async function confirm(candidateCaseId: string) {
    setConfirmingId(candidateCaseId);
    try {
      const myId = await ensureRegistered();
      if (!myId) return;
      const missing = caseType === "missing" ? myId : candidateCaseId;
      const found = caseType === "found" ? myId : candidateCaseId;
      await api.decideMatch(missing, found, "confirm");
      setReunited(true);
    } finally {
      setConfirmingId(null);
    }
  }

  const title = caseType === "missing" ? t("intake.titleMissing") : t("intake.titleFound");

  // Don't allow submitting a blank report — require at least one meaningful signal
  // (a typed/parsed field, a photo, or captured voice audio).
  const meaningfulFields: (keyof CaseDraft)[] = [
    "person_name",
    "gender",
    "age_band",
    "language",
    "state",
    "district",
    "last_seen_location",
    "physical_description",
    "reporter_mobile",
  ];
  const hasSignal =
    !!photo ||
    !!audioBlob ||
    meaningfulFields.some((k) => {
      const v = draft[k];
      return typeof v === "string" ? v.trim().length > 0 : v != null;
    });

  // ---- result states ----
  if (reunited) {
    return (
      <AppFrame>
        <div className="card p-8 text-center mt-10 max-w-md mx-auto">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-3" />
          <p className="text-xl font-bold">{t("match.reunitedOk")}</p>
          <button className="btn-primary mt-6" onClick={() => router.push("/dashboard")}>
            {t("nav.home")}
          </button>
        </div>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold">{title}</h1>
        <Chip color={caseType === "missing" ? "saffron" : "teal"}>
          {caseType === "missing" ? t("common.missing") : t("common.found")}
        </Chip>
      </div>

      {!matches && !savedOffline && (
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-6 lg:items-start">
          {/* Left column: big voice button */}
          <div className="lg:sticky lg:top-20">
            <div className="card p-6 mb-4 lg:mb-0">
              <VoiceCapture
                onResult={onVoice}
                onServerDraft={onServerDraft}
                caseType={caseType}
                stopSignal={stopSignal}
              />
              {parsing && (
                <p className="mt-3 text-center text-sm text-saffron-700 inline-flex items-center gap-1 w-full justify-center">
                  <Sparkles className="h-4 w-4 animate-pulse" /> {t("intake.draftReady")}
                </p>
              )}
            </div>
          </div>

          {/* Right column: manual / prefilled form + submit */}
          <div>
          {/* Manual / prefilled form */}
          <button
            onClick={() => setShowManual((s) => !s)}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-500 py-2"
          >
            {t("intake.orFillManually")}
            <ChevronDown className={`h-4 w-4 transition ${showManual ? "rotate-180" : ""}`} />
          </button>

          {showManual && (
            <div className="card p-4 space-y-4">
              <Field label={t("intake.name")} optional={t("common.optional")}>
                <input className="input" value={draft.person_name || ""} onChange={(e) => set("person_name", e.target.value)} />
              </Field>

              <Field label={t("intake.gender")}>
                <div className="flex gap-2">
                  {GENDERS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => set("gender", g)}
                      className={`flex-1 rounded-xl border py-2.5 font-medium ${
                        draft.gender === g ? "border-saffron-500 bg-saffron-50 text-saffron-700" : "border-slate-200"
                      }`}
                    >
                      {g === "Male" ? t("common.male") : g === "Female" ? t("common.female") : t("common.unknown")}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={t("intake.age")}>
                <div className="grid grid-cols-4 gap-2">
                  {AGE_BANDS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => set("age_band", a)}
                      className={`rounded-xl border py-2 text-sm font-medium ${
                        draft.age_band === a ? "border-saffron-500 bg-saffron-50 text-saffron-700" : "border-slate-200"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t("intake.language")}>
                  <select className="input" value={draft.language || ""} onChange={(e) => set("language", e.target.value)}>
                    <option value="">—</option>
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.announceName}>{l.announceName}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t("intake.lastSeen")}>
                  <select className="input" value={draft.last_seen_location || ""} onChange={(e) => set("last_seen_location", e.target.value)}>
                    <option value="">—</option>
                    {locations.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t("intake.state")} optional={t("common.optional")}>
                  <input className="input" value={draft.state || ""} onChange={(e) => set("state", e.target.value)} />
                </Field>
                <Field label={t("intake.mobile")} optional={t("common.optional")}>
                  <input className="input" inputMode="tel" value={draft.reporter_mobile || ""} onChange={(e) => set("reporter_mobile", e.target.value)} />
                </Field>
              </div>

              <Field label={t("intake.description")}>
                <textarea className="input min-h-[72px]" value={draft.physical_description || ""} onChange={(e) => set("physical_description", e.target.value)} />
              </Field>

              <Field label={t("intake.photo")} optional={t("common.optional")}>
                <PhotoCapture value={photo} onChange={setPhoto} />
              </Field>

              {caseType === "found" && (
                <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 space-y-3">
                  <p className="text-sm font-medium text-teal-800">{t("intake.secretQ")}</p>
                  <input className="input" placeholder={t("intake.secretQ")} value={draft.secret_question || ""} onChange={(e) => set("secret_question", e.target.value)} />
                  <input className="input" placeholder={t("intake.secretA")} value={draft.secret_answer || ""} onChange={(e) => set("secret_answer", e.target.value)} />
                  <p className="text-xs text-teal-700">{t("intake.secretHint")}</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting || !hasSignal}
            className="btn-primary w-full mt-4 py-4 text-lg sticky bottom-24 lg:static lg:bottom-auto"
          >
            <Send className="h-5 w-5" /> {t("intake.submit")}
          </button>
          {!hasSignal && (
            <p className="mt-2 text-center text-xs text-slate-400">
              Add details by voice, a photo, or fill the form to search.
            </p>
          )}
          </div>
        </div>
      )}

      {submitting && <div className="mt-4"><Scanning label={t("intake.scanning")} /></div>}

      {savedOffline && (
        <div className="card p-8 text-center mt-6 max-w-md mx-auto">
          <WifiOff className="mx-auto h-14 w-14 text-amber-500 mb-3" />
          <p className="font-bold text-lg">{t("sync.offlineNote")}</p>
          <button className="btn-primary mt-6" onClick={() => router.push("/dashboard")}>{t("nav.home")}</button>
        </div>
      )}

      {matches && !registeredId && (
        <div className="space-y-3">
          {/* (a) Summary of what is being filed */}
          <SummaryCard caseType={caseType} draft={draft} photo={photo} t={t} />

          {/* (b) Possible matches */}
          <div className="flex items-center justify-between pt-1">
            <h2 className="font-bold">{t("match.title")}</h2>
            <span className="text-xs text-slate-400">{matches.total_considered} {t("match.considered")}</span>
          </div>
          <p className="text-sm text-slate-500 -mt-2">
            Other reports that may be the SAME person, from any center — confirm to reunite.
          </p>

          {matches.needs_disambiguation && matches.disambiguation_questions.length > 0 && (
            <div className="card p-4 bg-amber-50 border-amber-200">
              <p className="text-sm font-semibold text-amber-800 mb-2">{t("match.disambiguation")}</p>
              {matches.disambiguation_questions.map((q, i) => (
                <div key={i} className="mb-2">
                  <p className="text-sm font-medium">{q.question}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {q.options.map((o) => (
                      <button key={o} onClick={() => refine(q.field, o)} className="chip bg-amber-100 text-amber-800 hover:bg-amber-200">
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {matches.candidates.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-500">
                <Search className="h-7 w-7" />
              </div>
              <p className="font-semibold text-slate-700">No matches yet.</p>
              <p className="text-sm text-slate-500 mt-1">Register the report so it becomes searchable at every center.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {matches.candidates.map((c) => (
                <MatchCard key={c.case.id} cand={c} onConfirm={() => confirm(c.case.id)} confirming={confirmingId === c.case.id} />
              ))}
            </div>
          )}

          {/* (c) Explicit register action — the ONLY way to persist */}
          <div className="card p-4 bg-saffron-50 border-saffron-200 sticky bottom-24 lg:static lg:bottom-auto">
            <p className="text-sm text-slate-600 mb-2">Nothing is saved yet. Review the details above, then register.</p>
            <button onClick={register} disabled={registering} className="btn-primary w-full py-4 text-lg">
              {registering ? <Spinner className="h-5 w-5" /> : <Save className="h-5 w-5" />} Register this report
            </button>
          </div>
          <button className="btn-ghost w-full" onClick={() => router.push("/dashboard")}>
            {t("common.cancel")}
          </button>
        </div>
      )}

      {/* Registered confirmation */}
      {registeredId && !reunited && (
        <div className="card p-8 text-center mt-6 max-w-md mx-auto">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-3" />
          <p className="text-xl font-bold">Registered</p>
          <p className="text-sm text-slate-500 mt-1">The report is now searchable at every center.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <button className="btn-primary" onClick={() => router.push(`/case/${registeredId}`)}>Go to case</button>
            <button className="btn-ghost" onClick={() => router.push("/dashboard")}>{t("nav.home")}</button>
          </div>
        </div>
      )}
    </AppFrame>
  );
}

function SummaryCard({
  caseType,
  draft,
  photo,
  t,
}: {
  caseType: CaseType;
  draft: CaseDraft;
  photo: string | null;
  t: (k: string) => string;
}) {
  const heading =
    caseType === "missing" ? "You are filing a MISSING report:" : "You are filing a FOUND person:";
  const rows: { label: string; value?: string | null }[] = [
    { label: t("intake.name"), value: draft.person_name },
    { label: t("intake.gender"), value: draft.gender },
    { label: t("intake.age"), value: draft.age_band },
    { label: t("intake.language"), value: draft.language },
    { label: t("intake.lastSeen"), value: draft.last_seen_location },
    { label: t("intake.state"), value: draft.state },
  ].filter((r) => r.value);

  return (
    <div className={`card p-4 ${caseType === "missing" ? "bg-saffron-50 border-saffron-200" : "bg-teal-50 border-teal-200"}`}>
      <p className={`text-sm font-semibold mb-3 ${caseType === "missing" ? "text-saffron-800" : "text-teal-800"}`}>
        {heading}
      </p>
      <div className="flex items-start gap-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-16 w-16 rounded-xl object-cover border" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-xl bg-white/70 text-2xl font-bold text-slate-400">
            {(draft.person_name || "?")[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-lg">{draft.person_name || t("common.unknown")}</p>
          {rows.length > 0 && (
            <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
              {rows.map((r) => (
                <div key={r.label} className="flex gap-1 min-w-0">
                  <dt className="text-slate-400 shrink-0">{r.label}:</dt>
                  <dd className="text-slate-700 truncate">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      {draft.physical_description && (
        <p className="mt-3 text-sm bg-white/70 rounded-lg p-2.5 text-slate-700">{draft.physical_description}</p>
      )}
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">
        {label} {optional && <span className="text-slate-300 font-normal">({optional})</span>}
      </label>
      {children}
    </div>
  );
}

export default function IntakePage() {
  return (
    <Suspense fallback={null}>
      <IntakeInner />
    </Suspense>
  );
}
