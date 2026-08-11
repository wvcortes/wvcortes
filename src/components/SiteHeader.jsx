"use client";
import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/servicos", texto: "Serviços" },
  { href: "/planos", texto: "Planos" },
  { href: "/agendar", texto: "Agenda" },
];

export default function SiteHeader({ barbearia, usuario }) {
  const [aberto, setAberto] = useState(false);
  const destino =
    usuario?.papel === "admin"
      ? "/painel"
      : usuario?.papel === "colaborador"
      ? "/colaborador"
      : "/cliente";

  return (
    <header className="sticky top-0 z-40 border-b border-tinta/10 bg-marfim/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="leading-none">
          <span className="font-display text-2xl font-semibold tracking-tight">
            {barbearia?.nome || "Navalha"}
          </span>
          <span className="etiqueta ml-3 hidden text-tinta/45 sm:inline">est. barbearia</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="etiqueta text-tinta/70 hover:text-couro">
              {l.texto}
            </Link>
          ))}
          {usuario ? (
            <Link href={destino} className="etiqueta bg-tinta px-4 py-2.5 text-marfim hover:bg-couro">
              {usuario.papel === "cliente" ? "Minha conta" : "Painel"}
            </Link>
          ) : (
            <Link href="/entrar" className="etiqueta bg-tinta px-4 py-2.5 text-marfim hover:bg-couro">
              Entrar
            </Link>
          )}
        </nav>

        <button
          className="etiqueta md:hidden"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-label="Abrir menu"
        >
          {aberto ? "fechar" : "menu"}
        </button>
      </div>

      {aberto && (
        <div className="border-t border-tinta/10 bg-marfim px-5 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="etiqueta" onClick={() => setAberto(false)}>
                {l.texto}
              </Link>
            ))}
            <Link href={usuario ? destino : "/entrar"} className="etiqueta text-couro">
              {usuario ? "Minha conta" : "Entrar"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
