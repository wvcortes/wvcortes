"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao, Campo, Entrada, Aviso, entradaCls } from "@/components/ui";

const CAMPOS = [
  { nome: "nome", rotulo: "Nome da barbearia" },
  { nome: "slogan", rotulo: "Frase de abertura" },
  { nome: "telefone", rotulo: "Telefone" },
  { nome: "whatsapp", rotulo: "WhatsApp (só números, com DDI)" },
  { nome: "pix_chave", rotulo: "Chave Pix" },
  { nome: "pix_nome_recebedor", rotulo: "Nome do recebedor Pix" },
  { nome: "pix_cidade", rotulo: "Cidade do recebedor Pix" },
  { nome: "biografia_wenderson", rotulo: "Biografia de Wenderson Valejo", tipo: "area", largo: true },
  { nome: "email", rotulo: "E-mail" },
  { nome: "instagram", rotulo: "Instagram" },
  { nome: "endereco", rotulo: "Endereço", largo: true },
  { nome: "sobre", rotulo: "Sobre a casa", tipo: "area", largo: true },
  { nome: "dias_funcionamento", rotulo: "Dias de funcionamento" },
  { nome: "hora_abertura", rotulo: "Abre às", tipo: "time" },
  { nome: "hora_fechamento", rotulo: "Fecha às", tipo: "time" },
  { nome: "intervalo_min", rotulo: "Intervalo entre horários (min)", tipo: "number" },
];

export default function FormConfig({ inicial }) {
  const router = useRouter();
  const [f, setF] = useState(inicial);
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    const r = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    const d = await r.json();
    setSalvando(false);
    if (!r.ok) return setMsg({ tipo: "erro", texto: d.erro });
    setMsg({ tipo: "ok", texto: "Configurações salvas." });
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="max-w-3xl border border-linha bg-papel p-7 shadow-carta">
      {msg ? (
        <div className="mb-5">
          <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>
        </div>
      ) : null}
      <fieldset className="mb-7 rounded-2xl border border-linha bg-tinta/10 p-5 sm:p-6">
        <legend className="etiqueta px-2 text-couro">Agendamento online</legend>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Permitir agendamentos pelo site</p>
            <p className="mt-1 text-sm text-fumaca">Quando desativado, clientes não podem acessar ou criar novos agendamentos online.</p>
            <p className="mt-2 text-sm font-semibold" aria-live="polite">
              Status: {f.agendamento_online_ativo !== false ? "Ativado" : "Desativado"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={f.agendamento_online_ativo !== false}
            aria-label="Ativar ou desativar agendamento online"
            onClick={() => setF({ ...f, agendamento_online_ativo: f.agendamento_online_ativo === false })}
            className={`relative h-12 w-24 shrink-0 rounded-full border p-1 transition ${f.agendamento_online_ativo !== false ? "border-emerald-500/60 bg-emerald-700" : "border-white/20 bg-[#29342e]"}`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-marfim text-[10px] font-bold text-tinta shadow transition-transform ${f.agendamento_online_ativo !== false ? "translate-x-12" : "translate-x-0"}`} aria-hidden="true">
              {f.agendamento_online_ativo !== false ? "ON" : "OFF"}
            </span>
          </button>
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        {CAMPOS.map((c) => (
          <div key={c.nome} className={c.largo ? "sm:col-span-2" : ""}>
            <Campo rotulo={c.rotulo}>
              {c.tipo === "area" ? (
                <textarea
                  rows={3}
                  className={entradaCls}
                  value={f[c.nome] || ""}
                  onChange={(e) => setF({ ...f, [c.nome]: e.target.value })}
                />
              ) : (
                <Entrada
                  type={c.tipo || "text"}
                  value={f[c.nome] || ""}
                  onChange={(e) => setF({ ...f, [c.nome]: e.target.value })}
                />
              )}
            </Campo>
          </div>
        ))}
      </div>
      <Botao type="submit" className="mt-8" disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar configurações"}
      </Botao>
    </form>
  );
}
