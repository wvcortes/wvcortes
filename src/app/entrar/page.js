import { pegarBarbearia } from "@/lib/db";
import FormEntrar from "./FormEntrar";

export const dynamic = "force-dynamic";

export default async function Entrar() {
  const barbearia = await pegarBarbearia();
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-tinta p-12 text-marfim md:flex">
        <p className="font-display text-3xl">{barbearia.nome}</p>
        <div>
          <p className="etiqueta text-latao">acesso</p>
          <p className="mt-4 max-w-sm font-display text-4xl leading-tight">
            Dono, barbeiro e cliente entram pela mesma porta.
          </p>
          <p className="mt-4 max-w-sm text-sm text-marfim/60">
            Cada um enxerga só o que é da sua conta.
          </p>
        </div>
        <div className="poste w-40" />
      </div>
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="etiqueta text-couro">Entrar</p>
          <h1 className="mt-3 font-display text-4xl">Bem-vindo de volta</h1>
          <FormEntrar />
        </div>
      </div>
    </main>
  );
}
