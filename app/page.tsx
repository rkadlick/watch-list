"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export default function Home() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
    }, 0);
    
    // Resolve the current theme
    const resolveTheme = () => {
      // First check localStorage for user preference
      const storedTheme = window.localStorage.getItem("theme");
      
      if (storedTheme === "dark") {
        return true;
      } else if (storedTheme === "light") {
        return false;
      }
      
      // If "system" or not set, check system preference
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return systemPrefersDark;
    };
    
    // Check if dark mode is active
    const checkDarkMode = () => {
      // Check document class first (set by ThemeToggle)
      const docHasDark = document.documentElement.classList.contains("dark");
      
      // If document has explicit class, use that; otherwise resolve from preferences
      if (document.documentElement.classList.contains("dark") || 
          document.documentElement.classList.contains("light")) {
        setIsDark(docHasDark);
      } else {
        setIsDark(resolveTheme());
      }
    };
    
    checkDarkMode();
    
    // Watch for theme changes on document
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ["class"] 
    });
    
    // Watch for system theme preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      const storedTheme = window.localStorage.getItem("theme");
      // Only respond to system changes if theme is "system" or not set
      if (!storedTheme || storedTheme === "system") {
        setIsDark(mediaQuery.matches);
      }
    };
    mediaQuery.addEventListener("change", handleMediaChange);
    
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  useEffect(() => {
    if (isLoaded && user) {
      router.push("/dashboard");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  // Determine which images to show based on screen size and theme
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const bgImage = isDark
    ? isMobile
      ? "/images/homepage/mobile-dark.png"
      : "/images/homepage/desktop-dark.png"
    : isMobile
      ? "/images/homepage/mobile-light.png"
      : "/images/homepage/desktop-light.png";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Blurred Background Image */}
      <div 
        className="absolute z-0"
        style={{
          top: "-20px",
          left: "-20px",
          right: "-20px",
          bottom: "-20px",
          backgroundImage: `url('${bgImage}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "blur(8px)",
        }}
      />

      {/* Content Card - using app theme colors */}
      <div 
        className="relative z-10 mx-4 w-full max-w-md rounded-xl shadow-lg"
        style={{
          // Dark: #22252b (--card), Light: #ffffff (--card)
          backgroundColor: isDark ? "#22252b" : "#ffffff",
        }}
      >
        <div className="py-8 px-6 text-center space-y-6">
          <div className="space-y-2">
            <h1 
              className="text-4xl md:text-5xl font-bold"
              // Dark: #eaeff7 (--card-foreground), Light: #1b2435 (--card-foreground)
              style={{ color: isDark ? "#eaeff7" : "#1b2435" }}
            >
              Watch List
            </h1>
            <p 
              className="text-lg md:text-xl"
              // Dark: #a7b0c2 (--muted-foreground), Light: #5a6072 (--muted-foreground)
              style={{ color: isDark ? "#a7b0c2" : "#5a6072" }}
            >
              Track your favorite movies and TV shows
            </p>
          </div>
          <Button 
            onClick={() => router.push("/dashboard")}
            size="lg"
            className="text-lg px-8 py-6"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
