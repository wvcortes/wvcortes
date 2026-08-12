import { notFound } from "next/navigation";
import { pegarRecurso } from "@/lib/recursos";
import GerenciadorCrud from "@/components/GerenciadorCrud";

export const dynamic = "force-dynamic";

export default async function PaginaRecurso({ params }) {
  const { recurso } = await params;
  const config = pegarRecurso(recurso);
  if (!config) notFound();
  return (
    <>
      <h1 className="mb-2 font-display text-4xl">{config.titulo}</h1>
      <GerenciadorCrud recurso={recurso} config={config} />
    </>
  );
}
