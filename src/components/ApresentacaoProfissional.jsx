import Link from "next/link";
import { resolverFotoColaborador } from "@/lib/fotoColaborador";

export default function ApresentacaoProfissional({
  profissional,
  cabecalho = "O nome por trás da cadeira",
  fotoInteira = false,
  aoFechar,
  agendamentoAtivo = true,
}) {
  const funcao = profissional.especialidade || "Barbeiro";
  const fotoSrc = resolverFotoColaborador(profissional.foto_url);

  return (
    <div className="grid min-w-0 bg-[#081b17] text-marfim lg:grid-cols-2">
      <div className={`relative min-h-[420px] sm:min-h-[520px] lg:min-h-[650px] ${fotoInteira ? "bg-[#07110e]" : ""}`}>
        {fotoSrc ? (
          <img
            src={fotoSrc}
            alt={`${profissional.nome}, ${funcao}`}
            width={1200}
            height={1200}
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 h-full w-full ${fotoInteira ? "object-contain" : "object-cover"}`}
          />
        ) : (
          <div className="flex h-full min-h-[420px] items-center justify-center bg-couro/40 font-display text-8xl text-latao" aria-hidden="true">
            {profissional.nome?.[0]}
          </div>
        )}
      </div>
      <div className="flex min-w-0 items-center px-5 py-12 sm:px-10 sm:py-16 lg:px-16">
        <div className="min-w-0">
          <p className="etiqueta text-latao">{cabecalho}</p>
          <h2 className="mt-4 break-words font-display text-4xl font-semibold sm:text-6xl">{profissional.nome}</h2>
          <p className="mt-3 text-sm uppercase tracking-[.18em] text-marfim/45">{funcao}</p>
          <div className="mt-8 max-w-xl whitespace-pre-line break-words text-base leading-8 text-marfim/70">
            {profissional.biografia}
          </div>
          {aoFechar ? (
            <button type="button" onClick={aoFechar} className="mt-9 inline-flex rounded-lg border border-latao/60 px-6 py-3 text-sm font-semibold text-latao transition hover:bg-latao hover:text-tinta">
              Fechar apresentação
            </button>
          ) : agendamentoAtivo ? (
            <Link href="/agendar" className="mt-9 inline-flex rounded-lg border border-latao/60 px-6 py-3 text-sm font-semibold text-latao transition hover:bg-latao hover:text-tinta">
              Sentar na cadeira
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
