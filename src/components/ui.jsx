"use client";
import Link from "next/link";

export function Botao({ children, variante = "solido", href, className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold tracking-wide transition disabled:opacity-50 disabled:cursor-not-allowed";
  const estilos = {
    solido: "bg-couro text-marfim hover:bg-couroClaro",
    latao: "bg-latao text-tinta hover:bg-latauEscuro hover:text-marfim",
    contorno: "border border-tinta/25 text-tinta hover:border-couro hover:text-couro",
    claro: "bg-marfim text-tinta hover:bg-white",
    discreto: "text-tinta/70 hover:text-couro px-2 py-1",
  };
  const cls = `${base} ${estilos[variante]} ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button className={cls} {...props}>{children}</button>;
}

export function Campo({ rotulo, ajuda, children }) {
  return (
    <label className="block">
      <span className="etiqueta text-tinta/60">{rotulo}</span>
      <div className="mt-1.5">{children}</div>
      {ajuda ? <p className="mt-1 text-xs text-fumaca">{ajuda}</p> : null}
    </label>
  );
}

export const entradaCls =
  "w-full border border-linha bg-papel px-3 py-2.5 text-sm text-tinta placeholder:text-fumaca/70 focus:border-couro focus:outline-none";

export function Entrada(props) {
  return <input {...props} className={`${entradaCls} ${props.className || ""}`} />;
}

export function Cartao({ children, className = "" }) {
  return (
    <div className={`border border-linha bg-papel shadow-carta ${className}`}>{children}</div>
  );
}

export function Etiqueta({ children, cor = "neutro" }) {
  const cores = {
    neutro: "bg-tinta/8 text-tinta/70",
    verde: "bg-emerald-900/10 text-emerald-800",
    couro: "bg-couro/10 text-couro",
    latao: "bg-latao/20 text-latauEscuro",
    vermelho: "bg-red-900/10 text-red-800",
  };
  return (
    <span className={`etiqueta inline-block px-2 py-1 ${cores[cor] || cores.neutro}`}>
      {children}
    </span>
  );
}

export function Vazio({ titulo, texto, acao }) {
  return (
    <div className="border border-dashed border-linha bg-papel px-6 py-12 text-center">
      <p className="font-display text-xl">{titulo}</p>
      <p className="mt-2 text-sm text-fumaca">{texto}</p>
      {acao ? <div className="mt-5 flex justify-center">{acao}</div> : null}
    </div>
  );
}

export function Aviso({ tipo = "erro", children }) {
  if (!children) return null;
  const cores = {
    erro: "border-red-800/30 bg-red-900/5 text-red-900",
    ok: "border-emerald-800/30 bg-emerald-900/5 text-emerald-900",
  };
  return <div className={`border px-4 py-3 text-sm ${cores[tipo]}`}>{children}</div>;
}
