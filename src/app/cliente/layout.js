import { redirect } from "next/navigation";
import { exigirPapel } from "@/lib/auth";
import PainelShell from "@/components/PainelShell";
import { pegarBarbearia } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LayoutCliente({ children }) {
  const [u, barbearia] = await Promise.all([
    exigirPapel(["cliente"]),
    pegarBarbearia(),
  ]);
  if (!u) redirect("/entrar");
  const menu = [
    { href: "/cliente", texto: "Minha conta" },
    ...(barbearia.agendamento_online_ativo !== false ? [{ href: "/agendar", texto: "Marcar horário" }] : []),
    { href: "/planos", texto: "Planos" },
  ];
  return (
    <PainelShell usuario={u} menu={menu}>
      {children}
    </PainelShell>
  );
}
