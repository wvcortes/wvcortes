import { pegarBarbearia } from "@/lib/db";
import FormConfig from "./FormConfig";

export const dynamic = "force-dynamic";

export default async function Configuracoes() {
  const barbearia = await pegarBarbearia();
  return (
    <>
      <h1 className="mb-2 font-display text-4xl">Configurações</h1>
      <p className="mb-8 max-w-lg text-sm text-fumaca">
        Nome, contato e horário de funcionamento. Tudo isso aparece no site e define os horários que
        o cliente consegue marcar.
      </p>
      <FormConfig inicial={barbearia} />
    </>
  );
}
