begin;

alter table public.barbearia
  add column if not exists agendamento_online_ativo boolean not null default true;

alter table public.barbearia
  alter column agendamento_online_ativo set default true;

update public.barbearia
set agendamento_online_ativo = true
where id = 1;

commit;
