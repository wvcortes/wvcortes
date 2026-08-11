import "./globals.css";
import { pegarBarbearia } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  let nome = "WV Cortes";
  let slogan = "Corte, barba e cuidado com hora marcada.";
  try {
    const b = await pegarBarbearia();
    nome = b.nome;
    slogan = b.slogan;
  } catch {}
  return { title: `${nome}`, description: slogan };
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,600;6..96,800&family=Karla:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-corpo">{children}</body>
    </html>
  );
}
