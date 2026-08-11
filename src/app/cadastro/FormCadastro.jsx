"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Botao, Campo, Entrada, Aviso, entradaCls } from "@/components/ui";
import { dinheiro } from "@/lib/formato";

export default function FormCadastro({ planos, planoInicial }) {
  const router = useRouter();
  const [f, setF] = useState({
    nome: "",
    telefone: "",
    email: "",
    cpf: "",
    nascimento: "",
    senha: "",
    plano_id: planoInicial || "",
  });
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const mudar = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const r = await fetch("/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
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
    <form onSubmit={enviar} className="mt-8 space-y-5">
      <Aviso>{erro}</Aviso>
      <Campo rotulo="Nome completo *">
        <Entrada value={f.nome} onChange={mudar("nome")} required />
      </Campo>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo rotulo="Telefone *">
          <Entrada value={f.telefone} onChange={mudar("telefone")} placeholder="(00) 90000-0000" required />
        </Campo>
        <Campo rotulo="E-mail *">
          <Entrada type="email" value={f.email} onChange={mudar("email")} required />
        </Campo>
        <Campo rotulo="CPF">
          <Entrada value={f.cpf} onChange={mudar("cpf")} />
        </Campo>
        <Campo rotulo="Nascimento">
          <Entrada type="date" value={f.nascimento} onChange={mudar("nascimento")} />
        </Campo>
      </div>
      <Campo rotulo="Senha *" ajuda="Mínimo de 6 caracteres.">
        <Entrada type="password" value={f.senha} onChange={mudar("senha")} required />
      </Campo>
      <Campo rotulo="Plano mensal" ajuda="Opcional. A assinatura fica pendente até o pagamento ser confirmado.">
        <select value={f.plano_id} onChange={mudar("plano_id")} className={entradaCls}>
          <option value="">Sem plano por enquanto</option>
          {planos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} — {dinheiro(p.preco)}/mês
            </option>
          ))}
        </select>
      </Campo>
      <Botao type="submit" className="w-full" disabled={carregando}>
        {carregando ? "Criando conta..." : "Criar conta"}
      </Botao>
      <p className="text-sm text-fumaca">
        Já tem cadastro?{" "}
        <Link href="/entrar" className="text-couro underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
