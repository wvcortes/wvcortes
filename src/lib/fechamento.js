import "server-only";
import { db } from "./db";
export function semanaAtual(data=new Date()){const d=new Date(data),dia=d.getUTCDay(),seg=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(dia===0?6:dia-1))),dom=new Date(seg);dom.setUTCDate(seg.getUTCDate()+6);return{inicio:seg.toISOString().slice(0,10),fim:dom.toISOString().slice(0,10)}}
export async function calcularFechamento(colaboradorId,inicio,fim){
 const de=`${inicio}T00:00:00-03:00`,ate=`${fim}T23:59:59.999-03:00`;
 const fr=await db.from("fechamentos_semanais").select("*").eq("colaborador_id",colaboradorId).eq("semana_inicio",inicio).eq("semana_fim",fim).maybeSingle();if(fr.error)throw fr.error;
 if(fr.data?.status!=="ABERTO"&&fr.data?.snapshot&&Object.keys(fr.data.snapshot).length)return{...fr.data.snapshot,...fr.data,snapshot:true};
 const [ar,jr]=await Promise.all([
  db.from("atendimentos").select("id,subtotal_servicos,subtotal_produtos,total,comissao_servico_percentual,comissao_servicos,comissao_produtos,quantidade_produtos,comissao_produto_unitaria,forma_pagamento").eq("colaborador_id",colaboradorId).eq("status","FINALIZADO").gte("finalizado_em",de).lte("finalizado_em",ate),
  db.from("fechamento_ajustes").select("id,tipo,descricao,valor,observacao,criado_em").eq("fechamento_id",fr.data?.id||"00000000-0000-0000-0000-000000000000")
 ]);if(ar.error||jr.error)throw ar.error||jr.error;
 const itens=ar.data||[],soma=c=>itens.reduce((n,x)=>n+Number(x[c]||0),0),ajustes=jr.data||[],totalAjustes=ajustes.reduce((n,x)=>n+Number(x.valor||0),0);
 const formas=Object.fromEntries(["Dinheiro","Pix","Débito","Crédito"].map(f=>[f,itens.filter(x=>x.forma_pagamento===f).reduce((n,x)=>n+Number(x.total||0),0)]));
 return{quantidade_atendimentos:itens.length,quantidade_produtos:soma("quantidade_produtos"),total_servicos:soma("subtotal_servicos"),total_produtos:soma("subtotal_produtos"),producao_total:soma("total"),comissao_servicos:soma("comissao_servicos"),comissao_produtos:soma("comissao_produtos"),valor_produto_unitario:itens.find(x=>Number(x.quantidade_produtos)>0)?.comissao_produto_unitaria||0,percentuais_servicos:[...new Set(itens.filter(x=>Number(x.subtotal_servicos)>0).map(x=>`${Number(x.comissao_servico_percentual)}%`))],pendencias_ponto:0,total_ajustes:totalAjustes,valor_final:soma("comissao_servicos")+soma("comissao_produtos")+totalAjustes,formas,ajustes,...fr.data,snapshot:false,status:fr.data?.status||"ABERTO"};
}
