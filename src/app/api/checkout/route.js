import { NextResponse } from "next/server";
import { db, pegarBarbearia } from "@/lib/db";
import { gerarPix } from "@/lib/pix";

const UUID = /^[0-9a-f-]{36}$/i;
export async function POST(req) {
  try {
    const corpo = await req.json();
    const itens = Array.isArray(corpo.itens) ? corpo.itens.slice(0, 50) : [];
    if (!itens.length) return NextResponse.json({ erro: "O carrinho está vazio." }, { status: 400 });
    const quantidades = new Map();
    for (const item of itens) {
      const id = String(item.id || "");
      const qtd = Number(item.quantidade);
      if (!UUID.test(id) || !Number.isInteger(qtd) || qtd < 1 || qtd > 99) return NextResponse.json({ erro: "Carrinho inválido." }, { status: 400 });
      quantidades.set(id, (quantidades.get(id) || 0) + qtd);
    }
    const ids = [...quantidades.keys()];
    const [{ data: produtos, error }, config] = await Promise.all([
      db.from("produtos").select("id,nome,preco,estoque,ativo").in("id", ids),
      pegarBarbearia(),
    ]);
    if (error) throw error;
    if ((produtos || []).length !== ids.length) return NextResponse.json({ erro: "Um produto não foi encontrado." }, { status: 400 });
    let total = 0;
    const linhas = [];
    for (const produto of produtos) {
      const qtd = quantidades.get(produto.id);
      if (!produto.ativo || Number(produto.estoque) < qtd) return NextResponse.json({ erro: `${produto.nome} não possui estoque suficiente.` }, { status: 409 });
      const subtotal = Number(produto.preco) * qtd;
      total += subtotal;
      linhas.push(`${produto.nome} — ${qtd} x R$ ${Number(produto.preco).toFixed(2)} = R$ ${subtotal.toFixed(2)}`);
    }
    const nome = String(corpo.nome || "").trim().slice(0, 120);
    const telefone = String(config.whatsapp || "").replace(/\D/g, "");
    if (!/^\d{10,15}$/.test(telefone)) return NextResponse.json({ erro: "WhatsApp principal não configurado." }, { status: 409 });
    const mensagem = [`Pedido WV Cortes${nome ? ` — ${nome}` : ""}`, "", ...linhas, "", `Total: R$ ${total.toFixed(2)}`].join("\n");
    let pix = null;
    try { pix = gerarPix({ chave: config.pix_chave, nome: config.pix_nome_recebedor, cidade: config.pix_cidade, valor: total, referencia: "PEDIDO WV CORTES" }); } catch {}
    return NextResponse.json({ whatsapp_url: `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`, pix, total });
  } catch {
    return NextResponse.json({ erro: "Não foi possível preparar o pedido." }, { status: 500 });
  }
}
