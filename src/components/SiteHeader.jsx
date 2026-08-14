"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/servicos", texto: "Serviços" },
  { href: "/planos", texto: "Planos" },
  { href: "/produtos", texto: "Produtos" },
];

export default function SiteHeader({ barbearia, usuario }) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();
  const destino = usuario?.papel === "admin" ? "/painel" : usuario?.papel === "colaborador" ? "/colaborador" : "/cliente";
  const agendamentoAtivo = barbearia?.agendamento_online_ativo !== false;

  return (
    <header className="site-header sticky top-0 z-50 border-b border-white/10 bg-tinta/95 text-marfim shadow-lg shadow-black/10 backdrop-blur-xl">
      <div className="poste" />
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label="WV Cortes — início">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-latao/50 font-display text-sm font-bold text-latao">WV</span>
          <span className="truncate font-display text-xl font-semibold tracking-wide sm:text-2xl">{barbearia?.nome || "WV Cortes"}</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
          {links.map((l) => <Link key={l.href} href={l.href} className={`rounded-lg px-4 py-2 text-sm transition ${caminho === l.href ? "bg-white/10 text-latao" : "text-marfim/70 hover:bg-white/5 hover:text-marfim"}`}>{l.texto}</Link>)}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href={usuario ? destino : "/entrar"} className="rounded-lg px-4 py-2 text-sm text-marfim/70 transition hover:text-white">{usuario ? "Minha conta" : "Entrar"}</Link>
          {agendamentoAtivo && <Link href="/agendar" className="rounded-lg bg-latao px-5 py-2.5 text-sm font-bold text-tinta transition hover:bg-white">Agendar horário</Link>}
        </div>

        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 lg:hidden" onClick={() => setAberto(v => !v)} aria-expanded={aberto} aria-controls="menu-mobile" aria-label={aberto ? "Fechar menu" : "Abrir menu"}>
          <span className="text-xl" aria-hidden="true">{aberto ? "×" : "☰"}</span>
        </button>
      </div>
      {aberto && (
        <nav id="menu-mobile" className="border-t border-white/10 bg-tinta px-4 pb-5 pt-3 lg:hidden" aria-label="Navegação mobile">
          {[...links, ...(agendamentoAtivo ? [{ href: "/agendar", texto: "Agendar horário" }] : [])].map(l => <Link key={l.href} href={l.href} className="block rounded-lg px-4 py-3 text-base text-marfim/85 hover:bg-white/5" onClick={() => setAberto(false)}>{l.texto}</Link>)}
          <Link href={usuario ? destino : "/entrar"} className="mt-2 block rounded-lg border border-latao/40 px-4 py-3 text-center font-semibold text-latao" onClick={() => setAberto(false)}>{usuario ? "Minha conta" : "Entrar"}</Link>
        </nav>
      )}
    </header>
  );
}
