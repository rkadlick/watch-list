import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/ConvexProvider";
import "./globals.css";
import { Toaster } from "@/components/ui/Sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { validateEnv } from "@/lib/env";
import { validateServerEnv } from "@/lib/env-check";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Watch List - Movie & TV Tracker",
  description: "Track your favorite movies and TV shows",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  if (typeof window === "undefined") {
    // Server-only validation
    validateServerEnv();
  }

  // Client-side (browser-exposed NEXT_PUBLIC_*) validation
  if (process.env.NODE_ENV === "development") {
    validateEnv();
  }

  return (
    <html lang="en">

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <ClerkProvider>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ClerkProvider>
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  );
}
