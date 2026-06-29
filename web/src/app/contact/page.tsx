"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail, Send, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

const CONTACT_EMAIL = "hello@researchcommons.ai";

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      await api.contact(name.trim(), email.trim(), message.trim());
      setStatus("sent");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-saffron-700">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-saffron-600 font-black text-white">से</span>
            <span className="font-extrabold">Setu</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Contact us</h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Questions, a deployment request, or a data enquiry? Send us a note and
          we&apos;ll get back to you. You can also email us directly at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-saffron-700 hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <form onSubmit={submit} className="card space-y-4 p-6">
            <div>
              <label className="label" htmlFor="c-name">Name</label>
              <input
                id="c-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={status === "sending"}
              />
            </div>
            <div>
              <label className="label" htmlFor="c-email">Email</label>
              <input
                id="c-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="none"
                required
                disabled={status === "sending"}
              />
            </div>
            <div>
              <label className="label" htmlFor="c-message">Message</label>
              <textarea
                id="c-message"
                className="input min-h-[8rem] resize-y"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                disabled={status === "sending"}
              />
            </div>

            {status === "sent" && (
              <p className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700">
                <CheckCircle2 className="h-4 w-4" /> Thanks — we&apos;ll get back to you.
              </p>
            )}
            {status === "error" && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                Something went wrong. Please try again, or email us directly at {CONTACT_EMAIL}.
              </p>
            )}

            <button className="btn-primary w-full" disabled={status === "sending"}>
              {status === "sending" ? <Spinner className="h-5 w-5" /> : <Send className="h-5 w-5" />}
              Send message
            </button>
          </form>

          <aside className="card flex flex-col gap-4 p-6">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-saffron-100 text-saffron-700">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold">Email us</p>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-saffron-700 hover:underline">
                {CONTACT_EMAIL}
              </a>
            </div>
            <p className="text-sm text-slate-600">
              For data access, correction or deletion requests, please include
              the relevant case ID where possible.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
