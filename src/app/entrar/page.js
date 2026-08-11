import Image from "next/image";
import Link from "next/link";
import { pegarBarbearia } from "@/lib/db";
import FormEntrar from "./FormEntrar";
export const dynamic = "force-dynamic";
export default async function Entrar() {
  const barbearia = await pegarBarbearia();
  return <main className="grid min-h-screen bg-tinta lg:grid-cols-[1.05fr_.95fr]">
    <section className="relative hidden min-h-screen overflow-hidden lg:block"><Image src="/images/wv/wenderson-sobre-01.png" alt="Experiência WV Cortes" fill priority sizes="55vw" className="object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-tinta via-tinta/30 to-transparent"/><Link href="/" className="absolute left-10 top-10 flex items-center gap-3 text-marfim"><span className="flex h-11 w-11 items-center justify-center rounded-full border border-latao/60 font-display text-sm font-bold text-latao">WV</span><span className="font-display text-2xl">{barbearia.nome}</span></Link><div className="absolute bottom-12 left-10 max-w-lg text-marfim"><p className="etiqueta text-latao">Área segura</p><h1 className="mt-4 font-display text-5xl font-semibold leading-tight">Sua experiência continua por aqui.</h1><p className="mt-4 text-marfim/60">Clientes e equipe acessam apenas os recursos da própria conta.</p></div></section>
    <section className="flex min-h-screen items-center justify-center bg-marfim px-5 py-12 sm:px-8"><div className="w-full max-w-md"><Link href="/" className="mb-12 inline-flex items-center gap-3 lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-couro font-display text-sm font-bold text-latao">WV</span><span className="font-display text-xl">{barbearia.nome}</span></Link><p className="etiqueta text-couro">Acesso à conta</p><h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Bem-vindo de volta.</h1><p className="mt-3 text-sm text-fumaca">Entre para acessar sua agenda e suas informações.</p><div className="mt-8 rounded-2xl border border-linha bg-papel p-5 shadow-carta sm:p-7"><FormEntrar /></div></div></section>
  </main>;
}
