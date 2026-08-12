begin;

-- Lixeira de colaboradores e fotos de perfil. Não altera nem remove histórico.
alter table public.usuarios
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid references public.usuarios(id) on delete set null;

create index if not exists idx_usuarios_lixeira
  on public.usuarios (excluido_em)
  where excluido_em is not null;

comment on column public.usuarios.excluido_em is
  'Início da janela de 24 horas da lixeira. NULL significa que não está excluído.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'colaboradores',
  'colaboradores',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove após 24 horas somente colaboradores sem qualquer histórico relevante.
--
-- FKs para usuarios confirmadas nas migrations/schema do projeto:
--   assinaturas.cliente_id                         ON DELETE SET NULL
--   agendamentos.cliente_id                        ON DELETE SET NULL
--   agendamentos.profissional_id                   ON DELETE SET NULL
--   vendas.colaborador_id                          ON DELETE SET NULL
--   vendas.cliente_id                              ON DELETE SET NULL
--   profissional_servicos.profissional_id          ON DELETE CASCADE
--   profissional_horarios.profissional_id          ON DELETE CASCADE
--   profissional_locais_data.profissional_id       ON DELETE CASCADE
--   atendimentos.cliente_id                        ON DELETE SET NULL
--   atendimentos.colaborador_id                    ON DELETE RESTRICT
--   ponto_registros.colaborador_id                 ON DELETE RESTRICT
--   ponto_revisoes.admin_id                        ON DELETE RESTRICT
--   fechamentos_semanais.colaborador_id            ON DELETE RESTRICT
--   fechamentos_semanais.fechado_por               ON DELETE NO ACTION
--   fechamentos_semanais.pago_por                  ON DELETE NO ACTION
--   fechamento_ajustes.admin_id                    ON DELETE RESTRICT
--   usuarios.excluido_por                          ON DELETE SET NULL
--
-- Agendamentos e configurações operacionais são desvinculados/removidos. Vendas
-- (pagas ou não), atendimentos, ponto, fechamentos, pagamentos, comissões e seus
-- registros de auditoria sempre preservam o colaborador arquivado.
--
-- A foto não é removida do Storage por esta função. O caminho atualmente é gerado
-- sob o ID do administrador que fez o upload, e usuarios.foto_url não comprova a
-- propriedade exclusiva do objeto pelo colaborador. Assim, durante a lixeira e
-- para usuários arquivados a foto é mantida; após uma exclusão física, o arquivo
-- pode ficar órfão em vez de haver risco de remover a imagem errada.
create or replace function public.limpar_lixeira_colaboradores()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  candidato record;
  removidos integer := 0;
begin
  for candidato in
    select u.id
    from public.usuarios u
    where u.papel = 'colaborador'
      and u.excluido_em is not null
      and u.excluido_em <= clock_timestamp() - interval '24 hours'
      -- Qualquer venda, inclusive não paga e em qualquer papel, impede a remoção.
      and not exists (
        select 1
        from public.vendas v
        where v.colaborador_id = u.id
           or v.cliente_id = u.id
      )
      and not exists (
        select 1
        from public.atendimentos a
        where a.colaborador_id = u.id
           or a.cliente_id = u.id
      )
      and not exists (
        select 1
        from public.ponto_registros p
        where p.colaborador_id = u.id
      )
      and not exists (
        select 1
        from public.ponto_revisoes pr
        where pr.admin_id = u.id
      )
      and not exists (
        select 1
        from public.fechamentos_semanais f
        where f.colaborador_id = u.id
           or f.fechado_por = u.id
           or f.pago_por = u.id
      )
      and not exists (
        select 1
        from public.fechamento_ajustes fa
        where fa.admin_id = u.id
      )
      and not exists (
        select 1
        from public.assinaturas ass
        where ass.cliente_id = u.id
      )
    for update of u skip locked
  loop
    begin
      -- Agenda não financeira permanece, mas sem apontar para usuário removido.
      update public.agendamentos
      set profissional_id = null
      where profissional_id = candidato.id;

      update public.agendamentos
      set cliente_id = null
      where cliente_id = candidato.id;

      -- Configurações operacionais não são histórico financeiro.
      delete from public.profissional_servicos
      where profissional_id = candidato.id;

      delete from public.profissional_horarios
      where profissional_id = candidato.id;

      delete from public.profissional_locais_data
      where profissional_id = candidato.id;

      delete from public.usuarios
      where id = candidato.id
        and papel = 'colaborador'
        and excluido_em is not null
        and excluido_em <= clock_timestamp() - interval '24 hours';

      if found then
        removidos := removidos + 1;
      end if;
    exception
      when foreign_key_violation then
        -- Uma FK adicional/desconhecida é tratada como histórico importante:
        -- mantém o usuário arquivado, sem interromper a limpeza dos demais.
        null;
    end;
  end loop;

  return removidos;
end;
$$;

revoke all on function public.limpar_lixeira_colaboradores() from public, anon, authenticated;
grant execute on function public.limpar_lixeira_colaboradores() to service_role;

-- O PostgreSQL não dispara funções apenas pela passagem do tempo. pg_cron é o
-- agendador nativo disponível no Supabase e evita depender de rota ou serviço externo.
create extension if not exists pg_cron;

do $$
declare
  job_id bigint;
begin
  for job_id in
    select jobid
    from cron.job
    where jobname = 'limpar-lixeira-colaboradores'
  loop
    perform cron.unschedule(job_id);
  end loop;

  perform cron.schedule(
    'limpar-lixeira-colaboradores',
    '17 * * * *',
    'select public.limpar_lixeira_colaboradores();'
  );
end;
$$;

commit;
