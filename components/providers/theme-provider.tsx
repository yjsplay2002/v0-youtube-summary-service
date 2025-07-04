"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);

  // useEffect는 클라이언트 사이드에서만 실행됩니다
  useEffect(() => {
    setMounted(true);
  }, []);

  // 클라이언트 사이드에서 마운트되기 전까지는 children만 렌더링
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <NextThemesProvider
      attribute={attribute}
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      disableTransitionOnChange={disableTransitionOnChange}
    >
      {children}
    </NextThemesProvider>
  );
}