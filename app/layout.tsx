import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "theagentkit — project showcase",
  description: "Data collection + AI agent projects, use cases, and interview prep.",
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
