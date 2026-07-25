import localFont from "next/font/local";
import { IBM_Plex_Sans } from "next/font/google";

// Título do card e do modal de detalhe — a única weight disponível do kit
// (as demais do Temp original tinham arquivo trocado/corrompido, descartadas).
export const vulfSans = localFont({
  src: "../fonts/VulfSans-Bold.woff2",
  weight: "700",
  style: "normal",
  variable: "--font-vulf",
  display: "swap",
});

// Corpo: categoria, descrição, tags, labels — papel de metadado/leitura.
export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

// Headline "Refs." — único uso, papel de marca.
export const canela = localFont({
  src: "../fonts/Canela-Medium.otf",
  weight: "500",
  style: "normal",
  variable: "--font-canela",
  display: "swap",
});
