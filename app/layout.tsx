import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const SITE_URL = "https://www.theagentkit.info";
const DESCRIPTION =
  "Learning in public: real AI agent projects built end to end, from collecting the raw data to RAG and knowing when not to use an LLM. Try each one live.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "theagentkit: from raw data to AI-ready agents",
    template: "%s | theagentkit",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "theagentkit",
    title: "theagentkit: from raw data to AI-ready agents",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "theagentkit: from raw data to AI-ready agents",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-ink antialiased">
        <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex h-11 max-w-6xl items-center px-6">
            <Link href="/" className="text-[15px] font-semibold tracking-tight">
              theagentkit
            </Link>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
