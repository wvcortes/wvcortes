import { redirect } from "next/navigation";
import { exigirPapel } from "@/lib/auth";
import PainelShell from "@/components/PainelShell";

export const dynamic = "force-dynamic";

const MENU = [
  { href: "/cliente", texto: "Minha conta" },
  { href: "/agendar", texto: "Marcar horário" },
  { href: "/planos", texto: "Planos" },
];

export default async function LayoutCliente({ children }) {
  const u = await exigirPapel(["cliente"]);
  if (!u) redirect("/entrar");
  return (
    <PainelShell usuario={u} menu={MENU}>
      {children}
    </PainelShell>
  );
}
