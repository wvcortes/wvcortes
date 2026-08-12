import { redirect } from "next/navigation";
import { exigirPapel } from "@/lib/auth";
import PainelShell from "@/components/PainelShell";

export const dynamic = "force-dynamic";

const MENU = [
  { grupo: "Operação", href: "/painel", texto: "Visão geral" },
  { href: "/painel/agendamentos", texto: "Atendimentos" },
  { href: "/painel/vendas", texto: "Vendas" },
  { grupo: "Equipe", href: "/painel/equipe", texto: "Colaboradores" },
  { href: "/painel/equipe-config", texto: "Serviços e horários" },
  { grupo: "Cadastros", href: "/painel/servicos", texto: "Serviços" },
  { href: "/painel/produtos", texto: "Produtos" },
  { href: "/painel/planos", texto: "Planos" },
  { href: "/painel/assinaturas", texto: "Assinaturas" },
  { href: "/painel/clientes", texto: "Clientes" },
  { href: "/painel/unidades", texto: "Unidades" },
  { grupo: "Sistema", href: "/painel/configuracoes", texto: "Configurações" },
];

export default async function LayoutPainel({ children }) {
  const admin = await exigirPapel(["admin"]);
  if (!admin) redirect("/entrar");
  return <PainelShell usuario={admin} menu={MENU}>{children}</PainelShell>;
}
