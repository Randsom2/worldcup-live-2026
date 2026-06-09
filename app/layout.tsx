import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scores Coupe du Monde 2026",
  description:
    "Suivez les scores en direct et le calendrier de la Coupe du Monde 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
