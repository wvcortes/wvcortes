import { redirect } from "next/navigation";
import { db, conferirAmbiente } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";
import PainelVendas from "./PainelVendas";

export const dynamic = "force-dynamic";

/**
 * Página de vendas do colaborador.
 *
 * Carrega somente serviços e produtos
 * ativos para o lançamento rápido.
 */
export default async function MinhasVendas() {
  conferirAmbiente();

  /**
   * O layout já faz essa proteção,
   * mas mantemos também na própria página.
   */
  const usuario = await exigirPapel([
    "colaborador",
  ]);

  if (!usuario) {
    redirect("/entrar");
  }

  /**
   * Carregamos serviços e produtos
   * em paralelo.
   */
  const [
    respostaServicos,
    respostaProdutos,
  ] = await Promise.all([
    db
      .from("servicos")
      .select(
        [
          "id",
          "nome",
          "preco",
          "ativo",
        ].join(",")
      )
      .eq(
        "ativo",
        true
      )
      .order(
        "ordem",
        {
          ascending: true,
        }
      ),

    db
      .from("produtos")
      .select(
        [
          "id",
          "nome",
          "preco",
          "estoque",
          "ativo",
        ].join(",")
      )
      .eq(
        "ativo",
        true
      )
      .order(
        "nome",
        {
          ascending: true,
        }
      ),
  ]);

  /**
   * Não escondemos mais falhas do Supabase.
   */
  if (
    respostaServicos.error
  ) {
    throw new Error(
      `Não foi possível carregar os serviços: ${respostaServicos.error.message}`
    );
  }

  if (
    respostaProdutos.error
  ) {
    throw new Error(
      `Não foi possível carregar os produtos: ${respostaProdutos.error.message}`
    );
  }

  const servicos =
    respostaServicos.data ||
    [];

  const produtos =
    respostaProdutos.data ||
    [];

  return (
    <PainelVendas
      servicos={servicos}
      produtos={produtos}
    />
  );
}