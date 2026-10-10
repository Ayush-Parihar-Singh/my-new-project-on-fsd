import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LastPlate · Good Food Deserves Another Chance", template: "%s · LastPlate" },
  description: "LastPlate connects restaurants, hotels and events with verified nonprofits and volunteers so surplus food reaches people who need it.",
  applicationName: "LastPlate",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#245C45",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
