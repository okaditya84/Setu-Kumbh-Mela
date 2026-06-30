import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { themeInitScript } from "@/lib/theme";

// Canonical public origin. Override with NEXT_PUBLIC_SITE_URL when a custom
// domain is attached; defaults to the live Cloud Run URL.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://setu-web-504310368574.asia-south1.run.app";

const DESCRIPTION =
  "Setu is a free, offline-first, voice-first lost-and-found network for the Kumbh Mela. " +
  "Report a missing or found person by speaking in any Indian language; Setu matches across " +
  "every camp and center automatically and reunites families faster. Works offline, protects " +
  "privacy, and supports 12+ Indian languages.";

const KEYWORDS = [
  "Kumbh Mela lost and found",
  "missing person Kumbh Mela",
  "Nashik Kumbh 2027",
  "Trimbakeshwar Kumbh",
  "lost and found app",
  "find missing person India",
  "Kumbh Mela helpline",
  "reunite families Kumbh",
  "voice lost and found",
  "offline lost and found",
  "Setu",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Setu - Lost & Found Network for the Kumbh Mela",
    template: "%s | Setu",
  },
  description: DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: "Setu",
  authors: [{ name: "Setu" }],
  creator: "Setu",
  publisher: "Setu",
  category: "PublicSafety",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Setu" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "Setu",
    title: "Setu - Lost & Found Network for the Kumbh Mela",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_IN",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Setu - Lost & Found Network for the Kumbh Mela",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Setu - Lost & Found Network for the Kumbh Mela",
    description: DESCRIPTION,
    images: ["/icon-512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ea580c" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Structured data (JSON-LD). Helps Google rich results AND answer/generative
// engines (AEO/GEO) understand what Setu is, what it does, and how to cite it.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Setu",
      description: DESCRIPTION,
      inLanguage: ["en", "hi", "mr", "gu", "ta", "te", "kn", "bn", "ml", "or", "pa", "as", "ur"],
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Setu",
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
      email: "adityajethani11@gmail.com",
      description:
        "Setu builds a unified, offline-first lost-and-found network that reunites families separated at the Kumbh Mela.",
    },
    {
      "@type": "SoftwareApplication",
      name: "Setu",
      applicationCategory: "PublicSafetyApplication",
      operatingSystem: "Web, Android, iOS",
      url: SITE_URL,
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      featureList: [
        "Voice-first intake in any Indian language",
        "Cross-center probabilistic matching",
        "Anti-impersonation secret-question verification",
        "Live situational map",
        "Works fully offline and syncs automatically",
        "Multilingual interface across 12+ Indian languages",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Setu?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Setu is a free, offline-first, voice-first lost-and-found network for the Kumbh Mela. Anyone can report a missing or found person by speaking in their own language, and Setu matches reports across every camp and center to reunite families faster.",
          },
        },
        {
          "@type": "Question",
          name: "How do I report a missing person at the Kumbh Mela?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Open Setu, create a free account, tap the big record button and describe the person in any Indian language. Setu fills the report for you and instantly searches every lost-and-found center for possible matches.",
          },
        },
        {
          "@type": "Question",
          name: "Does Setu work without internet?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Setu is offline-first: reports are saved on the device and sync automatically when the network returns, so it keeps working in crowded areas with weak signal.",
          },
        },
        {
          "@type": "Question",
          name: "Which languages does Setu support?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Setu supports voice input and a full interface in 12+ Indian languages including Hindi, Marathi, Gujarati, Tamil, Telugu, Kannada, Bengali, Malayalam, Odia, Punjabi, Assamese and Urdu, plus English.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint - prevents a light flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Structured data for search + answer/generative engines. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
