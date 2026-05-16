import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { ThemeProvider } from "@/components/layout/theme-provider";
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
  title: "Command Center - UP3 Mataram",
  description: "Sistem monitoring laporan gangguan pelanggan",
  icons: {
    icon: [{ url: "/live-chat.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="h-full antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <NextTopLoader
            color="#0070C0"
            initialPosition={0.08}
            crawlSpeed={200}
            height={2}
            crawl
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow="0 0 8px #0070C0,0 0 4px #3B9EFF"
            zIndex={9999}
          />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
