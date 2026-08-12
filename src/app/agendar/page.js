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

  const { data: unidades = [] } = await db.from("unidades").select("id,nome").eq("ativo", true).is("excluido_em", null).order("nome");
  const { data: servicos = [] } = await db
    .from("servicos")
    .select("id, nome, preco, duracao_min")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  const { data: equipe = [] } = await db
    .from("usuarios")
    .select("id, nome, especialidade, unidade_id, foto_url")
    .eq("papel", "colaborador")
    .eq("ativo", true)
    .order("nome");
  const { data: vinculos = [] } = await db.from("profissional_servicos").select("profissional_id,servico_id");

  return (
    <>
      <SiteHeader barbearia={barbearia} usuario={usuario} />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="text-center"><p className="etiqueta text-couro">Sua experiência WV</p>
        <h1 className="mt-4 font-display text-5xl font-semibold sm:text-6xl">Marcar horário</h1>
        <p className="mx-auto mt-4 max-w-xl text-tinta/70">
          {barbearia.dias_funcionamento}, das {barbearia.hora_abertura} às {barbearia.hora_fechamento}.
        </p></div>
        <div className="mt-10 hidden grid-cols-7 gap-2 sm:grid" aria-label="Etapas do agendamento">{["Unidade","Serviço","Data","Profissional","Horário","Dados","Confirmação"].map((e,i)=><div key={e} className="text-center"><span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-couro text-xs font-bold text-white">{i+1}</span><span className="mt-2 block text-[10px] uppercase tracking-wide text-fumaca">{e}</span></div>)}</div>
        <FormAgendar unidades={unidades || []} servicos={servicos || []} equipe={equipe || []} vinculos={vinculos || []} usuario={usuario} />
      </main>
      <SiteFooter barbearia={barbearia} />
    </>
  );
}
