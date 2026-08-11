"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Botao, Campo, Entrada, Aviso } from "@/components/ui";

export default function FormEntrar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const r = await fetch("/api/auth/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro);
      router.push(dados.destino);
      router.refresh();
    } catch (e2) {
      setErro(e2.message);
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      <Aviso>{erro}</Aviso>
      <Campo rotulo="E-mail">
        <Entrada
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          required
        />
      </Campo>
      <Campo rotulo="Senha">
        <Entrada
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="••••••••"
          required
        />
      </Campo>
      <Botao type="submit" className="w-full" disabled={carregando}>
        {carregando ? "Entrando..." : "Entrar"}
      </Botao>
      <p className="text-sm text-fumaca">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-couro underline">
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}
