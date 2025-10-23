
"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const t = useTranslations('ThemeToggle');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) {
    // Render a placeholder or nothing on the server and during initial client render
    return <div className="h-10 w-10" />;
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('toggleTheme')} className="hover:bg-primary/10 hover:text-primary">
      {resolvedTheme === 'dark' ? (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      )}
    </Button>
  );
}

    