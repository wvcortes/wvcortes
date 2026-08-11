"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function PainelShell({ usuario, menu, titulo, children }) {
  const caminho = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  async function sair() {
    await fetch("/api/auth/sair", { method: "POST" });
    router.push("/entrar");
    router.refresh();
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <aside className="flex flex-col bg-tinta text-marfim md:min-h-screen">
        <div className="flex items-center justify-between px-6 py-6">
          <div>
            <p className="font-display text-xl leading-none">{usuario.nome}</p>
            <p className="etiqueta mt-1.5 text-latao">{usuario.papel}</p>
          </div>
          <button className="etiqueta md:hidden" onClick={() => setAberto((v) => !v)}>
            {aberto ? "fechar" : "menu"}
          </button>
        </div>

        <nav className={`${aberto ? "block" : "hidden"} px-3 pb-6 md:block`}>
          {menu.map((m) => {
            const ativo = caminho === m.href;
            return (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setAberto(false)}
                className={`block px-3 py-2.5 text-sm transition ${
                  ativo ? "bg-couro text-marfim" : "text-marfim/65 hover:bg-marfim/8 hover:text-marfim"
                }`}
              >
                {m.texto}
              </Link>
            );
          })}
          <div className="mt-6 border-t border-marfim/12 pt-4">
            <Link href="/" className="block px-3 py-2 text-sm text-marfim/50 hover:text-latao">
              Ver o site
            </Link>
            <button
              onClick={sair}
              className="block w-full px-3 py-2 text-left text-sm text-marfim/50 hover:text-latao"
            >
              Sair
            </button>
          </div>
        </nav>
      </aside>

      <main className="bg-marfim px-5 py-8 md:px-10 md:py-12">
        {titulo ? <h1 className="mb-8 font-display text-4xl">{titulo}</h1> : null}
        {children}
      </main>
    </div>
  );
}
