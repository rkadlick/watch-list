"use client";

import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Moon, Sun, Monitor } from "lucide-react";

type ThemeOption = "light" | "dark" | "system";

const ICONS: Record<ThemeOption, React.ReactNode> = {
  light: <Sun className="h-4 w-4" />,
  dark: <Moon className="h-4 w-4" />,
  system: <Monitor className="h-4 w-4" />,
};

function resolveTheme(preference: ThemeOption) {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeOption>("system");

  // Apply theme to document
  useEffect(() => {
    const stored = window.localStorage.getItem("theme") as ThemeOption | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (value: ThemeOption) => {
      const resolved = resolveTheme(value);
      document.documentElement.classList.toggle("dark", resolved === "dark");
      window.localStorage.setItem("theme", value);
    };

    apply(theme);

    const handleChange = () => {
      if (theme === "system") {
        apply("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const icon = useMemo(() => ICONS[resolveTheme(theme)], [theme]);

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value as ThemeOption)}>
      <SelectTrigger className="w-[140px]">
        <div className="flex items-center gap-2">
          {icon}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
        <SelectItem value="system">System</SelectItem>
      </SelectContent>
    </Select>
  );
}

