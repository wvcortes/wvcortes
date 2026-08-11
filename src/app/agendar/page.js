import { db, pegarBarbearia } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FormAgendar from "./FormAgendar";

export const dynamic = "force-dynamic";

export default async function Agendar() {
  const barbearia = await pegarBarbearia();
  let usuario = null;
  try {
    usuario = await usuarioAtual();
  } catch {}

  const { data: servicos = [] } = await db
    .from("servicos")
    .select("id, nome, preco, duracao_min")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  const { data: equipe = [] } = await db
    .from("usuarios")
    .select("id, nome, especialidade")
    .eq("papel", "colaborador")
    .eq("ativo", true)
    .order("nome");

  return (
    <>
      <SiteHeader barbearia={barbearia} usuario={usuario} />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="etiqueta text-couro">Agenda</p>
        <h1 className="mt-4 font-display text-5xl">Marcar horário</h1>
        <p className="mt-4 text-tinta/70">
          {barbearia.dias_funcionamento}, das {barbearia.hora_abertura} às {barbearia.hora_fechamento}.
        </p>
        <FormAgendar servicos={servicos || []} equipe={equipe || []} usuario={usuario} />
      </main>
      <SiteFooter barbearia={barbearia} />
    </>
  );
}
