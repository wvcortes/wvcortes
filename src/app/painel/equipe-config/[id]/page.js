import { db } from "@/lib/db";
import FormProfissional from "./FormProfissional";
import GerenciadorLocais from "@/components/GerenciadorLocais";
export const dynamic = "force-dynamic";
export default async function ProfissionalConfig({ params }) { const { id } = await params; const [perfil, catalogo] = await Promise.all([db.from("usuarios").select("id,nome").eq("id",id).eq("papel","colaborador").maybeSingle(),db.from("servicos").select("id,nome").eq("ativo",true).order("ordem")]); if(!perfil.data) return <p>Profissional não encontrado.</p>; return <><h1 className="font-display text-4xl">{perfil.data.nome}</h1><FormProfissional id={id} catalogo={catalogo.data||[]}/><div className="mt-10 max-w-3xl"><GerenciadorLocais profissionalId={id} /></div></>; }
