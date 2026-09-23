import type { Metadata } from "next";
import Link from "next/link";
import { GITHUB_URL, GitHubIcon, LINKEDIN_URL, LinkedInIcon } from "@/components/SocialIcons";
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
      <body className="flex min-h-screen flex-col bg-white text-base text-ink antialiased">
        <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              theagentkit
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="theagentkit on GitHub"
              className="text-ink/70 transition hover:text-ink"
            >
              <GitHubIcon size={22} />
            </a>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-black/5 bg-paper">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted sm:flex-row">
            <p>Built by Tejas Bal</p>
            <div className="flex items-center gap-6">
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 transition hover:text-ink"
              >
                <LinkedInIcon size={18} />
                LinkedIn
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 transition hover:text-ink"
              >
                <GitHubIcon size={18} />
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
