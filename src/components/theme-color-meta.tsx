"use client";

import { useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import { themeColorFor } from "@/lib/pwa";

export function ThemeColorMeta() {
  const { theme } = useTheme();

  useEffect(() => {
    const color = themeColorFor(theme);
    let tag = document.querySelector('meta[name="theme-color"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "theme-color");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", color);
  }, [theme]);

  return null;
}
