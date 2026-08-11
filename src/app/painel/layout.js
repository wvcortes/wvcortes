import { redirect } from "next/navigation";
import { exigirPapel } from "@/lib/auth";
import PainelShell from "@/components/PainelShell";

export const dynamic = "force-dynamic";

const MENU = [
  { href: "/painel", texto: "Visão geral" },
  { href: "/painel/agendamentos", texto: "Agenda" },
  { href: "/painel/vendas", texto: "Vendas" },
  { href: "/painel/servicos", texto: "Serviços" },
  { href: "/painel/produtos", texto: "Produtos" },
  { href: "/painel/planos", texto: "Planos" },
  { href: "/painel/assinaturas", texto: "Assinaturas" },
  { href: "/painel/clientes", texto: "Clientes" },
  { href: "/painel/equipe", texto: "Equipe" },
  { href: "/painel/configuracoes", texto: "Configurações" },
];

export default async function LayoutPainel({ children }) {
  const admin = await exigirPapel(["admin"]);

  if (!admin) {
    redirect("/entrar");
  }

  return (
    <PainelShell usuario={admin} menu={MENU}>
      {children}
    </PainelShell>
  );
}