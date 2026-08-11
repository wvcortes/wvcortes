import Link from "next/link";
import { db, pegarBarbearia } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { dinheiro } from "@/lib/formato";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default async function Home() {
  const barbearia = await pegarBarbearia();
  let usuario = null;
  try {
    usuario = await usuarioAtual();
  } catch {}

  const { data: servicos = [] } = await db
    .from("servicos")
    .select("*")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  const { data: planos = [] } = await db
    .from("planos")
    .select("*")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  const { data: equipe = [] } = await db
    .from("usuarios")
    .select("id, nome, especialidade")
    .eq("papel", "colaborador")
    .eq("ativo", true);

  const lista = (servicos || []).slice(0, 6);

  return (
    <>
      <SiteHeader barbearia={barbearia} usuario={usuario} />

      {/* Hero: a lista de preços da parede é a primeira coisa que se vê. */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 md:pt-20">
        <div className="grid gap-14 md:grid-cols-[1.05fr_.95fr] md:items-end">
          <div className="aparecer">
            <p className="etiqueta text-couro">{barbearia.dias_funcionamento}</p>
            <h1 className="mt-5 font-display text-[3.25rem] font-semibold leading-[0.95] tracking-tight md:text-[4.75rem]">
              A cadeira já está
              <span className="block italic text-couro">reservada.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-tinta/75">{barbearia.slogan}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/agendar"
                className="bg-couro px-6 py-3.5 text-sm font-semibold text-marfim hover:bg-couroClaro"
              >
                Marcar horário
              </Link>
              <Link
                href="/planos"
                className="border border-tinta/25 px-6 py-3.5 text-sm font-semibold hover:border-couro hover:text-couro"
              >
                Ver planos mensais
              </Link>
            </div>
          </div>

          <div className="aparecer border border-linha bg-papel p-7 shadow-carta md:p-9">
            <div className="flex items-baseline justify-between">
              <p className="etiqueta text-tinta/50">Tabela da casa</p>
              <p className="etiqueta text-tinta/35">valores em R$</p>
            </div>
            <div className="mt-6 space-y-4">
              {lista.map((s) => (
                <div key={s.id} className="linha-preco">
                  <span className="font-display text-lg">{s.nome}</span>
                  <span className="pontos" />
                  <span className="font-mono text-sm text-couro">
                    {Number(s.preco).toFixed(2).replace(".", ",")}
                  </span>
                </div>
              ))}
              {lista.length === 0 && (
                <p className="text-sm text-fumaca">
                  Cadastre os serviços no painel e eles aparecem aqui.
                </p>
              )}
            </div>
            <Link href="/servicos" className="etiqueta mt-7 inline-block text-couro">
              tabela completa →
            </Link>
          </div>
        </div>
      </section>

      <div className="poste" />

      {/* Planos */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-xl">
          <p className="etiqueta text-couro">Planos mensais</p>
          <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
            Assine e pare de contar quanto tempo faz.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {(planos || []).map((p) => (
            <div
              key={p.id}
              className={`flex flex-col border p-7 ${
                p.destaque
                  ? "border-couro bg-tinta text-marfim"
                  : "border-linha bg-papel text-tinta"
              }`}
            >
              {p.destaque && <p className="etiqueta mb-4 text-latao">escolha da casa</p>}
              <p className="font-display text-3xl">{p.nome}</p>
              <p className={`mt-2 text-sm ${p.destaque ? "text-marfim/65" : "text-fumaca"}`}>
                {p.descricao}
              </p>
              <p className="mt-6 font-mono text-3xl">
                {dinheiro(p.preco)}
                <span className="text-sm opacity-60">/mês</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {(p.beneficios || "")
                  .split("|")
                  .filter(Boolean)
                  .map((b, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className={p.destaque ? "text-latao" : "text-couro"}>—</span>
                      <span className={p.destaque ? "text-marfim/85" : "text-tinta/80"}>{b.trim()}</span>
                    </li>
                  ))}
              </ul>
              <Link
                href={`/cadastro?plano=${p.id}`}
                className={`mt-8 px-5 py-3 text-center text-sm font-semibold ${
                  p.destaque ? "bg-latao text-tinta hover:bg-marfim" : "bg-tinta text-marfim hover:bg-couro"
                }`}
              >
                Assinar {p.nome}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Equipe */}
      {equipe?.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-8">
          <p className="etiqueta text-couro">Na cadeira</p>
          <div className="mt-8 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-3">
            {equipe.map((c) => (
              <div key={c.id} className="bg-papel p-7">
                <p className="font-display text-2xl">{c.nome}</p>
                <p className="mt-1 text-sm text-fumaca">{c.especialidade || "Barbeiro"}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <SiteFooter barbearia={barbearia} />
    </>
  );
}
