import Link from "next/link";
import { db, pegarBarbearia } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export default async function Servicos() {
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
  const { data: produtos = [] } = await db
    .from("produtos")
    .select("*")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  const categorias = [...new Set((servicos || []).map((s) => s.categoria || "Barbearia"))];

  return (
    <>
      <SiteHeader barbearia={barbearia} usuario={usuario} />
      <main className="mx-auto max-w-4xl px-5 py-16">
        <p className="etiqueta text-couro">Tabela</p>
        <h1 className="mt-4 font-display text-5xl">Serviços</h1>

        {categorias.map((cat) => (
          <section key={cat} className="mt-14">
            <p className="etiqueta border-b border-linha pb-3 text-tinta/45">{cat}</p>
            <div className="mt-6 space-y-6">
              {servicos
                .filter((s) => (s.categoria || "Barbearia") === cat)
                .map((s) => (
                  <div key={s.id}>
                    <div className="linha-preco">
                      <span className="font-display text-2xl">{s.nome}</span>
                      <span className="pontos" />
                      <span className="font-mono text-couro">
                        {Number(s.preco).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <p className="mt-1 max-w-xl text-sm text-fumaca">
                      {s.descricao} <span className="font-mono">· {s.duracao_min} min</span>
                    </p>
                  </div>
                ))}
            </div>
          </section>
        ))}

        {produtos?.length > 0 && (
          <section className="mt-16">
            <p className="etiqueta border-b border-linha pb-3 text-tinta/45">Balcão</p>
            <div className="mt-6 space-y-4">
              {produtos.map((p) => (
                <div key={p.id} className="linha-preco">
                  <span className="font-display text-xl">{p.nome}</span>
                  <span className="pontos" />
                  <span className="font-mono text-sm text-couro">
                    {Number(p.preco).toFixed(2).replace(".", ",")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <Link
          href="/agendar"
          className="mt-16 inline-block bg-couro px-6 py-3.5 text-sm font-semibold text-marfim hover:bg-couroClaro"
        >
          Marcar horário
        </Link>
      </main>
      <SiteFooter barbearia={barbearia} />
    </>
  );
}
