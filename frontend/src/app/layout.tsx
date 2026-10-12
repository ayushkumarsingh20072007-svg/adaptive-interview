import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "InterviewIQ — Adaptive Interview Intelligence",
  description:
    "AI-powered technical interview platform that analyzes candidate resumes, pinpoints skill gaps, and conducts adaptive live technical interviews.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[#090e1a] text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-x-hidden"
      >
        <AuthProvider>
          <Suspense fallback={<header className="h-16 w-full border-b border-slate-800 bg-[#090e1a]/95" />}>
            <Navbar />
          </Suspense>
          <main className="flex-1 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col relative z-10">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
