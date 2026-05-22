import { Inter } from "next/font/google";

import { AppProviders } from "@/components/providers";
import { cn } from "@/lib/utils";

import "./globals.css";
import "highlight.js/styles/github.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          inter.className,
          "min-h-screen antialiased"
        )}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
