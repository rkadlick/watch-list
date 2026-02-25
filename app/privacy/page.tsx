import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Watch List",
  description: "Privacy policy for Watch List",
  robots: "noindex, nofollow",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert dark:prose-invert max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mt-6 mb-3">Overview</h2>
            <p>
              Watch List is a personal, invite-only project that tracks movies and TV shows. 
              This privacy policy explains how we handle your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-6 mb-3">Data Collection</h2>
            <p>
              Watch List collects minimal data required to function:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Authentication credentials via Clerk</li>
              <li>Your watch list and personal movie/TV show preferences</li>
              <li>Basic usage analytics (optional, via Sentry)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-6 mb-3">Third-Party Services</h2>
            <p>
              Watch List uses the following third-party services:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Clerk</strong> - Authentication and user management</li>
              <li><strong>Convex</strong> - Backend database</li>
              <li><strong>TMDB</strong> - Movie and TV show data</li>
              <li><strong>Sentry</strong> - Error tracking (optional)</li>
            </ul>
            <p className="mt-3">
              Please review their privacy policies for information on how they handle your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-6 mb-3">Data Retention</h2>
            <p>
              Your data is retained for as long as you maintain an active account. 
              Upon account deletion, your data will be removed from our systems.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-6 mb-3">Contact</h2>
            <p>
              For questions about this privacy policy, please contact us on{" "}
              <a 
                href="https://github.com/rkadlick" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-6 mb-3">Last Updated</h2>
            <p>February 24, 2026</p>
          </section>
        </div>
      </div>
    </div>
  );
}
