import Link from "next/link";
import { db, pegarBarbearia } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { dinheiro } from "@/lib/formato";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default async function Planos() {
  const barbearia = await pegarBarbearia();
  let usuario = null;
  try {
    usuario = await usuarioAtual();
  } catch {}
  const { data: planos = [] } = await db
    .from("planos")
    .select("*")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  return (
    <>
      <SiteHeader barbearia={barbearia} usuario={usuario} />
      <main className="public-site mx-auto max-w-none px-5 py-16 sm:px-6 lg:px-[max(2rem,calc((100vw-72rem)/2))]">
        <p className="etiqueta text-couro">Assinatura</p>
        <h1 className="mt-4 max-w-2xl font-display text-5xl leading-tight">
          Um valor por mês, a cadeira sempre pronta.
        </h1>
        <p className="mt-5 max-w-lg text-marfim/70">
          Escolha o plano, faça o cadastro e a assinatura entra como pendente até a confirmação do
          pagamento na barbearia.
        </p>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {(planos || []).map((p) => (
            <div
              key={p.id}
              className={`flex flex-col border p-8 ${
                p.destaque ? "border-latao bg-[#10251e] text-marfim" : "border-latao/30 bg-[#173229] text-marfim"
              }`}
            >
              <p className="font-display text-3xl">{p.nome}</p>
              <p className="mt-2 text-sm text-marfim/65">
                {p.descricao}
              </p>
              <p className="mt-6 font-mono text-3xl">
                {dinheiro(p.preco)}
                <span className="text-sm opacity-60">/{(p.periodicidade || "mês").toLowerCase()}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {(p.beneficios || "")
                  .split("|")
                  .filter(Boolean)
                  .map((b, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="text-latao">—</span>
                      <span>{b.trim()}</span>
                    </li>
                  ))}
              </ul>
              <Link
                href={`/cadastro?plano=${p.id}`}
                className={`mt-8 px-5 py-3 text-center text-sm font-semibold ${
                  p.destaque ? "bg-latao text-tinta hover:bg-[#e2924a]" : "bg-latao text-tinta hover:bg-[#e2924a]"
                }`}
              >
                Assinar {p.nome}
              </Link>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter barbearia={barbearia} />
    </>
  );
}
