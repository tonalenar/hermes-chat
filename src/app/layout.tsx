import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SupabaseProvider } from "@/lib/supabase-context";

export const metadata: Metadata = {
  title: "Hermes Chat",
  description: "Premium AI chat powered by Hermes",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="m-0 min-h-full antialiased">
        <SupabaseProvider>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
