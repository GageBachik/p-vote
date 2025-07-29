import type { Metadata } from "next";
import { Fira_Code, Oxanium } from "next/font/google";
import "./globals.css";
import * as Tooltip from "@radix-ui/react-tooltip";

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const oxanium = Oxanium({
  variable: "--font-oxanium",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "DegenVote ⚡ - Cyberpunk Terminal",
  description: "Decentralized voting platform where the biggest token wins",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${firaCode.variable} ${oxanium.variable} antialiased`}>
        <Tooltip.Provider delayDuration={200}>{children}</Tooltip.Provider>
      </body>
    </html>
  );
}
