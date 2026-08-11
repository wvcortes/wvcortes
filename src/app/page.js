import Image from "next/image";
import Link from "next/link";
import { db, pegarBarbearia } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { dinheiro } from "@/lib/formato";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default async function Home() {
  const barbearia = await pegarBarbearia();
  const usuario = await usuarioAtual().catch(() => null);
  const [
    { data: servicos = [] },
    { data: planos = [] },
    { data: equipe = [] },
    { data: unidades = [] },
  ] = await Promise.all([
    db.from("servicos").select("id,nome,descricao,preco,duracao_min,categoria,ordem").eq("ativo", true).order("ordem", { ascending: true }),
    db.from("planos").select("id,nome,descricao,preco,periodicidade,beneficios,destaque,ordem").eq("ativo", true).order("ordem", { ascending: true }),
    db.from("usuarios").select("id,nome,especialidade,foto_url").eq("papel", "colaborador").eq("ativo", true).order("nome"),
    db.from("unidades").select("id,nome").eq("ativo", true).order("nome"),
  ]);

  return <>
    <SiteHeader barbearia={barbearia} usuario={usuario} />
    <main>
      <section className="relative isolate min-h-[620px] overflow-hidden bg-tinta text-marfim sm:min-h-[700px]">
        <Image src="/images/wv/banner-wv.png" alt="Ambiente e identidade da WV Cortes" fill priority sizes="100vw" className="object-cover object-center opacity-65" />
        <div className="absolute inset-0 bg-gradient-to-r from-tinta via-tinta/80 to-tinta/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-tinta via-transparent to-transparent" />
        <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center px-5 py-20 sm:min-h-[700px] sm:px-6 lg:px-8">
          <div className="aparecer max-w-3xl">
            <p className="etiqueta text-latao">Experiência • precisão • identidade</p>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[.92] tracking-tight sm:text-7xl lg:text-8xl">WV<br/><span className="text-latao">Cortes</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-marfim/75 sm:text-xl">Estilo bem cuidado, atendimento próximo e a confiança de sair da cadeira na sua melhor versão.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/agendar" className="rounded-lg bg-latao px-7 py-4 text-center text-sm font-bold tracking-wide text-tinta transition hover:bg-white">AGENDAR HORÁRIO</Link>
              <Link href="/servicos" className="rounded-lg border border-white/25 bg-black/10 px-7 py-4 text-center text-sm font-bold tracking-wide text-white backdrop-blur transition hover:border-latao hover:text-latao">CONHECER SERVIÇOS</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="secao">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="etiqueta text-couro">Serviços em destaque</p><h2 className="titulo-secao">Cuidado em cada detalhe.</h2></div><Link href="/servicos" className="text-sm font-semibold text-couro hover:underline">Ver todos os serviços →</Link></div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {(servicos || []).slice(0,6).map((s,i) => <article key={s.id} className="card-premium group flex min-h-56 flex-col p-6 sm:p-7"><div className="flex items-center justify-between"><span className="etiqueta text-fumaca">{s.categoria || "Barbearia"}</span><span className="font-mono text-xs text-fumaca">{String(i+1).padStart(2,"0")}</span></div><h3 className="mt-7 font-display text-2xl font-semibold group-hover:text-couro">{s.nome}</h3><p className="mt-2 flex-1 text-sm leading-relaxed text-fumaca">{s.descricao}</p><div className="mt-6 flex items-end justify-between border-t border-linha pt-4"><span className="text-xs text-fumaca">{s.duracao_min} min</span><strong className="font-mono text-lg text-couro">{dinheiro(s.preco)}</strong></div></article>)}
        </div>
      </section>

      <section className="relative overflow-hidden bg-tinta text-marfim">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,169,105,0.10),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(18,63,53,0.55),transparent_42%)]" />
        <div className="secao relative">
          <div className="max-w-2xl">
            <p className="etiqueta text-latao">Planos mensais</p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">Seu cuidado, sempre em dia.</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-marfim/65">Conheça os planos WV e escolha a opção que combina com a sua rotina.</p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(planos || []).map((p) => {
              const beneficios = (p.beneficios || "").split("|").map((b) => b.trim()).filter(Boolean);

              return (
                <article key={p.id} className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-[#0d1916]/95 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] transition duration-300 hover:-translate-y-1 hover:border-latao/70 hover:shadow-[0_22px_60px_rgba(200,169,105,0.10)] motion-reduce:transform-none sm:p-7 ${p.destaque ? "border-latao/55" : "border-white/10"}`}>
                  <div className="absolute inset-x-0 top-0 flex h-1 opacity-80" aria-hidden="true"><span className="w-5 bg-[#8e2527]"/><span className="w-5 bg-marfim"/><span className="w-5 bg-[#244f75]"/><span className="flex-1 bg-latao/70"/></div>
                  {p.destaque && <p className="etiqueta mb-4 text-latao">Escolha da casa</p>}
                  <h3 className="font-display text-3xl font-semibold text-marfim transition-colors duration-300 group-hover:text-latao">{p.nome}</h3>
                  {p.descricao && <p className="mt-3 text-sm leading-relaxed text-marfim/60">{p.descricao}</p>}
                  <p className="mt-7 font-mono text-3xl text-latao">{dinheiro(p.preco)}<span className="ml-1 text-sm font-normal text-marfim/45">/{(p.periodicidade || "mês").toLowerCase()}</span></p>
                  {beneficios.length > 0 && <ul className="mt-7 flex-1 space-y-3 border-t border-white/10 pt-6 text-sm text-marfim/75">{beneficios.map((beneficio, i) => <li key={i} className="flex gap-3"><span className="text-latao" aria-hidden="true">—</span><span>{beneficio}</span></li>)}</ul>}
                  <Link href={`/cadastro?plano=${p.id}`} className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg border border-latao/60 px-5 py-3 text-center text-sm font-semibold text-latao transition duration-200 hover:bg-latao hover:text-tinta">Assinar {p.nome}</Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-couro text-marfim">
        <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
          <div className="relative min-h-[480px] lg:min-h-[650px]"><Image src="/images/wv/wenderson-perfil.png" alt="Wenderson Valejo, proprietário da WV Cortes" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" /></div>
          <div className="flex items-center px-5 py-16 sm:px-10 lg:px-16"><div><p className="etiqueta text-latao">O nome por trás da cadeira</p><h2 className="mt-4 font-display text-4xl font-semibold sm:text-6xl">Wenderson Valejo</h2><p className="mt-3 text-sm uppercase tracking-[.18em] text-marfim/45">Proprietário da WV Cortes</p><div className="mt-8 max-w-xl whitespace-pre-line text-base leading-8 text-marfim/70">{barbearia.biografia_wenderson || "Técnica, atenção e compromisso com a experiência de cada cliente."}</div><Link href="/agendar" className="mt-9 inline-flex rounded-lg border border-latao/60 px-6 py-3 text-sm font-semibold text-latao transition hover:bg-latao hover:text-tinta">Sentar na cadeira</Link></div></div>
        </div>
      </section>

      {unidades?.length > 0 && <section className="secao"><p className="etiqueta text-couro">Onde encontrar a WV</p><h2 className="titulo-secao">Escolha sua unidade.</h2><div className="mt-10 grid gap-5 md:grid-cols-3">{unidades.map((u,i)=><article key={u.id} className="card-premium overflow-hidden"><div className="h-1 bg-latao"/><div className="p-7"><span className="font-mono text-xs text-fumaca">0{i+1}</span><h3 className="mt-5 font-display text-2xl font-semibold">{u.nome}</h3><Link href="/agendar" className="mt-7 inline-flex text-sm font-semibold text-couro">Agendar nesta unidade →</Link></div></article>)}</div></section>}

      {equipe?.length > 0 && <section className="bg-[#e8e5dc]"><div className="secao"><p className="etiqueta text-couro">Profissionais</p><h2 className="titulo-secao">Excelência na cadeira.</h2><div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{equipe.map(c=><article key={c.id} className="group overflow-hidden rounded-2xl bg-tinta text-marfim shadow-carta">{c.foto_url ? <div className="relative aspect-[4/3] overflow-hidden"><Image src={c.foto_url} alt={`Profissional ${c.nome}`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]"/></div>:<div className="flex aspect-[4/3] items-center justify-center bg-couro/40 font-display text-5xl text-latao">{c.nome?.[0]}</div>}<div className="p-6"><h3 className="font-display text-2xl">{c.nome}</h3><p className="mt-1 text-sm text-marfim/55">{c.especialidade || "Barbeiro"}</p></div></article>)}</div></div></section>}

      <section className="px-5 py-16 sm:px-6 md:py-24"><div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-tinta px-6 py-14 text-center text-marfim shadow-2xl sm:px-10"><p className="etiqueta text-latao">Seu próximo corte começa aqui</p><h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-semibold sm:text-6xl">Reserve seu momento na WV Cortes.</h2><Link href="/agendar" className="mt-8 inline-flex rounded-lg bg-latao px-8 py-4 text-sm font-bold text-tinta transition hover:bg-white">AGENDAR AGORA</Link></div></section>
    </main>
    <SiteFooter barbearia={barbearia}/>
  </>;
}
