"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PainelShell({ usuario, menu, titulo, children }) {
  const caminho = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [aberto]);

  async function sair() {
    await fetch("/api/auth/sair", { method: "POST" });
    router.push("/entrar");
    router.refresh();
  }

  return (
    <div className="admin-shell min-h-[100dvh] bg-[#09100d] text-[#f4f1e8] md:grid md:h-[100dvh] md:grid-cols-[272px_minmax(0,1fr)] md:overflow-hidden">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#101a15]/95 px-4 backdrop-blur md:hidden">
        <div><p className="font-semibold">WV Cortes</p><p className="text-xs text-[#aeb4ad]">Painel administrativo</p></div>
        <button aria-expanded={aberto} aria-controls="admin-menu" className="rounded-lg border border-white/15 px-3 py-2 text-sm text-[#e2924a]" onClick={() => setAberto(true)}>Menu</button>
      </header>
      {aberto ? <button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-black/65 md:hidden" onClick={() => setAberto(false)} /> : null}
      <aside id="admin-menu" className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,300px)] flex-col border-r border-white/10 bg-[#101a15] shadow-2xl transition-transform duration-300 md:sticky md:top-0 md:z-auto md:h-[100dvh] md:w-auto md:translate-x-0 md:shadow-none ${aberto ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#e2924a]">WV Cortes</p><p className="mt-2 font-semibold leading-none">{usuario.nome}</p><p className="mt-1 text-xs text-[#9ea69e]">Administrador</p></div>
          <button className="rounded-lg p-2 text-xl text-[#b9b8ad] md:hidden" aria-label="Fechar menu" onClick={() => setAberto(false)}>×</button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-gutter:stable]">
          {menu.map((m) => {
            const ativo = caminho === m.href;
            return <div key={m.href}>
              {m.grupo ? <p className="mb-2 mt-4 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#758077] first:mt-0">{m.grupo}</p> : null}
              <Link href={m.href} onClick={() => setAberto(false)} className={`mb-1 block rounded-lg px-3 py-2.5 text-sm transition ${ativo ? "bg-[#c96f32] text-white shadow-lg shadow-black/15" : "text-[#c7cbc5] hover:bg-white/[.06] hover:text-white"}`}>{m.texto}</Link>
            </div>;
          })}
          <div className="mt-6 border-t border-white/10 pt-4">
            <Link href="/" className="block px-3 py-2 text-sm text-[#9ea69e] hover:text-[#e2924a]">Ver o site</Link>
            <button onClick={sair} className="block w-full px-3 py-2 text-left text-sm text-[#9ea69e] hover:text-[#e2924a]">Sair</button>
          </div>
        </nav>
      </aside>
      <main className="admin-main min-h-0 min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 md:h-[100dvh] md:overflow-y-auto md:px-8 md:py-8 xl:px-10">
        {titulo ? <h1 className="mb-8 text-3xl font-bold">{titulo}</h1> : null}
        {children}
      </main>
    </div>
  );
}
