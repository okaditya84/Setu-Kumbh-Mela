import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Use — Setu",
  description: "Terms of use for the Setu Kumbh lost-and-found network.",
};

const CONTACT_EMAIL = "hello@researchcommons.ai";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-3 text-slate-600 dark:text-slate-400">{children}</div>
    </section>
  );
}

export default function TermsPage() {
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
        <h1 className="text-3xl font-extrabold tracking-tight">Terms of Use</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated: 29 June 2026</p>

        <p className="mt-6 text-slate-600 dark:text-slate-400">
          These terms govern your use of Setu, a lost-and-found coordination
          service for large public gatherings such as the Kumbh Mela. By using
          Setu, you agree to these terms. Setu is provided to help reunite
          separated people; it is a coordination tool and not an emergency
          service.
        </p>

        <Section title="1. Purpose of the service">
          <p>
            Setu lets volunteers, control-room staff and members of the public
            register reports of missing or found persons and match them across
            participating lost-and-found centers. It is intended solely for
            genuine reunification efforts.
          </p>
        </Section>

        <Section title="2. Acceptable use">
          <p>You agree to use Setu only for lawful, good-faith reunification, and not to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>submit false, misleading or malicious reports;</li>
            <li>attempt to claim or collect a person you are not authorised to;</li>
            <li>access or extract data about people you have no legitimate reason to view;</li>
            <li>misuse the verification feature to impersonate a family member;</li>
            <li>disrupt, overload or attempt to breach the security of the service.</li>
          </ul>
        </Section>

        <Section title="3. Verification and reunions">
          <p>
            Setu offers a secret-question check to help confirm a true family
            member before a person is released. This is an assistive safeguard,
            not a guarantee of identity. Final decisions about releasing any
            person — especially a child or vulnerable adult — rest with the
            responsible on-site authorities and must follow local law and
            safeguarding procedures.
          </p>
        </Section>

        <Section title="4. No emergency guarantee">
          <p>
            Setu does not replace police, medical or emergency services. In an
            emergency, contact the local authorities directly. The service may be
            unavailable, delayed, or affected by network conditions, and we do
            not warrant uninterrupted or error-free operation.
          </p>
        </Section>

        <Section title="5. Accounts and access">
          <p>
            Operator accounts are provided to authorised volunteers and staff.
            You are responsible for keeping your credentials secure and for
            activity under your account. We may suspend access that appears to
            violate these terms or to protect the people in the registry.
          </p>
        </Section>

        <Section title="6. Privacy">
          <p>
            Setu is built privacy-first. Our handling of personal information is
            described in our{" "}
            <Link href="/privacy" className="font-medium text-saffron-700 dark:text-saffron-300 hover:underline">Privacy Policy</Link>,
            which forms part of these terms.
          </p>
        </Section>

        <Section title="7. Limitation of liability">
          <p>
            To the extent permitted by law, Setu and its providers are not liable
            for indirect or consequential losses arising from use of, or
            inability to use, the service. The service is provided on an
            &quot;as is&quot; and &quot;as available&quot; basis.
          </p>
        </Section>

        <Section title="8. Changes to these terms">
          <p>
            We may update these terms from time to time. Continued use after an
            update means you accept the revised terms.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            Questions about these terms? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-saffron-700 dark:text-saffron-300 hover:underline">{CONTACT_EMAIL}</a>{" "}
            or use our{" "}
            <Link href="/contact" className="font-medium text-saffron-700 dark:text-saffron-300 hover:underline">contact form</Link>.
          </p>
        </Section>
      </main>
    </div>
  );
}
