import "~/styles/globals.css";

import { type Metadata } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "DOOBLE",
  description: "Sistema de gestión de visitas técnicas",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-barlow",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800", "900"],
  variable: "--font-barlow-condensed",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-jetbrains",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${barlow.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-[#eef1f6] font-[family-name:var(--font-barlow)] text-[15px] leading-relaxed text-[#3d4f63]">
        <Auth0Provider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </Auth0Provider>
      </body>
    </html>
  );
}
