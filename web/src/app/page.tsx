"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Network,
  ShieldCheck,
  Map as MapIcon,
  WifiOff,
  Languages,
  ArrowRight,
  Search,
  UserPlus,
  CheckCircle2,
  Menu,
  X,
} from "lucide-react";
import { getAuth } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";

const CONTACT_EMAIL = "adityajethani11@gmail.com";

/* -------------------------------------------------------------------------- */
/*  Reduced-motion helper                                                      */
/* -------------------------------------------------------------------------- */
function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* -------------------------------------------------------------------------- */
/*  Count-up number that animates once when scrolled into view.                */
/*  Uses IntersectionObserver + requestAnimationFrame. Honors reduced motion.  */
/* -------------------------------------------------------------------------- */
function Counter({
  to,
  suffix = "",
  prefix = "",
  duration = 1600,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefersReducedMotion()) {
      setVal(to);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const tick = (now: number) => {
              const p = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - p, 3);
              setVal(Math.round(eased * to));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {val}
      {suffix}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Demo media slot                                                            */
/*  Tries to load /demo.mp4 (a screen recording the user drops in later).      */
/*  If it is absent or fails, we render a tasteful animated mock of the app    */
/*  flow so the hero never looks broken.                                       */
/* -------------------------------------------------------------------------- */
function DemoMedia() {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  return (
    <div className="group relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-saffron-50 via-white to-teal-50 dark:from-saffron-950/40 dark:via-slate-900 dark:to-teal-950/40 shadow-xl transition duration-500 hover:shadow-2xl">
      {/* soft sheen that drifts across the surface */}
      <div className="pointer-events-none absolute inset-0 z-10 demo-sheen" />
      {!failed && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/icon-512.png"
          onError={() => setFailed(true)}
        >
          <source src="/demo.mp4" type="video/mp4" />
        </video>
      )}
      {failed && <DemoMock />}
    </div>
  );
}

/* Pure CSS/SVG animated mock of the app flow: speak, match across centers,
   reunited. Shown only when /demo.mp4 is not present. */
function DemoMock() {
  return (
    <div className="absolute inset-0 grid place-items-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        {/* phone frame */}
        <div className="relative w-44 rounded-[2rem] border-[6px] border-slate-900 bg-white dark:bg-slate-800 p-3 shadow-2xl animate-floaty">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-2 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="grid place-items-center py-4">
              <span className="relative grid h-16 w-16 place-items-center rounded-full bg-saffron-600 text-white">
                <span className="absolute inset-0 rounded-full bg-saffron-400 animate-pulsering" />
                <Mic className="h-7 w-7" />
              </span>
            </div>
            <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-2 w-5/6 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 px-2 py-1.5">
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
              <span className="h-2 w-2/3 rounded bg-teal-200" />
            </div>
          </div>
        </div>
        <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">
          Speak in any language, matched across every center, reunited
        </p>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Mic,
    title: "Voice-first intake",
    body: "Report a missing or found person by just speaking - in any Indian language. AI fills the form for you.",
    tone: "saffron",
  },
  {
    icon: Network,
    title: "Cross-center matching",
    body: "One unified registry. A report at any camp is instantly searchable at every other center, automatically.",
    tone: "teal",
  },
  {
    icon: ShieldCheck,
    title: "Anti-impersonation verification",
    body: "A private secret question protects each person - only true family can confirm a reunion before release.",
    tone: "saffron",
  },
  {
    icon: MapIcon,
    title: "Live situational map",
    body: "See open cases, risk hotspots, police posts and the nearest help, live across the whole mela.",
    tone: "teal",
  },
  {
    icon: WifiOff,
    title: "Works offline",
    body: "Built offline-first. Reports are saved on the device and sync automatically when the network returns.",
    tone: "saffron",
  },
  {
    icon: Languages,
    title: "Multilingual by design",
    body: "Full interface and voice support across 12 Indian languages - nobody is left out at the ghat.",
    tone: "teal",
  },
] as const;

const STEPS = [
  {
    icon: Mic,
    title: "Report in seconds",
    body: "A family member or volunteer taps and speaks. Setu understands the language and drafts the case.",
  },
  {
    icon: Network,
    title: "Match across centers",
    body: "Setu searches every lost-and-found center at once and surfaces the strongest matches with reasons.",
  },
  {
    icon: CheckCircle2,
    title: "Verify and reunite",
    body: "Family answers the secret question, the match is confirmed, and both reports close automatically.",
  },
];

/* Scripts shown in the gentle language marquee under the hero. */
const LANGUAGES = [
  "हिंदी",
  "বাংলা",
  "தமிழ்",
  "తెలుగు",
  "मराठी",
  "ગુજરાતી",
  "ಕನ್ನಡ",
  "മലയാളം",
  "ਪੰਜਾਬੀ",
  "ଓଡ଼ିଆ",
  "অসমীয়া",
  "اردو",
];

function toneClasses(tone: "saffron" | "teal") {
  return tone === "saffron"
    ? "bg-saffron-100 text-saffron-700 dark:bg-saffron-950/40 dark:text-saffron-300"
    : "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300";
}

export default function LandingPage() {
  const [authed, setAuthed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setAuthed(!!getAuth());
  }, []);

  /* Scroll-reveal: any element with data-reveal fades and rises in once.
     Reduced-motion users get the final state immediately. */
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]")
    );
    if (prefersReducedMotion()) {
      els.forEach((el) => el.classList.add("reveal-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const appHref = authed ? "/dashboard" : "/login";

  return (
    <div className="min-h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* ---------------------------------------------------------------- Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-saffron-600 font-black text-white shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
              से
            </span>
            <span className="text-lg font-extrabold tracking-tight">Setu</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <a href="#features" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              Features
            </a>
            <a href="#how" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              How it works
            </a>
            <Link href="/contact" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              Contact
            </Link>
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              Sign up
            </Link>
            <Link href={appHref} className="group btn-primary ml-1 px-4 py-2 text-sm">
              Open the app
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <ThemeToggle className="ml-1" />
          </nav>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button
              className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              <a href="#features" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                Features
              </a>
              <a href="#how" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                How it works
              </a>
              <Link href="/contact" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                Contact
              </Link>
              <Link href="/login" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                Sign in
              </Link>
              <Link href="/signup" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                Sign up
              </Link>
              <Link href={appHref} onClick={() => setMenuOpen(false)} className="group btn-primary mt-1 justify-center px-4 py-2 text-sm">
                Open the app
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* -------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        {/* animated gradient blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-[-4rem] h-80 w-80 rounded-full bg-saffron-200/60 dark:bg-saffron-900/30 blur-3xl animate-blob" />
          <div className="absolute top-40 -left-24 h-80 w-80 rounded-full bg-teal-200/60 dark:bg-teal-900/30 blur-3xl animate-blob animate-blob-delay" />
          <div className="absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-saffron-100/70 dark:bg-saffron-950/30 blur-3xl animate-blob animate-blob-slow" />
          {/* faint dotted grid for depth */}
          <div className="absolute inset-0 hero-grid opacity-[0.5] dark:opacity-[0.25]" />
        </div>

        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-20">
          <div data-reveal className="reveal">
            <span className="inline-flex items-center gap-2 rounded-full bg-saffron-50 dark:bg-saffron-950/40 px-3 py-1 text-sm font-medium text-saffron-700 dark:text-saffron-300 ring-1 ring-saffron-100 dark:ring-saffron-900/50">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-saffron-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-saffron-500" />
              </span>
              Built for the Kumbh Mela
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Reuniting families at the{" "}
              <span className="bg-gradient-to-r from-saffron-600 via-saffron-500 to-teal-600 dark:from-saffron-400 dark:via-saffron-300 dark:to-teal-400 bg-clip-text text-transparent">
                world&apos;s largest gathering.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
              Setu is one unified, offline-first, voice-first lost-and-found
              registry for the Kumbh, so a missing child or elder reported at
              any center is instantly found across all of them.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={appHref} className="group btn-primary px-6 py-3 text-base">
                Open the app
                <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link href="/signup" className="btn-ghost px-6 py-3 text-base">
                Create an account
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5"><Languages className="h-4 w-4 text-teal-600" /> 12 Indian languages</span>
              <span className="inline-flex items-center gap-1.5"><WifiOff className="h-4 w-4 text-teal-600" /> Works offline</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-teal-600" /> Privacy by design</span>
            </div>
          </div>
          <div data-reveal className="reveal reveal-delay-2">
            <DemoMedia />
          </div>
        </div>

        {/* gentle language marquee */}
        <div className="relative border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
          <div className="marquee-mask mx-auto w-full max-w-6xl overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex w-max items-center gap-8 marquee-track">
              {[...LANGUAGES, ...LANGUAGES].map((lang, i) => (
                <span
                  key={`${lang}-${i}`}
                  className="select-none text-lg font-semibold text-slate-400 dark:text-slate-500"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Stat band */}
      <section className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-br from-saffron-50 via-white to-teal-50 dark:from-saffron-950/30 dark:via-slate-900 dark:to-teal-950/30">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-12 sm:px-6 sm:grid-cols-3 lg:px-8">
          <div data-reveal className="reveal text-center sm:text-left">
            <p className="text-4xl font-extrabold tracking-tight text-saffron-700 dark:text-saffron-300">
              <Counter to={12} />
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">Indian languages, spoken and understood.</p>
          </div>
          <div data-reveal className="reveal reveal-delay-1 text-center sm:text-left">
            <p className="text-4xl font-extrabold tracking-tight text-saffron-700 dark:text-saffron-300">
              <Counter to={100} suffix="%" />
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">Offline-capable, syncs when the signal returns.</p>
          </div>
          <div data-reveal className="reveal reveal-delay-2 text-center sm:text-left">
            <p className="text-4xl font-extrabold tracking-tight text-saffron-700 dark:text-saffron-300">
              <Counter to={24} suffix="/7" />
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">Every center, one always-on registry.</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Problem */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-12 sm:px-6 sm:grid-cols-3 lg:px-8">
          <div data-reveal className="reveal">
            <p className="text-3xl font-extrabold text-saffron-700 dark:text-saffron-300">
              <Counter to={80} suffix="M+" />
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">pilgrims gather at a single Kumbh, across vast, crowded ghats.</p>
          </div>
          <div data-reveal className="reveal reveal-delay-1">
            <p className="text-3xl font-extrabold text-saffron-700 dark:text-saffron-300">Hundreds</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">of people - often children and elders - are separated from family every day.</p>
          </div>
          <div data-reveal className="reveal reveal-delay-2">
            <p className="text-3xl font-extrabold text-saffron-700 dark:text-saffron-300">Siloed</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">lost-and-found centers can&apos;t see each other&apos;s records, so searches stall.</p>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
          <p data-reveal className="reveal max-w-3xl text-lg text-slate-700 dark:text-slate-200">
            <span className="font-semibold text-slate-900 dark:text-slate-100">The problem:</span> when
            every camp keeps its own paper register, a family searching at one
            booth never learns their elder was found at another. Language
            barriers and patchy networks make it worse.
          </p>
          <p data-reveal className="reveal reveal-delay-1 mt-3 max-w-3xl text-lg text-slate-700 dark:text-slate-200">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Setu&apos;s answer:</span> a
            single shared registry that listens in any language, works without a
            signal, and matches reports across every center automatically.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- Features */}
      <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8">
        <div data-reveal className="reveal max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight">Everything a reunion needs</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Designed with tired volunteers and anxious families in mind - fast,
            forgiving, and usable by anyone.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              data-reveal
              className={`group card p-6 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl reveal reveal-delay-${i % 3}`}
            >
              <div className={`mb-4 grid h-12 w-12 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${toneClasses(f.tone)}`}>
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------- Steps */}
      <section id="how" className="scroll-mt-20 border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div data-reveal className="reveal max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight">How it works in 3 steps</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">From a worried report to a confirmed reunion.</p>
          </div>
          <div className="relative mt-10 grid gap-6 md:grid-cols-3">
            {/* connector line behind the cards on desktop */}
            <div className="pointer-events-none absolute left-0 right-0 top-6 hidden md:block">
              <div className="mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-saffron-300 dark:via-saffron-800 to-transparent" />
            </div>
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                data-reveal
                className={`group relative card p-6 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl reveal reveal-delay-${i}`}
              >
                <span className="absolute -top-3 -left-3 grid h-9 w-9 place-items-center rounded-full bg-saffron-600 text-sm font-bold text-white shadow transition-transform duration-300 group-hover:scale-110">
                  {i + 1}
                </span>
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-teal-100 text-teal-700 transition-transform duration-300 group-hover:scale-110 dark:bg-teal-950/40 dark:text-teal-300">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Audience */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2">
          <div data-reveal className="group card flex flex-col p-7 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl reveal">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-saffron-100 text-saffron-700 transition-transform duration-300 group-hover:scale-110 dark:bg-saffron-950/40 dark:text-saffron-300">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold">Looking for someone?</h3>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Families can report a missing relative in their own language and be
              alerted the moment a match is found at any center. No forms to
              learn, just speak.
            </p>
            <Link href={appHref} className="group/btn btn-primary mt-5 self-start px-5 py-2.5">
              Report a missing person
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
            </Link>
          </div>
          <div data-reveal className="group card flex flex-col p-7 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl reveal reveal-delay-1">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-teal-100 text-teal-700 transition-transform duration-300 group-hover:scale-110 dark:bg-teal-950/40 dark:text-teal-300">
              <UserPlus className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold">Found a lost person?</h3>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Volunteers and staff register a found child or elder in seconds.
              Setu instantly checks every open missing report across the mela.
            </p>
            <Link href={appHref} className="group/btn btn-teal mt-5 self-start px-5 py-2.5">
              Register a found person
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- CTA band */}
      <section className="relative overflow-hidden bg-saffron-600">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -left-10 h-64 w-64 rounded-full bg-saffron-400/40 blur-3xl animate-blob" />
          <div className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-teal-400/30 blur-3xl animate-blob animate-blob-delay" />
        </div>
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <div data-reveal className="reveal">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Ready to help reunite families?</h2>
            <p className="mt-2 max-w-xl text-saffron-50">
              Open Setu on any phone or control-room screen. It works offline and
              speaks every language at the ghat.
            </p>
          </div>
          <div data-reveal className="reveal reveal-delay-1 flex flex-col gap-3 sm:flex-row">
            <Link href={appHref} className="group btn inline-flex shrink-0 bg-white px-6 py-3 text-base text-saffron-700 hover:bg-saffron-50">
              Open the app
              <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link href="/signup" className="btn inline-flex shrink-0 border border-white/70 bg-transparent px-6 py-3 text-base text-white hover:bg-white/10">
              Create an account
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-saffron-600 font-black text-white">से</span>
              <span className="font-extrabold">Setu</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-slate-500 dark:text-slate-400">
              A unified, offline-first lost-and-found network for the Kumbh Mela.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><a href="#features" className="transition-colors hover:text-saffron-700">Features</a></li>
              <li><a href="#how" className="transition-colors hover:text-saffron-700">How it works</a></li>
              <li><Link href="/login" className="transition-colors hover:text-saffron-700">Sign in</Link></li>
              <li><Link href="/signup" className="transition-colors hover:text-saffron-700">Sign up</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><Link href="/contact" className="transition-colors hover:text-saffron-700">Contact</Link></li>
              <li><Link href="/terms" className="transition-colors hover:text-saffron-700">Terms</Link></li>
              <li><Link href="/privacy" className="transition-colors hover:text-saffron-700">Privacy</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Get in touch</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-3 inline-block text-sm text-saffron-700 dark:text-saffron-300 hover:underline">
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-slate-400 dark:text-slate-500 sm:px-6 lg:px-8">
            © {new Date().getFullYear()} Setu. Built to reunite families at the Kumbh.
          </div>
        </div>
      </footer>

      {/* ----------------------------------------------- Animations (global) */}
      <style jsx global>{`
        /* scroll-reveal base state */
        [data-reveal].reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }
        [data-reveal].reveal.reveal-in {
          opacity: 1;
          transform: none;
        }
        .reveal-delay-1 {
          transition-delay: 0.12s;
        }
        .reveal-delay-2 {
          transition-delay: 0.24s;
        }

        /* floating color blobs */
        @keyframes blob {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(24px, -18px) scale(1.08);
          }
          66% {
            transform: translate(-18px, 14px) scale(0.94);
          }
        }
        .animate-blob {
          animation: blob 18s ease-in-out infinite;
        }
        .animate-blob-delay {
          animation-delay: 4s;
        }
        .animate-blob-slow {
          animation-duration: 26s;
        }

        /* gentle vertical float for the phone mock */
        @keyframes floaty {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        .animate-floaty {
          animation: floaty 5s ease-in-out infinite;
        }

        /* drifting sheen across the demo surface */
        @keyframes demoSheen {
          0% {
            transform: translateX(-120%) skewX(-12deg);
          }
          100% {
            transform: translateX(220%) skewX(-12deg);
          }
        }
        .demo-sheen {
          background: linear-gradient(
            100deg,
            transparent 0%,
            rgba(255, 255, 255, 0.35) 50%,
            transparent 100%
          );
          width: 50%;
          animation: demoSheen 6s ease-in-out infinite;
        }

        /* dotted grid texture for hero depth */
        .hero-grid {
          background-image: radial-gradient(
            currentColor 1px,
            transparent 1px
          );
          background-size: 28px 28px;
          color: rgb(148 163 184 / 0.35);
          mask-image: radial-gradient(
            ellipse at 50% 0%,
            black 30%,
            transparent 75%
          );
          -webkit-mask-image: radial-gradient(
            ellipse at 50% 0%,
            black 30%,
            transparent 75%
          );
        }

        /* language marquee */
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .marquee-track {
          animation: marquee 30s linear infinite;
        }
        .marquee-mask {
          mask-image: linear-gradient(
            to right,
            transparent,
            black 8%,
            black 92%,
            transparent
          );
          -webkit-mask-image: linear-gradient(
            to right,
            transparent,
            black 8%,
            black 92%,
            transparent
          );
        }

        @media (prefers-reduced-motion: reduce) {
          [data-reveal].reveal {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
          .animate-blob,
          .animate-floaty,
          .demo-sheen,
          .marquee-track {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
