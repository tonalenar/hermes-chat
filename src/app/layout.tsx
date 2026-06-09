import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hermes Chat",
  description: "AI-powered chat interface for Hermes Agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ height: "100%" }}>
      <body style={{ margin: 0, minHeight: "100%", background: "#0a0a0b", color: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
