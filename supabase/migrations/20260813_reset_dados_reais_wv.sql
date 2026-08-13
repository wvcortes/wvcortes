begin;

-- Reset único e deliberado dos dados de demonstração da WV. Unidades e o
-- cadastro do dono nunca participam dos DELETEs abaixo.
create table if not exists public.migration_execucoes_wv (
  chave text primary key,
  executada_em timestamptz not null default clock_timestamp()
);

do $$
begin
  if exists (
    select 1 from public.migration_execucoes_wv
    where chave = '20260813_reset_dados_reais_wv'
  ) or exists (
    select 1 from public.usuarios
    where lower(trim(email)) = 'mauricio@wvcortes.com'
  ) then
    raise exception 'Reset 20260813 já executado: operação abortada antes de qualquer exclusão para preservar Maurício e suas vendas.';
  end if;

  insert into public.migration_execucoes_wv (chave)
  values ('20260813_reset_dados_reais_wv');
end $$;

alter table public.usuarios add column if not exists biografia text;
alter table public.usuarios add column if not exists auth_user_id uuid unique;
alter table public.servicos add column if not exists preco_variavel boolean not null default false;
alter table public.servicos add column if not exists preco_minimo numeric(10,2);
alter table public.barbearia add column if not exists comissao_produto_unitaria numeric(10,2) not null default 10;
alter table public.atendimentos add column if not exists quantidade_produtos integer not null default 0;
alter table public.atendimentos add column if not exists comissao_produto_unitaria numeric(10,2) not null default 0;
alter table public.atendimento_itens add column if not exists comissao_produto_unitaria numeric(10,2);
alter table public.atendimento_itens add column if not exists comissao_produtos_total numeric(12,2);
alter table public.vendas add column if not exists comissao_produto_unitaria numeric(10,2);
alter table public.vendas add column if not exists comissao_produtos_total numeric(12,2);

alter table public.usuarios alter column telefone drop not null;
alter table public.usuarios alter column unidade_id drop not null;
alter table public.usuarios alter column comissao_servicos drop not null;
alter table public.usuarios alter column comissao_servicos drop default;

do $$
declare
  v_dono uuid;
  v_admins_ativos integer;
  v_ids uuid[];
begin
  select count(*)
  into v_admins_ativos
  from public.usuarios
  where papel = 'admin'
    and ativo = true;

  if v_admins_ativos <> 1 then
    raise exception 'Reset cancelado: esperado exatamente 1 admin ativo, encontrados %. Nenhuma exclusão foi realizada.', v_admins_ativos;
  end if;

  select id into v_dono
  from public.usuarios
  where papel = 'admin'
    and ativo = true;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids
  from public.usuarios
  where papel = 'colaborador'
    and id <> v_dono
    and lower(trim(email)) <> 'mauricio@wvcortes.com';

  delete from public.ponto_revisoes
  where ponto_id in (select id from public.ponto_registros where colaborador_id = any(v_ids));
  delete from public.fechamento_ajustes
  where fechamento_id in (select id from public.fechamentos_semanais where colaborador_id = any(v_ids));
  delete from public.fechamentos_semanais where colaborador_id = any(v_ids);

  -- Todo o histórico operacional anterior pertence ao conjunto de testes.
  -- Isso também trata com segurança testes feitos pelo admin, sem tocar no admin.
  delete from public.atendimento_itens;
  -- O trigger existente de vendas devolve estoque uma única vez.
  delete from public.vendas;
  delete from public.atendimentos;
  delete from public.agendamentos;

  delete from public.ponto_registros where colaborador_id = any(v_ids);
  delete from public.profissional_servicos where profissional_id = any(v_ids);
  delete from public.profissional_horarios where profissional_id = any(v_ids);
  delete from public.profissional_locais_data where profissional_id = any(v_ids);
  delete from public.usuarios where id = any(v_ids);
end $$;

-- Verificação explícita de integridade antes de remover os catálogos de teste.
do $$
begin
  if exists (
    select 1 from public.vendas
    where servico_id is not null or produto_id is not null
  ) or exists (
    select 1 from public.atendimento_itens
    where servico_id is not null or produto_id is not null
  ) or exists (
    select 1 from public.agendamentos where servico_id is not null
  ) or exists (
    select 1 from public.profissional_servicos
  ) then
    raise exception 'Reset cancelado: ainda existem referências aos serviços/produtos de teste.';
  end if;
end $$;

delete from public.profissional_servicos;
delete from public.servicos;
delete from public.produtos;

insert into public.servicos (nome, preco, preco_minimo, preco_variavel, duracao_min, categoria, ordem, ativo) values
 ('Corte básico social',40,40,false,30,'Barbearia',1,true),
 ('Corte navalhado',50,50,false,30,'Barbearia',2,true),
 ('Barba simples',40,40,false,30,'Barbearia',3,true),
 ('Barba executiva',50,50,false,30,'Barbearia',4,true),
 ('Acabamento cabelo',20,20,false,20,'Barbearia',5,true),
 ('Pigmentação',40,40,false,30,'Barbearia',6,true),
 ('Sobrancelha',15,15,false,15,'Barbearia',7,true),
 ('Progressiva',130,130,true,60,'Barbearia',8,true);

insert into public.produtos (nome, preco, estoque, ativo) values
 ('Pomada capilar',45,0,true),
 ('Balm',55,0,true),
 ('Óleo',60,0,true),
 ('Minoxidil',110,0,true),
 ('Pente de vô',20,0,true);

update public.barbearia set comissao_produto_unitaria = 10 where id = 1;

-- bcrypt confirmado com bcryptjs para Mauricio@WV2026; nunca há senha em texto puro no banco.
insert into public.usuarios (
  nome,email,telefone,papel,ativo,unidade_id,comissao_servicos,
  comissao_produtos,senha_hash,biografia,foto_url
)
values (
  'Maurício','mauricio@wvcortes.com',null,'colaborador',true,null,null,0,
  '$2a$10$PTsEWLXtj9g/jhidx2F.iOZvf6ZXmxNTqPVf1B5xm7VPtXCVLf2Du',
  E'Sou Barbeiro, arte que aprendi com meu pai, com 20 anos de experiência dedicados à arte do corte masculino e ao cuidado com a imagem pessoal. Ao longo da minha trajetória, tive o privilégio de atuar em algumas das principais barbearias da cidade e também fui fundador de uma rede de barbearias que se tornou referência no segmento.\n\nAlém da prática diária na cadeira, atuei como educador na área, sendo responsável pela formação de mais de 1.000 alunos, contribuindo diretamente para o crescimento de novos profissionais da barbearia.\n\nApós um período afastado da profissão, retorno com ainda mais maturidade, técnica e paixão pelo que faço. Hoje, meu objetivo é reconquistar antigos clientes, construir novas conexões e continuar entregando cortes com personalidade, qualidade e atendimento diferenciado.\n\nPara mim, cada cliente não é apenas um atendimento — é uma relação de confiança, estilo e respeito à sua identidade. ✂️',
  '/images/equipe/mauricio.png'
);

drop function if exists public.finalizar_atendimento(uuid,text,text,jsonb,jsonb,text,text,uuid);
drop function if exists public.finalizar_atendimento(uuid,text,text,jsonb,jsonb,text,text,uuid,uuid);

create function public.finalizar_atendimento(
  p_colaborador uuid,
  p_nome text,
  p_telefone text,
  p_servicos jsonb,
  p_produtos jsonb,
  p_pagamento text,
  p_comprovante text default null,
  p_fila uuid default null,
  p_unidade_escolhida uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agora timestamptz := clock_timestamp();
  v_data_local date := (clock_timestamp() at time zone 'America/Campo_Grande')::date;
  v_usuario record;
  v_item jsonb;
  v_row record;
  v_atendimento uuid;
  v_unidade uuid;
  v_cliente uuid;
  v_total_servicos numeric(12,2) := 0;
  v_total_produtos numeric(12,2) := 0;
  v_comissao_servicos numeric(5,2) := 0;
  v_comissao_produto_unitaria numeric(10,2) := 10;
  v_quantidade integer;
  v_quantidade_produtos integer := 0;
  v_valor_unitario numeric(10,2);
  v_admin boolean := false;
  v_ponto_ok boolean := false;
  v_tem_servicos boolean;
begin
  if trim(coalesce(p_nome, '')) = '' then
    raise exception 'Nome do cliente é obrigatório.';
  end if;

  if p_pagamento is null or p_pagamento not in ('Dinheiro','Pix','Débito','Crédito') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  if p_servicos is not null and jsonb_typeof(p_servicos) <> 'array' then
    raise exception 'Lista de serviços inválida.';
  end if;
  if p_produtos is not null and jsonb_typeof(p_produtos) <> 'array' then
    raise exception 'Lista de produtos inválida.';
  end if;
  if jsonb_array_length(coalesce(p_servicos, '[]'::jsonb)) = 0
     and jsonb_array_length(coalesce(p_produtos, '[]'::jsonb)) = 0 then
    raise exception 'Adicione ao menos um serviço ou produto.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_servicos, '[]'::jsonb)) item
    group by item ->> 'id' having count(*) > 1
  ) then
    raise exception 'O mesmo serviço não pode aparecer duplicado na comanda.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_produtos, '[]'::jsonb)) item
    group by item ->> 'id' having count(*) > 1
  ) then
    raise exception 'O mesmo produto não pode aparecer duplicado na comanda.';
  end if;

  if coalesce(trim(p_telefone), '') <> '' then
    select u.id into v_cliente
    from public.usuarios u
    where u.papel = 'cliente'
      and regexp_replace(coalesce(u.telefone, ''), '[^0-9]', '', 'g') =
          regexp_replace(p_telefone, '[^0-9]', '', 'g')
    order by u.criado_em
    limit 1;
  end if;

  select id, papel, unidade_id, comissao_servicos
  into v_usuario
  from public.usuarios
  where id = p_colaborador and ativo = true and papel in ('admin','colaborador');
  if not found then raise exception 'Vendedor inválido.'; end if;

  v_admin := v_usuario.papel = 'admin';
  v_tem_servicos := jsonb_array_length(coalesce(p_servicos, '[]'::jsonb)) > 0;

  if v_admin then
    select id into v_unidade
    from public.unidades
    where id = p_unidade_escolhida and ativo = true and excluido_em is null;
    if v_unidade is null then raise exception 'Selecione uma unidade ativa.'; end if;
  else
    select coalesce(
      (select pld.unidade_id from public.profissional_locais_data pld
       where pld.profissional_id = v_usuario.id and pld.data = v_data_local limit 1),
      v_usuario.unidade_id
    ) into v_unidade;
    if v_unidade is null or not exists (
      select 1
      from public.unidades unidade_efetiva
      where unidade_efetiva.id = v_unidade
        and unidade_efetiva.ativo = true
        and unidade_efetiva.excluido_em is null
    ) then
      raise exception 'Unidade não disponível. Solicite ao administrador.';
    end if;
    if v_tem_servicos and v_usuario.comissao_servicos is null then
      raise exception 'Comissão de serviços não configurada. Solicite ao administrador.';
    end if;
    -- Venda somente de produto usa snapshot 0 sem alterar o cadastro.
    v_comissao_servicos := coalesce(v_usuario.comissao_servicos, 0);
  end if;

  select coalesce(comissao_produto_unitaria, 10)
  into v_comissao_produto_unitaria
  from public.barbearia where id = 1;

  for v_item in select value from jsonb_array_elements(coalesce(p_servicos, '[]'::jsonb)) loop
    begin
      v_quantidade := coalesce(nullif(v_item ->> 'quantidade', '')::integer, 1);
    exception when others then
      raise exception 'Quantidade de serviço inválida.';
    end;
    if v_quantidade < 1 or v_quantidade > 999 then
      raise exception 'Quantidade de serviço inválida.';
    end if;

    begin
      select s.id,s.nome,s.preco,s.preco_variavel,s.preco_minimo into v_row
      from public.servicos s
      where s.id = (v_item ->> 'id')::uuid and s.ativo = true for share;
    exception when invalid_text_representation then
      raise exception 'Serviço indisponível.';
    end;
    if not found then raise exception 'Serviço indisponível.'; end if;

    if v_row.preco_variavel then
      begin
        v_valor_unitario := nullif(v_item ->> 'valor', '')::numeric;
      exception when others then
        raise exception 'Valor do serviço variável inválido.';
      end;
      if v_valor_unitario is null or v_valor_unitario < v_row.preco_minimo then
        raise exception 'O valor mínimo deste serviço é R$ %.', v_row.preco_minimo;
      end if;
    else
      v_valor_unitario := v_row.preco;
    end if;
    v_total_servicos := v_total_servicos + v_valor_unitario * v_quantidade;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_produtos, '[]'::jsonb)) loop
    begin
      v_quantidade := coalesce(nullif(v_item ->> 'quantidade', '')::integer, 1);
    exception when others then
      raise exception 'Quantidade de produto inválida.';
    end;
    if v_quantidade < 1 or v_quantidade > 999 then
      raise exception 'Quantidade de produto inválida.';
    end if;

    begin
      select p.id,p.nome,p.preco,p.estoque into v_row
      from public.produtos p
      where p.id = (v_item ->> 'id')::uuid and p.ativo = true for update;
    exception when invalid_text_representation then
      raise exception 'Produto indisponível.';
    end;
    if not found then raise exception 'Produto indisponível.'; end if;
    if coalesce(v_row.estoque, 0) < v_quantidade then
      raise exception 'Estoque insuficiente para %.', v_row.nome;
    end if;
    v_total_produtos := v_total_produtos + v_row.preco * v_quantidade;
    v_quantidade_produtos := v_quantidade_produtos + v_quantidade;
  end loop;

  if not v_admin then
    select exists (
      select 1 from public.ponto_registros pr
      where pr.colaborador_id = p_colaborador
        and pr.unidade_id = v_unidade
        and (pr.registrado_em at time zone 'America/Campo_Grande')::date = v_data_local
        and pr.tipo = 'ENTRADA'
        and pr.status = 'VALIDADO'
    ) into v_ponto_ok;
  end if;

  insert into public.atendimentos (
    cliente_id,nome_cliente,telefone_cliente,colaborador_id,unidade_id,fila_id,
    forma_pagamento,comprovante_path,subtotal_servicos,subtotal_produtos,total,
    comissao_servico_percentual,comissao_produto_percentual,comissao_servicos,
    comissao_produtos,quantidade_produtos,comissao_produto_unitaria,
    comissao_status,finalizado_em,criado_em
  ) values (
    v_cliente,trim(p_nome),nullif(trim(coalesce(p_telefone,'')),''),p_colaborador,
    v_unidade,p_fila,p_pagamento,nullif(trim(coalesce(p_comprovante,'')),''),
    v_total_servicos,v_total_produtos,v_total_servicos+v_total_produtos,
    case when v_admin then 0 else v_comissao_servicos end,0,
    case when v_admin then 0 else round(v_total_servicos*v_comissao_servicos/100,2) end,
    case when v_admin then 0 else v_comissao_produto_unitaria*v_quantidade_produtos end,
    v_quantidade_produtos,case when v_admin then 0 else v_comissao_produto_unitaria end,
    case when v_admin or v_ponto_ok then 'VALIDADA' else 'PENDENTE_VALIDACAO' end,
    v_agora,v_agora
  ) returning id into v_atendimento;

  for v_item in select value from jsonb_array_elements(coalesce(p_servicos, '[]'::jsonb)) loop
    v_quantidade := coalesce(nullif(v_item ->> 'quantidade','')::integer,1);
    select s.id,s.nome,s.preco,s.preco_variavel,s.preco_minimo into v_row
    from public.servicos s where s.id=(v_item ->> 'id')::uuid;
    v_valor_unitario := case when v_row.preco_variavel
      then (v_item ->> 'valor')::numeric else v_row.preco end;
    insert into public.atendimento_itens
      (atendimento_id,tipo,servico_id,descricao,quantidade,valor_unitario,total)
    values (v_atendimento,'servico',v_row.id,v_row.nome,v_quantidade,
      v_valor_unitario,v_valor_unitario*v_quantidade);
    insert into public.vendas
      (atendimento_id,unidade_id,colaborador_id,cliente_id,tipo,servico_id,
       descricao,quantidade,valor,forma_pagamento)
    values (v_atendimento,v_unidade,p_colaborador,v_cliente,'servico',v_row.id,
      v_row.nome,v_quantidade,v_valor_unitario,p_pagamento);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_produtos, '[]'::jsonb)) loop
    v_quantidade := coalesce(nullif(v_item ->> 'quantidade','')::integer,1);
    select p.id,p.nome,p.preco into v_row
    from public.produtos p where p.id=(v_item ->> 'id')::uuid;
    insert into public.atendimento_itens
      (atendimento_id,tipo,produto_id,descricao,quantidade,valor_unitario,total,
       comissao_produto_unitaria,comissao_produtos_total)
    values (v_atendimento,'produto',v_row.id,v_row.nome,v_quantidade,v_row.preco,
      v_row.preco*v_quantidade,case when v_admin then 0 else v_comissao_produto_unitaria end,
      case when v_admin then 0 else v_comissao_produto_unitaria*v_quantidade end);
    insert into public.vendas
      (atendimento_id,unidade_id,colaborador_id,cliente_id,tipo,produto_id,
       descricao,quantidade,valor,forma_pagamento,comissao_produto_unitaria,
       comissao_produtos_total)
    values (v_atendimento,v_unidade,p_colaborador,v_cliente,'produto',v_row.id,
      v_row.nome,v_quantidade,v_row.preco,p_pagamento,
      case when v_admin then 0 else v_comissao_produto_unitaria end,
      case when v_admin then 0 else v_comissao_produto_unitaria*v_quantidade end);
  end loop;

  return v_atendimento;
end;
$$;

revoke all on function public.finalizar_atendimento(uuid,text,text,jsonb,jsonb,text,text,uuid,uuid)
from public, anon, authenticated;
grant execute on function public.finalizar_atendimento(uuid,text,text,jsonb,jsonb,text,text,uuid,uuid)
to service_role;

commit;
