import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/ConvexProvider";
import "./globals.css";
import { Toaster } from "@/components/ui/Sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
// Environment validation runs automatically via lib/env-check.ts import
import "@/lib/env-check";

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
  // Environment validation runs automatically on import of lib/env-check.ts
  // No need to call validation functions here

  return (
    <html lang="en">

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          {/* @ts-expect-error - Satellite mode props are valid but not fully typed in this Clerk version */}
          <ClerkProvider
            isSatellite
            domain={(process.env.NEXT_PUBLIC_CLERK_DOMAIN as string) || undefined}
            proxyUrl={(process.env.NEXT_PUBLIC_CLERK_PROXY_URL as string) || undefined}
          >
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ClerkProvider>
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  );
}
