import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { vulfSans, plexSans, canela } from "./fonts";

export const metadata: Metadata = {
  title: "Refs — biblioteca de referências",
  description: "Sua biblioteca de referências visuais, organizada por IA.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${vulfSans.variable} ${plexSans.variable} ${canela.variable}`}>
      <body>
        {children}
        <Toaster position="bottom-right" theme="system" richColors />
      </body>
    </html>
  );
}
