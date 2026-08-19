import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Da Next.js 15.2+ il dev server blocca per sicurezza gli asset
  // (/_next/*) richiesti da un'origine diversa da "localhost" — è la
  // mitigazione della CVE-2025-48068. Senza questa whitelist, aprire
  // l'app da un altro dispositivo sulla stessa rete (es. iPad via IP
  // locale) carica la pagina ma blocca il JavaScript: React non si
  // aggancia mai e ogni pulsante resta inerte, senza errori visibili.
  //
  // Sostituisci con l'indirizzo IP locale del computer che esegue
  // `npm run dev` (lo trovi con `ipconfig` su Windows o `ifconfig`/
  // `ip addr` su Mac/Linux, es. "192.168.1.23") — NON supporta notazione
  // CIDR (verificato sulla documentazione ufficiale), serve l'IP esatto.
  // Va aggiornato se cambi rete wifi.
  allowedDevOrigins: ["192.168.1.23"],
};

export default nextConfig;
