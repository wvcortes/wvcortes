begin;

-- Configuração vigente. Os campos antigos permanecem apenas para compatibilidade
-- com a função finalizar_atendimento já instalada.
alter table public.usuarios
  add column if not exists servico_comissao_tipo text,
  add column if not exists servico_comissao_valor numeric(10,2),
  add column if not exists produto_comissao_tipo text,
  add column if not exists produto_comissao_valor numeric(10,2);

alter table public.usuarios
  add constraint usuarios_servico_comissao_consistente check (
    (servico_comissao_tipo is null and servico_comissao_valor is null) or
    (servico_comissao_tipo = 'percentual' and servico_comissao_valor is not null and servico_comissao_valor between 0 and 100) or
    (servico_comissao_tipo = 'fixo' and servico_comissao_valor is not null and servico_comissao_valor >= 0)
  ),
  add constraint usuarios_produto_comissao_consistente check (
    (produto_comissao_tipo is null and produto_comissao_valor is null) or
    (produto_comissao_tipo = 'percentual' and produto_comissao_valor is not null and produto_comissao_valor between 0 and 100) or
    (produto_comissao_tipo = 'fixo' and produto_comissao_valor is not null and produto_comissao_valor >= 0)
  );

-- Snapshots agregados do atendimento.
alter table public.atendimentos
  add column if not exists servico_comissao_tipo text,
  add column if not exists servico_comissao_valor numeric(10,2),
  add column if not exists produto_comissao_tipo text,
  add column if not exists produto_comissao_valor numeric(10,2),
  add column if not exists quantidade_servicos integer not null default 0;

-- Snapshot por linha: permite auditoria exata mesmo em comandas mistas.
alter table public.atendimento_itens
  add column if not exists comissao_tipo text,
  add column if not exists comissao_valor_configurado numeric(10,2),
  add column if not exists comissao_total numeric(12,2);

alter table public.vendas
  add column if not exists comissao_tipo text,
  add column if not exists comissao_valor_configurado numeric(10,2),
  add column if not exists comissao_total numeric(12,2);

alter table public.atendimentos
  add constraint atendimentos_comissao_tipos_validos check (
    servico_comissao_tipo is null or servico_comissao_tipo in ('percentual','fixo')
  ),
  add constraint atendimentos_produto_comissao_tipos_validos check (
    produto_comissao_tipo is null or produto_comissao_tipo in ('percentual','fixo')
  );

alter table public.atendimento_itens
  add constraint atendimento_itens_comissao_tipo_valido check (
    comissao_tipo is null or comissao_tipo in ('percentual','fixo')
  );

alter table public.vendas
  add constraint vendas_comissao_tipo_valido check (
    comissao_tipo is null or comissao_tipo in ('percentual','fixo')
  );

-- Histórico anterior mantém os totais já gravados; apenas descrevemos os
-- snapshots legados sem recalcular valores.
update public.atendimentos
set servico_comissao_tipo = case when subtotal_servicos > 0 then 'percentual' end,
    servico_comissao_valor = case when subtotal_servicos > 0 then comissao_servico_percentual end,
    produto_comissao_tipo = case when quantidade_produtos > 0 then 'fixo' end,
    produto_comissao_valor = case when quantidade_produtos > 0 then comissao_produto_unitaria end
where servico_comissao_tipo is null and produto_comissao_tipo is null;

update public.atendimento_itens ai
set comissao_tipo = case when ai.tipo = 'servico' then a.servico_comissao_tipo else a.produto_comissao_tipo end,
    comissao_valor_configurado = case when ai.tipo = 'servico' then a.servico_comissao_valor else a.produto_comissao_valor end,
    comissao_total = case
      when ai.tipo = 'servico' and a.subtotal_servicos > 0
        then round(a.comissao_servicos * ai.total / a.subtotal_servicos, 2)
      when ai.tipo = 'produto' then coalesce(ai.comissao_produtos_total, 0)
      else 0 end
from public.atendimentos a
where a.id = ai.atendimento_id and ai.comissao_tipo is null;

update public.atendimentos a
set quantidade_servicos = coalesce((
  select sum(ai.quantidade) from public.atendimento_itens ai
  where ai.atendimento_id = a.id and ai.tipo = 'servico'
), 0);

update public.vendas v
set comissao_tipo = ai.comissao_tipo,
    comissao_valor_configurado = ai.comissao_valor_configurado,
    comissao_total = ai.comissao_total
from public.atendimento_itens ai
where ai.atendimento_id = v.atendimento_id
  and ((v.tipo = 'servico' and ai.servico_id = v.servico_id)
    or (v.tipo = 'produto' and ai.produto_id = v.produto_id))
  and v.comissao_tipo is null;

-- A regra atual de Maurício é R$ 10 por unidade de produto; serviços seguem
-- explicitamente não configurados. Nenhum outro dado do cadastro é alterado.
update public.usuarios
set servico_comissao_tipo = null,
    servico_comissao_valor = null,
    produto_comissao_tipo = 'fixo',
    produto_comissao_valor = 10
where lower(trim(email)) = 'mauricio@wvcortes.com'
  and papel = 'colaborador';

create or replace function public.preparar_configuracao_comissao_usuario()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.servico_comissao_tipo is null then new.servico_comissao_valor := null;
  end if;
  if new.produto_comissao_tipo is null then new.produto_comissao_valor := null;
  end if;
  -- Compatibilidade: a função antiga só usa este campo para bloquear serviços.
  new.comissao_servicos := case
    when new.servico_comissao_tipo is null then null
    when new.servico_comissao_tipo = 'percentual' then new.servico_comissao_valor
    else 0 end;
  new.comissao_produtos := case
    when new.produto_comissao_tipo = 'percentual' then new.produto_comissao_valor
    else 0 end;
  return new;
end $$;

drop trigger if exists usuarios_preparar_configuracao_comissao on public.usuarios;
create trigger usuarios_preparar_configuracao_comissao
before insert or update of servico_comissao_tipo,servico_comissao_valor,
  produto_comissao_tipo,produto_comissao_valor
on public.usuarios for each row execute function public.preparar_configuracao_comissao_usuario();

create or replace function public.preparar_snapshot_comissao_atendimento()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_usuario record;
begin
  select papel,servico_comissao_tipo,servico_comissao_valor,
    produto_comissao_tipo,produto_comissao_valor into v_usuario
  from public.usuarios where id = new.colaborador_id;

  if v_usuario.papel = 'admin' then
    new.servico_comissao_tipo := null; new.servico_comissao_valor := null;
    new.produto_comissao_tipo := null; new.produto_comissao_valor := null;
  else
    if new.subtotal_servicos > 0 and v_usuario.servico_comissao_tipo is null then
      raise exception 'Comissão de serviços não configurada. Solicite ao administrador.';
    end if;
    if new.subtotal_produtos > 0 and v_usuario.produto_comissao_tipo is null then
      raise exception 'Comissão de produtos não configurada. Solicite ao administrador.';
    end if;
    new.servico_comissao_tipo := v_usuario.servico_comissao_tipo;
    new.servico_comissao_valor := v_usuario.servico_comissao_valor;
    new.produto_comissao_tipo := v_usuario.produto_comissao_tipo;
    new.produto_comissao_valor := v_usuario.produto_comissao_valor;
  end if;
  new.comissao_servicos := 0; new.comissao_produtos := 0;
  new.quantidade_servicos := 0;
  return new;
end $$;

drop trigger if exists atendimentos_preparar_snapshot_comissao on public.atendimentos;
create trigger atendimentos_preparar_snapshot_comissao before insert on public.atendimentos
for each row execute function public.preparar_snapshot_comissao_atendimento();

create or replace function public.calcular_snapshot_comissao_item()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_atendimento record;
begin
  select colaborador_id,servico_comissao_tipo,servico_comissao_valor,
    produto_comissao_tipo,produto_comissao_valor into v_atendimento
  from public.atendimentos where id = new.atendimento_id;
  if new.tipo = 'servico' then
    new.comissao_tipo := v_atendimento.servico_comissao_tipo;
    new.comissao_valor_configurado := v_atendimento.servico_comissao_valor;
  else
    new.comissao_tipo := v_atendimento.produto_comissao_tipo;
    new.comissao_valor_configurado := v_atendimento.produto_comissao_valor;
  end if;
  new.comissao_total := case
    when new.comissao_tipo = 'percentual' then round(new.total * new.comissao_valor_configurado / 100, 2)
    when new.comissao_tipo = 'fixo' then round(new.quantidade * new.comissao_valor_configurado, 2)
    else 0 end;
  if new.tipo = 'produto' then
    new.comissao_produto_unitaria := case when new.comissao_tipo = 'fixo' then new.comissao_valor_configurado else null end;
    new.comissao_produtos_total := new.comissao_total;
  end if;
  return new;
end $$;

create or replace function public.atualizar_comissao_atendimento_por_itens()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.atendimentos a set
      quantidade_servicos = coalesce((select sum(i.quantidade) from public.atendimento_itens i where i.atendimento_id=a.id and i.tipo='servico'),0),
      quantidade_produtos = coalesce((select sum(i.quantidade) from public.atendimento_itens i where i.atendimento_id=a.id and i.tipo='produto'),0),
      comissao_servicos = coalesce((select sum(i.comissao_total) from public.atendimento_itens i where i.atendimento_id=a.id and i.tipo='servico'),0),
      comissao_produtos = coalesce((select sum(i.comissao_total) from public.atendimento_itens i where i.atendimento_id=a.id and i.tipo='produto'),0)
    where a.id = old.atendimento_id;
  end if;

  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.atendimento_id is distinct from old.atendimento_id) then
    update public.atendimentos a set
      quantidade_servicos = coalesce((select sum(i.quantidade) from public.atendimento_itens i where i.atendimento_id=a.id and i.tipo='servico'),0),
      quantidade_produtos = coalesce((select sum(i.quantidade) from public.atendimento_itens i where i.atendimento_id=a.id and i.tipo='produto'),0),
      comissao_servicos = coalesce((select sum(i.comissao_total) from public.atendimento_itens i where i.atendimento_id=a.id and i.tipo='servico'),0),
      comissao_produtos = coalesce((select sum(i.comissao_total) from public.atendimento_itens i where i.atendimento_id=a.id and i.tipo='produto'),0)
    where a.id = new.atendimento_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists atendimento_itens_calcular_comissao on public.atendimento_itens;
create trigger atendimento_itens_calcular_comissao before insert or update on public.atendimento_itens
for each row execute function public.calcular_snapshot_comissao_item();
drop trigger if exists atendimento_itens_atualizar_comissao on public.atendimento_itens;
create trigger atendimento_itens_atualizar_comissao after insert or update or delete on public.atendimento_itens
for each row execute function public.atualizar_comissao_atendimento_por_itens();

create or replace function public.calcular_snapshot_comissao_venda()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_atendimento record;
  v_usuario record;
begin
  if new.atendimento_id is not null then
    -- Venda vinculada herda somente o snapshot congelado no atendimento.
    select servico_comissao_tipo,servico_comissao_valor,produto_comissao_tipo,
      produto_comissao_valor into v_atendimento
    from public.atendimentos where id = new.atendimento_id;
    new.comissao_tipo := case when new.tipo='servico' then v_atendimento.servico_comissao_tipo else v_atendimento.produto_comissao_tipo end;
    new.comissao_valor_configurado := case when new.tipo='servico' then v_atendimento.servico_comissao_valor else v_atendimento.produto_comissao_valor end;
  else
    -- Venda isolada congela na própria venda a configuração vigente do autor.
    select papel,servico_comissao_tipo,servico_comissao_valor,
      produto_comissao_tipo,produto_comissao_valor into v_usuario
    from public.usuarios where id = new.colaborador_id;

    if v_usuario.papel = 'admin' then
      new.comissao_tipo := null;
      new.comissao_valor_configurado := null;
    elsif new.tipo = 'servico' then
      if v_usuario.servico_comissao_tipo is null then
        raise exception 'Comissão de serviços não configurada. Solicite ao administrador.';
      end if;
      new.comissao_tipo := v_usuario.servico_comissao_tipo;
      new.comissao_valor_configurado := v_usuario.servico_comissao_valor;
    else
      if v_usuario.produto_comissao_tipo is null then
        raise exception 'Comissão de produtos não configurada. Solicite ao administrador.';
      end if;
      new.comissao_tipo := v_usuario.produto_comissao_tipo;
      new.comissao_valor_configurado := v_usuario.produto_comissao_valor;
    end if;
  end if;
  new.comissao_total := case
    when new.comissao_tipo='percentual' then round(new.valor * new.quantidade * new.comissao_valor_configurado / 100,2)
    when new.comissao_tipo='fixo' then round(new.quantidade * new.comissao_valor_configurado,2)
    else 0 end;
  if new.tipo='produto' then
    new.comissao_produto_unitaria := case when new.comissao_tipo='fixo' then new.comissao_valor_configurado else null end;
    new.comissao_produtos_total := new.comissao_total;
  end if;
  return new;
end $$;

drop trigger if exists vendas_calcular_snapshot_comissao on public.vendas;
create trigger vendas_calcular_snapshot_comissao before insert on public.vendas
for each row execute function public.calcular_snapshot_comissao_venda();

commit;
