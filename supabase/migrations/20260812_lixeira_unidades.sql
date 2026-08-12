begin;

-- Lixeira de unidades. O registro e todas as suas relações permanecem intactos
-- durante as 24 horas de recuperação e indefinidamente quando houver histórico.
alter table public.unidades
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid references public.usuarios(id) on delete set null,
  add column if not exists ativo_antes_exclusao boolean;

create index if not exists idx_unidades_lixeira
  on public.unidades (excluido_em)
  where excluido_em is not null;

comment on column public.unidades.excluido_em is
  'Início da janela de 24 horas da lixeira. NULL significa que não está excluída.';

-- A inspeção usa o catálogo do PostgreSQL para abranger também FKs criadas
-- futuramente. Qualquer referência impede o DELETE físico; nenhuma FK é alterada.
create or replace function public.limpar_lixeira_unidades()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  candidata record;
  referencia record;
  possui_vinculo boolean;
  removidas integer := 0;
begin
  for candidata in
    select u.id
    from public.unidades u
    where u.excluido_em is not null
      and u.excluido_em <= clock_timestamp() - interval '24 hours'
    for update of u skip locked
  loop
    possui_vinculo := false;

    for referencia in
      select
        n.nspname as esquema,
        c.relname as tabela,
        a.attname as coluna
      from pg_constraint fk
      join pg_class c on c.oid = fk.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      join unnest(fk.conkey) with ordinality chave(attnum, posicao) on true
      join unnest(fk.confkey) with ordinality alvo(attnum, posicao)
        on alvo.posicao = chave.posicao
      join pg_attribute a on a.attrelid = fk.conrelid and a.attnum = chave.attnum
      join pg_attribute ar on ar.attrelid = fk.confrelid and ar.attnum = alvo.attnum
      where fk.contype = 'f'
        and fk.confrelid = 'public.unidades'::regclass
        and ar.attname = 'id'
    loop
      execute format(
        'select exists (select 1 from %I.%I where %I = $1)',
        referencia.esquema,
        referencia.tabela,
        referencia.coluna
      ) into possui_vinculo using candidata.id;

      exit when possui_vinculo;
    end loop;

    if not possui_vinculo then
      begin
        delete from public.unidades
        where id = candidata.id
          and excluido_em is not null
          and excluido_em <= clock_timestamp() - interval '24 hours';

        if found then
          removidas := removidas + 1;
        end if;
      exception
        when foreign_key_violation then
          -- Corridas e FKs inesperadas preservam a unidade arquivada.
          null;
      end;
    end if;
  end loop;

  return removidas;
end;
$$;

revoke all on function public.limpar_lixeira_unidades() from public, anon, authenticated;
grant execute on function public.limpar_lixeira_unidades() to service_role;

create extension if not exists pg_cron;

do $$
declare
  job_id bigint;
begin
  for job_id in
    select jobid from cron.job where jobname = 'limpar-lixeira-unidades'
  loop
    perform cron.unschedule(job_id);
  end loop;

  perform cron.schedule(
    'limpar-lixeira-unidades',
    '23 * * * *',
    'select public.limpar_lixeira_unidades();'
  );
end;
$$;

commit;
