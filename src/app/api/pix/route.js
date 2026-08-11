import { NextResponse } from "next/server";
import { db, pegarBarbearia } from "@/lib/db";
import { gerarPix } from "@/lib/pix";
const UUID = /^[0-9a-f-]{36}$/i;
export async function POST(req) {
  try {
    const { tipo, id, quantidade = 1 } = await req.json();
    if (!UUID.test(String(id || ""))) return NextResponse.json({ erro: "Item inválido." }, { status: 400 });
    const tabela = tipo === "servico" ? "servicos" : tipo === "produto" ? "produtos" : null;
    if (!tabela) return NextResponse.json({ erro: "Tipo inválido." }, { status: 400 });
    const qtd = tipo === "servico" ? 1 : Number(quantidade);
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 99) return NextResponse.json({ erro: "Quantidade inválida." }, { status: 400 });
    const [item, config] = await Promise.all([db.from(tabela).select(tipo === "produto" ? "id,nome,preco,estoque,ativo" : "id,nome,preco,ativo").eq("id", id).maybeSingle(), pegarBarbearia()]);
    if (item.error || !item.data || !item.data.ativo) return NextResponse.json({ erro: "Item indisponível." }, { status: 404 });
    if (tipo === "produto" && Number(item.data.estoque) < qtd) return NextResponse.json({ erro: "Estoque insuficiente." }, { status: 409 });
    const total = Number(item.data.preco) * qtd;
    const payload = gerarPix({ chave: config.pix_chave, nome: config.pix_nome_recebedor, cidade: config.pix_cidade, valor: total, referencia: "WV CORTES" });
    return NextResponse.json({ payload, total });
  } catch (e) { return NextResponse.json({ erro: e.message === "Configuração Pix incompleta." ? e.message : "Não foi possível gerar o Pix." }, { status: 409 }); }
}
