"use client";
import { useState } from "react";
import { Botao, Campo, Entrada, Aviso } from "@/components/ui";
export default function AlterarSenha() {
  const [f, setF] = useState({ senha_atual: "", nova_senha: "", confirmacao: "" });
  const [msg, setMsg] = useState(null);
  async function enviar(e) { e.preventDefault(); setMsg(null); const r = await fetch("/api/conta/senha", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }); const d = await r.json(); setMsg({ tipo: r.ok ? "ok" : "erro", texto: r.ok ? "Senha alterada com segurança." : d.erro }); if (r.ok) setF({ senha_atual: "", nova_senha: "", confirmacao: "" }); }
  return <><h1 className="font-display text-4xl">Alterar minha senha</h1><form onSubmit={enviar} className="mt-8 max-w-lg space-y-5 border border-linha bg-papel p-7">{msg ? <Aviso tipo={msg.tipo}>{msg.texto}</Aviso> : null}{[["senha_atual","Senha atual"],["nova_senha","Nova senha"],["confirmacao","Confirmar nova senha"]].map(([nome, rotulo]) => <Campo key={nome} rotulo={rotulo}><Entrada type="password" minLength={6} required value={f[nome]} onChange={(e) => setF({ ...f, [nome]: e.target.value })} /></Campo>)}<Botao type="submit">Alterar senha</Botao></form></>;
}
