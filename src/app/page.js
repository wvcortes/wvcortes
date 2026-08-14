import Image from "next/image";
import Link from "next/link";
import { db, pegarBarbearia } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { dinheiro } from "@/lib/formato";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ApresentacaoProfissional from "@/components/ApresentacaoProfissional";
import EquipePublica from "@/components/EquipePublica";

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
    db.from("usuarios").select("id,nome,especialidade,foto_url,biografia").eq("papel", "colaborador").eq("ativo", true).order("nome"),
    db.from("unidades").select("id,nome").eq("ativo", true).is("excluido_em", null).order("nome"),
  ]);

  return <>
    <SiteHeader barbearia={barbearia} usuario={usuario} />
    <main className="public-site">
      <section className="relative isolate min-h-[620px] overflow-hidden bg-tinta text-marfim sm:min-h-[700px]">
        <Image src="/images/wv/banner-wv.png" alt="Ambiente e identidade da WV Cortes" fill priority sizes="100vw" className="object-cover object-center opacity-65" />
        <div className="absolute inset-0 bg-gradient-to-r from-tinta via-tinta/80 to-tinta/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-tinta via-transparent to-transparent" />
        <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center px-5 py-20 sm:min-h-[700px] sm:px-6 lg:px-8">
          <div className="aparecer max-w-3xl">
            <p className="etiqueta text-latao">Experiência • precisão • identidade</p>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[.92] tracking-tight sm:text-7xl lg:text-8xl">WV<br/><span className="text-latao">Barbearia</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-marfim/75 sm:text-xl">Estilo bem cuidado, atendimento próximo e a confiança de sair da cadeira na sua melhor versão.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {barbearia.agendamento_online_ativo !== false && <Link href="/agendar" className="rounded-lg bg-latao px-7 py-4 text-center text-sm font-bold tracking-wide text-tinta transition hover:bg-white">AGENDAR HORÁRIO</Link>}
              <Link href="/servicos" className="rounded-lg border border-white/25 bg-black/10 px-7 py-4 text-center text-sm font-bold tracking-wide text-white backdrop-blur transition hover:border-latao hover:text-latao">CONHECER SERVIÇOS</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="public-green"><div className="secao">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="etiqueta text-couro">Serviços em destaque</p><h2 className="titulo-secao">Cuidado em cada detalhe.</h2></div><Link href="/servicos" className="text-sm font-semibold text-couro hover:underline">Ver todos os serviços →</Link></div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {(servicos || []).slice(0,6).map((s,i) => <article key={s.id} className="barber-card card-premium group flex min-h-56 flex-col overflow-hidden p-6 sm:p-7"><div className="flex items-center justify-between"><span className="etiqueta text-fumaca">{s.categoria || "Barbearia"}</span><span className="font-mono text-xs text-fumaca">{String(i+1).padStart(2,"0")}</span></div><h3 className="mt-7 font-display text-2xl font-semibold group-hover:text-couro">{s.nome}</h3><p className="mt-2 flex-1 text-sm leading-relaxed text-fumaca">{s.descricao}</p><div className="mt-6 flex items-end justify-between border-t border-linha pt-4"><span className="text-xs text-fumaca">{s.duracao_min} min</span><strong className="font-mono text-lg text-couro">{dinheiro(s.preco)}</strong></div></article>)}
        </div>
      </div></section>

      <section className="public-copper relative overflow-hidden">
        <div className="secao relative">
          <div className="max-w-2xl">
            <p className="etiqueta text-tinta/70">Planos mensais</p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">Seu cuidado, sempre em dia.</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-marfim/65">Conheça os planos WV e escolha a opção que combina com a sua rotina.</p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(planos || []).map((p) => {
              const beneficios = (p.beneficios || "").split("|").map((b) => b.trim()).filter(Boolean);

              return (
                <article key={p.id} className={`barber-card group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-[#0d1916] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] transition duration-300 hover:-translate-y-1 hover:border-latao/70 hover:shadow-[0_22px_60px_rgba(200,169,105,0.10)] motion-reduce:transform-none sm:p-7 ${p.destaque ? "border-latao/55" : "border-white/10"}`}>
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

      <section className="public-forest">
        <div className="mx-auto max-w-7xl">
          <ApresentacaoProfissional profissional={{ nome: "Wenderson Valejo", especialidade: "Proprietário da WV Cortes", foto_url: "/images/wv/wenderson-perfil.png", biografia: barbearia.biografia_wenderson || "Técnica, atenção e compromisso com a experiência de cada cliente." }} agendamentoAtivo={barbearia.agendamento_online_ativo !== false} />
        </div>
      </section>

      {unidades?.length > 0 && <section className="secao"><p className="etiqueta text-couro">Onde encontrar a WV</p><h2 className="titulo-secao">Escolha sua unidade.</h2><div className="mt-10 grid gap-5 md:grid-cols-3">{unidades.map((u,i)=><article key={u.id} className="card-premium overflow-hidden"><div className="h-1 bg-latao"/><div className="p-7"><span className="font-mono text-xs text-fumaca">0{i+1}</span><h3 className="mt-5 font-display text-2xl font-semibold">{u.nome}</h3>{barbearia.agendamento_online_ativo !== false && <Link href="/agendar" className="mt-7 inline-flex text-sm font-semibold text-couro">Agendar nesta unidade →</Link>}</div></article>)}</div></section>}

      {equipe?.length > 0 && <section className="bg-[#e8e5dc]"><div className="secao"><p className="etiqueta text-couro">Profissionais</p><h2 className="titulo-secao">Excelência na cadeira.</h2><EquipePublica equipe={equipe} agendamentoAtivo={barbearia.agendamento_online_ativo !== false} /></div></section>}

      {barbearia.agendamento_online_ativo !== false && <section className="px-5 py-16 sm:px-6 md:py-24"><div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-tinta px-6 py-14 text-center text-marfim shadow-2xl sm:px-10"><p className="etiqueta text-latao">Seu próximo corte começa aqui</p><h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-semibold sm:text-6xl">Reserve seu momento na WV Cortes.</h2><Link href="/agendar" className="mt-8 inline-flex rounded-lg bg-latao px-8 py-4 text-sm font-bold text-tinta transition hover:bg-white">AGENDAR AGORA</Link></div></section>}
    </main>
    <SiteFooter barbearia={barbearia}/>
  </>;
}
