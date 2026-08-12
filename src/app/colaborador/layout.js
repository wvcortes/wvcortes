import { redirect } from "next/navigation";
import { exigirPapel } from "@/lib/auth";
import PainelShell from "@/components/PainelShell";

export const dynamic = "force-dynamic";

const MENU = [
  { grupo: "Principal", href: "/colaborador", texto: "Início" },
  { href: "/colaborador/ponto", texto: "Meu ponto" },
  { href: "/colaborador/novo-atendimento", texto: "Novo atendimento" },
  { grupo: "Operação", href: "/colaborador/vendas", texto: "Meus atendimentos" },
  { grupo: "Financeiro", href: "/colaborador/fechamento", texto: "Meu fechamento" },
  { grupo: "Conta", href: "/colaborador/locais", texto: "Meus locais" },
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
