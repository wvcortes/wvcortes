import { redirect } from "next/navigation";
import { exigirPapel } from "@/lib/auth";
import PainelShell from "@/components/PainelShell";

export const dynamic = "force-dynamic";

const MENU = [
  { href: "/colaborador", texto: "Minha agenda" },
  { href: "/colaborador/agendar", texto: "Novo atendimento" },
  { href: "/colaborador/locais", texto: "Meus locais" },
  { href: "/colaborador/vendas", texto: "Minhas vendas" },
  { href: "/colaborador/senha", texto: "Alterar senha" },
];

export default async function LayoutColaborador({ children }) {
  const u = await exigirPapel(["colaborador"]);

  if (!u) {
    redirect("/entrar");
  }

  return (
    <PainelShell usuario={u} menu={MENU}>
      {children}
    </PainelShell>
  );
}
