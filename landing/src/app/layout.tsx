import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SafeSkill — Is your MCP setup safe?",
  description:
    "1 in 4 MCP servers has security issues. Scan yours in seconds. Free, open-source security audit for the MCP ecosystem.",
  openGraph: {
    title: "SafeSkill — Is your MCP setup safe?",
    description:
      "We scanned 3,093 MCP servers. 28% had security findings. Check yours now.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SafeSkill — Is your MCP setup safe?",
    description:
      "We scanned 3,093 MCP servers. 28% had security findings. Check yours now.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
