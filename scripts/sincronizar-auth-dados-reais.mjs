import { createClient } from "@supabase/supabase-js";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Defina as credenciais do Supabase somente no ambiente.");
const db=createClient(url,key,{auth:{persistSession:false}});
const {data:admins,error:ae}=await db.from("usuarios").select("id").eq("papel","admin").eq("ativo",true);
if(ae)throw ae;
if(admins.length!==1)throw new Error(`Operação cancelada: esperado exatamente 1 admin ativo, encontrados ${admins.length}.`);
const adminId=admins[0].id;
const {data:mauricio,error:me}=await db.from("usuarios").select("id").eq("email","mauricio@wvcortes.com").single();
if(me)throw me;
const all=[];for(let page=1;;page++){const {data,error}=await db.auth.admin.listUsers({page,perPage:100});if(error)throw error;all.push(...data.users);if(data.users.length<100)break}
for(const user of all){
 const {data:row}=await db.from("usuarios").select("id,papel").eq("auth_user_id",user.id).maybeSingle();
 if(row?.id===adminId)continue;
 if(row?.papel==="colaborador"&&user.email?.toLowerCase()!=="mauricio@wvcortes.com"){const {error}=await db.auth.admin.deleteUser(user.id);if(error)throw error}
}
let auth=all.find(x=>x.email?.toLowerCase()==="mauricio@wvcortes.com");
if(auth){const {data,error}=await db.auth.admin.updateUserById(auth.id,{email:"mauricio@wvcortes.com",password:"Mauricio@WV2026",email_confirm:true});if(error)throw error;auth=data.user}
else{const {data,error}=await db.auth.admin.createUser({email:"mauricio@wvcortes.com",password:"Mauricio@WV2026",email_confirm:true});if(error)throw error;auth=data.user}
const {error:link}=await db.from("usuarios").update({auth_user_id:auth.id}).eq("id",mauricio.id);if(link)throw link;
console.log("Auth de Maurício sincronizado; admin ativo preservado.");
