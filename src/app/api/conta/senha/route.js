import { NextResponse } from "next/server";
import { usuarioAtual, conferirSenha, gerarHash } from "@/lib/auth";
import { db } from "@/lib/db";
export async function PUT(req) {
  try {
    const usuario = await usuarioAtual();
    if (!usuario || usuario.papel !== "colaborador") return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    const { senha_atual, nova_senha, confirmacao } = await req.json();
    if (nova_senha !== confirmacao) return NextResponse.json({ erro: "A confirmação não confere." }, { status: 400 });
    const { data, error } = await db.from("usuarios").select("id,senha_hash").eq("id", usuario.id).maybeSingle();
    if (error || !data) return NextResponse.json({ erro: "Não foi possível validar a conta." }, { status: 500 });
    if (!conferirSenha(String(senha_atual || ""), data.senha_hash)) return NextResponse.json({ erro: "Senha atual incorreta." }, { status: 400 });
    let hash;
    try { hash = gerarHash(String(nova_senha || "")); } catch (e) { return NextResponse.json({ erro: e.message }, { status: 400 }); }
    const atualizacao = await db.from("usuarios").update({ senha_hash: hash }).eq("id", usuario.id);
    if (atualizacao.error) throw atualizacao.error;
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ erro: "Não foi possível alterar a senha." }, { status: 500 }); }
}
