import Link from "next/link";

export default function SiteFooter({ barbearia }) {
  const contato = barbearia?.telefone || barbearia?.email || barbearia?.instagram;
  return (
    <footer className="bg-tinta text-marfim">
      <div className="poste" />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-6 md:grid-cols-[1.2fr_.8fr_.8fr] lg:px-8">
        <div>
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full border border-latao/50 font-display text-sm font-bold text-latao">WV</span><p className="font-display text-2xl">{barbearia?.nome || "WV Cortes"}</p></div>
          {barbearia?.slogan && <p className="mt-5 max-w-sm text-sm leading-relaxed text-marfim/60">{barbearia.slogan}</p>}
          <Link href="/agendar" className="mt-6 inline-flex rounded-lg bg-latao px-5 py-3 text-sm font-bold text-tinta transition hover:bg-white">Agendar horário</Link>
        </div>
        <div>
          <p className="etiqueta text-latao">Navegue</p>
          <div className="mt-4 grid gap-2 text-sm text-marfim/65">
            <Link href="/servicos" className="hover:text-white">Serviços</Link><Link href="/planos" className="hover:text-white">Planos</Link><Link href="/produtos" className="hover:text-white">Produtos</Link><Link href="/entrar" className="hover:text-white">Acesso da equipe</Link>
          </div>
        </div>
        <div className="min-w-0 text-sm text-marfim/65">
          <p className="etiqueta text-latao">Informações</p>
          {barbearia?.endereco && <p className="mt-4 break-words">{barbearia.endereco}</p>}
          {barbearia?.dias_funcionamento && <p className="mt-2">{barbearia.dias_funcionamento}</p>}
          {barbearia?.hora_abertura && <p className="mt-1 font-mono text-xs">{barbearia.hora_abertura} às {barbearia.hora_fechamento}</p>}
          {contato && <div className="mt-4 space-y-1 break-words"><p>{barbearia?.telefone}</p><p>{barbearia?.email}</p><p>{barbearia?.instagram}</p></div>}
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-marfim/35">© {new Date().getFullYear()} {barbearia?.nome || "WV Cortes"}. Todos os direitos reservados.</div>
    </footer>
  );
}
