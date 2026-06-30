import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacy Policy - Setu",
  description: "How Setu protects the personal data of people in the lost-and-found registry.",
};

const CONTACT_EMAIL = "adityajethani11@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-3 text-slate-600 dark:text-slate-400">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-saffron-700">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-saffron-600 font-black text-white">से</span>
            <span className="font-extrabold">Setu</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 dark:bg-teal-950/40 px-3 py-1 text-sm font-medium text-teal-700 dark:text-teal-300 ring-1 ring-teal-100">
          <ShieldCheck className="h-4 w-4" /> Privacy by design
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated: 29 June 2026</p>

        <p className="mt-6 text-slate-600 dark:text-slate-400">
          Setu handles sensitive information about vulnerable people - children,
          elders and those who are lost. We collect the minimum needed to reunite
          them with their families, protect it carefully, and delete it as soon
          as it is no longer needed.
        </p>

        <Section title="Our principles">
          <ul className="list-disc space-y-1 pl-5">
            <li><span className="font-medium text-slate-800 dark:text-slate-200">Minimal data.</span> We only collect what helps make a match.</li>
            <li><span className="font-medium text-slate-800 dark:text-slate-200">Masked &amp; hashed PII.</span> Direct identifiers such as contact numbers and verification answers are masked or hashed, not stored in the clear.</li>
            <li><span className="font-medium text-slate-800 dark:text-slate-200">No biometric storage by default.</span> We do not run or store facial-recognition templates by default; photos, where used, are for human eyes only.</li>
            <li><span className="font-medium text-slate-800 dark:text-slate-200">Auto-purge.</span> Case data is automatically purged after reunification or after a short retention window.</li>
          </ul>
        </Section>

        <Section title="What we collect">
          <p>For a missing or found report, we may collect:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>a description of the person (name if known, approximate age, gender, language, clothing, last-seen location);</li>
            <li>an optional photo, captured to aid identification;</li>
            <li>an optional voice sample and the spoken-language transcript used to fill the report;</li>
            <li>a family contact number, stored in masked form;</li>
            <li>an optional secret question and answer, where the answer is stored only as a one-way hash for verification.</li>
          </ul>
        </Section>

        <Section title="How we use it">
          <p>
            We use this information solely to match missing and found reports
            across participating centers, to verify a genuine family member
            before a reunion, and to produce announcements that help locate the
            person. Aggregated, non-identifying statistics (such as reunion rates
            and hotspots) may be used to improve coordination on the ground.
          </p>
        </Section>

        <Section title="How we protect it">
          <p>
            Contact numbers are masked and verification answers are stored as
            one-way hashes, so they cannot be read back. Access to records is
            restricted to authorised operators. Data can be captured and held
            offline on a device and is transmitted securely when syncing.
          </p>
        </Section>

        <Section title="Retention and deletion">
          <p>
            Once a person is reunited, their case is closed and the associated
            personal data is purged on a scheduled basis. Open cases are retained
            only for the duration of the event plus a short window needed to
            complete reunifications, after which they are deleted.
          </p>
        </Section>

        <Section title="Sharing">
          <p>
            We do not sell personal data. Information is shared only with the
            participating lost-and-found centers and the responsible authorities
            for the purpose of reuniting the person, or where required by law.
          </p>
        </Section>

        <Section title="Children and vulnerable people">
          <p>
            Much of this data concerns minors and vulnerable adults. Releases are
            handled by on-site authorities following safeguarding procedures;
            Setu&apos;s verification step is an additional protection against
            impersonation, not a substitute for those procedures.
          </p>
        </Section>

        <Section title="Your rights and data requests">
          <p>
            You can ask us to access, correct or delete personal data relating to
            a case. Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-saffron-700 dark:text-saffron-300 hover:underline">{CONTACT_EMAIL}</a>{" "}
            with the case ID where possible, or use our{" "}
            <Link href="/contact" className="font-medium text-saffron-700 dark:text-saffron-300 hover:underline">contact form</Link>.
            Because data may be purged automatically after reunification, some
            records may no longer exist by the time of a request.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy as the service evolves. Material changes
            will be reflected by the &quot;last updated&quot; date above.
          </p>
        </Section>
      </main>
    </div>
  );
}
