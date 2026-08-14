"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ApresentacaoProfissional from "@/components/ApresentacaoProfissional";
import { resolverFotoColaborador } from "@/lib/fotoColaborador";

export default function EquipePublica({ equipe }) {
  const [selecionado, setSelecionado] = useState(null);
  const dialogRef = useRef(null);
  const gatilhoRef = useRef(null);

  function abrir(profissional, elemento) {
    gatilhoRef.current = elemento;
    setSelecionado(profissional);
  }

  function fechar() {
    setSelecionado(null);
    requestAnimationFrame(() => gatilhoRef.current?.focus());
  }

  useEffect(() => {
    if (!selecionado) return;
    const dialog = dialogRef.current;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.focus();

    function aoTeclado(evento) {
      if (evento.key === "Escape") fechar();
      if (evento.key !== "Tab" || !dialog) return;
      const focaveis = dialog.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclado);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclado);
    };
  }, [selecionado]);

  return (
    <>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {equipe.map((profissional) => {
          const temBiografia = Boolean(profissional.biografia?.trim());
          const fotoSrc = resolverFotoColaborador(profissional.foto_url);
          const conteudo = (
            <>
              {fotoSrc ? (
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image src={fotoSrc} alt={`Profissional ${profissional.nome}`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-couro/40 font-display text-5xl text-latao" aria-hidden="true">{profissional.nome?.[0]}</div>
              )}
              <div className="p-6 text-left">
                <h3 className="font-display text-2xl">{profissional.nome}</h3>
                <p className="mt-1 text-sm text-marfim/55">{profissional.especialidade || "Barbeiro"}</p>
                {temBiografia && <p className="mt-4 text-xs font-semibold uppercase tracking-[.14em] text-latao">Conheça o profissional →</p>}
              </div>
            </>
          );

          return temBiografia ? (
            <button key={profissional.id} type="button" onClick={(evento) => abrir(profissional, evento.currentTarget)} aria-haspopup="dialog" className="group w-full overflow-hidden rounded-2xl bg-tinta text-marfim shadow-carta transition hover:-translate-y-1 hover:ring-1 hover:ring-latao/70">
              {conteudo}
            </button>
          ) : (
            <article key={profissional.id} className="group overflow-hidden rounded-2xl bg-tinta text-marfim shadow-carta">{conteudo}</article>
          );
        })}
      </div>

      {selecionado && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(evento) => evento.target === evento.currentTarget && fechar()}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`profissional-${selecionado.id}`} tabIndex={-1} className="relative mx-auto my-3 w-full max-w-6xl overflow-hidden rounded-2xl border border-latao/35 shadow-2xl outline-none sm:my-8">
            <span id={`profissional-${selecionado.id}`} className="sr-only">Apresentação de {selecionado.nome}</span>
            <button type="button" onClick={fechar} aria-label="Fechar apresentação" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-tinta/90 text-2xl text-marfim transition hover:border-latao hover:text-latao">×</button>
            <ApresentacaoProfissional profissional={selecionado} cabecalho="Profissional WV" fotoInteira aoFechar={fechar} />
          </div>
        </div>
      )}
    </>
  );
}
