import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Refs — biblioteca de referências",
  description: "Sua biblioteca de referências visuais, organizada por IA.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Toaster position="bottom-right" theme="system" richColors />
      </body>
    </html>
  );
}
