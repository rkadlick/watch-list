import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact - Watch List",
  description: "Get in touch with Watch List",
  robots: "noindex, nofollow",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Contact</h1>
        
        <div className="prose prose-invert dark:prose-invert max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Get In Touch</h2>
            <p>
              Watch List is a personal, invite-only project. For inquiries, suggestions, 
              or other matters, please reach out on GitHub.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-6 mb-4">GitHub</h2>
            <p>
              Visit my GitHub profile at{" "}
              <a 
                href="https://github.com/rkadlick" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-semibold"
              >
                github.com/rkadlick
              </a>
              {" "}to get in touch.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-6 mb-4">Report Issues</h2>
            <p>
              Found a bug or have a feature request? Please open an issue on the{" "}
              <a 
                href="https://github.com/rkadlick/watch-list" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Watch List GitHub repository
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
