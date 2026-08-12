import { redirect } from "next/navigation";
import { exigirPapel } from "@/lib/auth";
import PontoAtual from "./PontoAtual";
export const dynamic="force-dynamic";
export default async function MeuPonto(){if(!await exigirPapel(["colaborador"]))redirect("/entrar");return <><p className="etiqueta text-couro">MEU PONTO</p><h1 className="mt-2 text-4xl font-bold">Marcação com localização</h1><p className="mt-2 text-fumaca">A localização é acompanhada somente enquanto esta tela estiver aberta.</p><PontoAtual/></>}
