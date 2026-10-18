import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RegisterServiceWorker } from "@/components/register-sw";
import { ThemeColorMeta } from "@/components/theme-color-meta";
import { ThemeProvider } from "@/components/theme-provider";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Panel Treasury",
  applicationName: "Panel Treasury",
  description: "Centralized multi-panel fund management for SMM X PANEL Admin API v2",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Treasury",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="dark">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <ThemeColorMeta />
          <RegisterServiceWorker />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
