import { db, pegarBarbearia } from "@/lib/db";
import FormCadastro from "./FormCadastro";

export const dynamic = "force-dynamic";

export default async function Cadastro({ searchParams }) {
  const barbearia = await pegarBarbearia();
  const { data: planos = [] } = await db
    .from("planos")
    .select("id, nome, preco")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-tinta p-12 text-marfim md:flex">
        <p className="font-display text-3xl">{barbearia.nome}</p>
        <div>
          <p className="etiqueta text-latao">cadastro</p>
          <p className="mt-4 max-w-sm font-display text-4xl leading-tight">
            Seu histórico de cortes começa aqui.
          </p>
        </div>
        <div className="poste w-40" />
      </div>
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <p className="etiqueta text-couro">Criar conta</p>
          <h1 className="mt-3 font-display text-4xl">Seus dados</h1>
          <FormCadastro planos={planos || []} planoInicial={searchParams?.plano || ""} />
        </div>
      </div>
    </main>
  );
}
