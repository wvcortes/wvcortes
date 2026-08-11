"use client";

import { useCallback, useEffect, useState } from "react";
import { Aviso, Botao, Campo, Entrada, entradaCls } from "@/components/ui";
import { diaLocal } from "@/lib/formato";

export default function GerenciadorLocais({ profissionalId = null }) {
  const [dados, setDados] = useState({ perfil: null, excecoes: [], unidades: [] });
  const [form, setForm] = useState({ data: diaLocal(), unidade_id: "" });
  const [mensagem, setMensagem] = useState(null);
  const endpoint = profissionalId ? `/api/locais?profissional=${profissionalId}` : "/api/locais";

  const carregar = useCallback(async () => {
    const r = await fetch(endpoint, { cache: "no-store" }); const d = await r.json();
    if (!r.ok) throw new Error(d.erro || "Não foi possível carregar os locais.");
    setDados(d); setForm((a) => ({ ...a, unidade_id: a.unidade_id || d.perfil?.unidade_id || d.unidades?.[0]?.id || "" }));
  }, [endpoint]);
  useEffect(() => { carregar().catch((e) => setMensagem({ tipo: "erro", texto: e.message })); }, [carregar]);

  async function alterar(method, corpo) {
    setMensagem(null);
    const r = await fetch("/api/locais", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...corpo, profissional_id: profissionalId }) });
    const d = await r.json();
    if (!r.ok) return setMensagem({ tipo: "erro", texto: d.erro || "Não foi possível salvar." });
    setMensagem({ tipo: "ok", texto: method === "DELETE" ? "Exceção removida." : "Local da data salvo." });
    await carregar();
  }

  const padrao = dados.unidades.find((u) => u.id === dados.perfil?.unidade_id);
  return <div className="space-y-6">
    {mensagem ? <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso> : null}
    <section className="border border-linha bg-papel p-6 shadow-carta">
      <p className="etiqueta text-tinta/50">Unidade padrão</p>
      <p className="mt-2 text-lg">{padrao?.nome || "Ainda não configurada"}</p>
      {profissionalId ? <p className="mt-2 text-sm text-fumaca">Altere a unidade padrão no cadastro do colaborador.</p> : null}
    </section>
    <section className="border border-linha bg-papel p-6 shadow-carta">
      <h2 className="font-display text-2xl">Local por data</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Data"><Entrada type="date" min={diaLocal()} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Campo>
        <Campo rotulo="Unidade"><select className={entradaCls} value={form.unidade_id} onChange={(e) => setForm({ ...form, unidade_id: e.target.value })}>{dados.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></Campo>
      </div>
      <Botao className="mt-4" onClick={() => alterar("PUT", form)}>Salvar exceção</Botao>
    </section>
    <section className="border border-linha bg-papel p-6 shadow-carta">
      <h2 className="font-display text-2xl">Exceções futuras</h2>
      <div className="mt-4 space-y-3">{dados.excecoes.length ? dados.excecoes.map((x) => <div key={x.data} className="flex items-center justify-between gap-4 border-b border-linha pb-3"><span>{x.data.split("-").reverse().join("/")} · {x.unidades?.nome}</span><button className="text-sm text-couro" onClick={() => alterar("DELETE", { data: x.data })}>Remover</button></div>) : <p className="text-sm text-fumaca">Nenhuma exceção futura.</p>}</div>
    </section>
  </div>;
}
