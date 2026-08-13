import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirPapel } from "@/lib/auth";

export const dynamic = "force-dynamic";
const UUID=/^[0-9a-f-]{36}$/i;
export async function POST(req){
 const usuario=await exigirPapel(["admin","colaborador"]); if(!usuario)return NextResponse.json({erro:"Sem permissão."},{status:403});
 let form; try{form=await req.formData()}catch{return NextResponse.json({erro:"Comanda inválida."},{status:400})}
 const nome=String(form.get("nome")||"").trim().slice(0,180), telefone=String(form.get("telefone")||"").trim().slice(0,30), pagamento=String(form.get("forma_pagamento")||"");
 let servicos,produtos; try{servicos=JSON.parse(String(form.get("servicos")||"[]"));produtos=JSON.parse(String(form.get("produtos")||"[]"))}catch{return NextResponse.json({erro:"Itens inválidos."},{status:400})}
 if(!nome)return NextResponse.json({erro:"Nome do cliente é obrigatório."},{status:400});
 if(!Array.isArray(servicos)||servicos.length>50||servicos.some(x=>!UUID.test(x?.id)))return NextResponse.json({erro:"Serviços inválidos."},{status:400});
 if(!Array.isArray(produtos)||produtos.length>50||produtos.some(x=>!UUID.test(x?.id)||!Number.isInteger(x.quantidade)||x.quantidade<1))return NextResponse.json({erro:"Produtos inválidos."},{status:400});
 if(!servicos.length&&!produtos.length)return NextResponse.json({erro:"Adicione ao menos um serviço ou produto."},{status:400});
 if(new Set(servicos.map(x=>x.id)).size!==servicos.length||new Set(produtos.map(x=>x.id)).size!==produtos.length)return NextResponse.json({erro:"Itens duplicados na comanda."},{status:400});
 const unidade=String(form.get("unidade_id")||"");
 if(usuario.papel==="admin"&&!UUID.test(unidade))return NextResponse.json({erro:"Selecione a unidade ativa onde a operação aconteceu."},{status:400});
 let path=null; const arquivo=form.get("comprovante");
 if(arquivo instanceof File&&arquivo.size){if(arquivo.size>5_000_000||!arquivo.type.startsWith("image/"))return NextResponse.json({erro:"O comprovante deve ser uma imagem de até 5 MB."},{status:400});path=`${usuario.id}/${crypto.randomUUID()}`;const up=await db.storage.from("comprovantes").upload(path,arquivo,{contentType:arquivo.type,upsert:false});if(up.error)return NextResponse.json({erro:"Não foi possível anexar o comprovante."},{status:400})}
 const {data,error}=await db.rpc("finalizar_atendimento",{p_colaborador:usuario.id,p_nome:nome,p_telefone:telefone,p_servicos:servicos,p_produtos:produtos,p_pagamento:pagamento,p_comprovante:path,p_fila:null,p_unidade_escolhida:usuario.papel==="admin"?unidade:null});
 if(error){if(path)await db.storage.from("comprovantes").remove([path]);return NextResponse.json({erro:String(error.message||"Não foi possível finalizar.")},{status:/estoque/i.test(error.message||"")?409:400})}
 return NextResponse.json({id:data},{status:201});
}
