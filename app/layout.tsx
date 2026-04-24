import type { Metadata } from "next";
import Script from "next/script";
import { DM_Sans, Outfit } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "All Qimem — Luxury Hospitality Management",
  description:
    "Multi-tenant hotel operations: HRMS, reservations, rooms, and platform administration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${outfit.variable} h-full antialiased`}
      style={
        {
          "--font-outfit": "var(--font-outfit)",
        } as React.CSSProperties
      }
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Script id="allqimem-theme-init" strategy="beforeInteractive">
          {`(function(){try{var k='allqimem-theme';var t=localStorage.getItem(k);
if(t==='light'){document.documentElement.classList.remove('dark');}
else if(t==='dark'){document.documentElement.classList.add('dark');}
else if(t==='system'){if(window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}
else{document.documentElement.classList.add('dark');}
}catch(e){}})();`}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
