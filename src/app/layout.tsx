import type { Metadata } from "next";
import "./globals.css";
import { AuctionProvider } from "@/lib/state/auction-store";

export const metadata: Metadata = {
  title: "Astra — Copilota Asta Fantacalcio",
  description: "Assistente decisionale per l'asta del fantacalcio",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuctionProvider>{children}</AuctionProvider>
      </body>
    </html>
  );
}
