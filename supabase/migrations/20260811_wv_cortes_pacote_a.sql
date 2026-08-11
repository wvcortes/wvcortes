begin;

-- =========================================================
-- WV CORTES — PACOTE A
--
-- IMPORTANTE:
-- Esta migration NÃO deve inventar unidade para colaboradores
-- ou agendamentos existentes.
--
-- A unidade padrão do profissional fica em:
-- usuarios.unidade_id
--
-- Alterações temporárias de local por data ficam em:
-- profissional_locais_data
-- =========================================================


-- =========================================================
-- CONFIGURAÇÕES DA BARBEARIA
-- =========================================================

alter table barbearia
  add column if not exists pix_chave text;

alter table barbearia
  add column if not exists pix_nome_recebedor text;

alter table barbearia
  add column if not exists pix_cidade text;

alter table barbearia
  add column if not exists biografia_wenderson text;


update barbearia
set nome = 'WV Cortes'
where
  id = 1
  and (
    nome is null
    or nome = 'Navalha Barbearia'
  );


-- =========================================================
-- UNIDADES
-- =========================================================

create table if not exists unidades (
  id uuid primary key default gen_random_uuid(),

  nome text not null unique,

  ativo boolean not null default true,

  criado_em timestamptz not null default now()
);


insert into unidades (nome)
values
  ('Santa Quitéria Centenário'),
  ('Posto Caravágio 163'),
  ('Posto América 163')
on conflict (nome) do nothing;


-- =========================================================
-- COLABORADORES
-- =========================================================

alter table usuarios
  add column if not exists foto_url text;

alter table usuarios
  add column if not exists unidade_id uuid
  references unidades(id)
  on delete set null;

alter table usuarios
  add column if not exists whatsapp_pessoal text;


comment on column usuarios.unidade_id is
'Unidade padrão/principal de atendimento do colaborador. Alterações temporárias por data ficam em profissional_locais_data.';


-- =========================================================
-- PRODUTOS
-- =========================================================

alter table produtos
  add column if not exists foto_url text;


-- =========================================================
-- AGENDAMENTOS
-- =========================================================

alter table agendamentos
  add column if not exists unidade_id uuid
  references unidades(id)
  on delete restrict;

alter table agendamentos
  add column if not exists origem text;


comment on column agendamentos.unidade_id is
'Unidade em que este atendimento foi marcado. O valor deve permanecer associado ao agendamento mesmo se o profissional trocar sua unidade padrão posteriormente.';


comment on column agendamentos.origem is
'Origem opcional do agendamento, por exemplo site, whatsapp, telefone, presencial ou instagram.';


-- =========================================================
-- SERVIÇOS REALIZADOS POR CADA PROFISSIONAL
-- =========================================================

create table if not exists profissional_servicos (
  profissional_id uuid not null
    references usuarios(id)
    on delete cascade,

  servico_id uuid not null
    references servicos(id)
    on delete cascade,

  primary key (
    profissional_id,
    servico_id
  )
);


-- =========================================================
-- HORÁRIOS NORMAIS DE CADA PROFISSIONAL
-- =========================================================

create table if not exists profissional_horarios (
  id uuid primary key default gen_random_uuid(),

  profissional_id uuid not null
    references usuarios(id)
    on delete cascade,

  dia_semana smallint not null
    check (
      dia_semana between 0 and 6
    ),

  hora_inicio time not null,

  hora_fim time not null,

  ativo boolean not null default true,

  constraint profissional_horario_intervalo
    check (
      hora_fim > hora_inicio
    ),

  constraint profissional_horario_unico
    unique (
      profissional_id,
      dia_semana,
      hora_inicio,
      hora_fim
    )
);


-- =========================================================
-- ALTERAÇÃO TEMPORÁRIA DE UNIDADE POR DATA
-- =========================================================
--
-- Exemplo:
--
-- Rafael normalmente atende no Posto América.
--
-- Em 15/08/2026 ele trabalhará em Santa Quitéria.
--
-- usuarios.unidade_id continua sendo Posto América.
--
-- profissional_locais_data recebe:
--
-- profissional_id = Rafael
-- data = 2026-08-15
-- unidade_id = Santa Quitéria
--
-- No dia seguinte, sem registro de exceção,
-- volta automaticamente à unidade padrão.
-- =========================================================

create table if not exists profissional_locais_data (
  profissional_id uuid not null
    references usuarios(id)
    on delete cascade,

  data date not null,

  unidade_id uuid not null
    references unidades(id)
    on delete restrict,

  criado_em timestamptz not null default now(),

  primary key (
    profissional_id,
    data
  )
);


comment on table profissional_locais_data is
'Exceções de unidade de atendimento de um profissional para uma data específica. Na ausência de exceção, utiliza usuarios.unidade_id.';


-- =========================================================
-- COMPATIBILIDADE COM SERVIÇOS EXISTENTES
-- =========================================================
--
-- Antes desta migration o sistema não restringia explicitamente
-- cada serviço por profissional.
--
-- Para não fazer os serviços desaparecerem imediatamente após
-- a migration, mantemos inicialmente o comportamento anterior:
-- colaboradores existentes recebem os serviços já cadastrados.
--
-- O administrador poderá depois ajustar individualmente.
-- =========================================================

insert into profissional_servicos (
  profissional_id,
  servico_id
)
select
  u.id,
  s.id
from usuarios u
cross join servicos s
where
  u.papel = 'colaborador'
on conflict do nothing;


-- =========================================================
-- COMPATIBILIDADE COM JORNADA EXISTENTE
-- =========================================================
--
-- Mantém inicialmente a disponibilidade que o sistema possuía:
-- terça a sábado usando abertura/fechamento cadastrados na
-- barbearia.
--
-- Caso os horários cadastrados não sejam válidos, utiliza
-- 09:00 às 20:00 como fallback.
--
-- Depois o administrador poderá ajustar cada colaborador.
-- =========================================================

insert into profissional_horarios (
  profissional_id,
  dia_semana,
  hora_inicio,
  hora_fim
)
select
  u.id,

  d.dia,

  case
    when b.hora_abertura ~
      '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then b.hora_abertura::time
    else time '09:00'
  end,

  case
    when b.hora_fechamento ~
      '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then b.hora_fechamento::time
    else time '20:00'
  end

from usuarios u

cross join (
  values
    (2),
    (3),
    (4),
    (5),
    (6)
) as d(dia)

cross join barbearia b

where
  u.papel = 'colaborador'
  and b.id = 1

on conflict do nothing;


-- =========================================================
-- MUITO IMPORTANTE:
-- NÃO DEFINIR UNIDADE AUTOMATICAMENTE
-- =========================================================
--
-- Não executamos algo como:
--
-- update usuarios
-- set unidade_id = Santa Quitéria...
--
-- porque não sabemos a unidade real de cada colaborador.
--
-- O administrador deverá escolher a unidade padrão de cada um.
--
-- Também NÃO atualizamos agendamentos antigos automaticamente.
--
-- Um agendamento antigo sem unidade permanece com unidade_id
-- nulo até que seja corrigido manualmente, se necessário.
-- =========================================================


-- =========================================================
-- ÍNDICES
-- =========================================================

create index if not exists idx_usuarios_unidade
  on usuarios(unidade_id);


create index if not exists idx_agendamentos_unidade_inicio
  on agendamentos(
    unidade_id,
    inicio
  );


create index if not exists idx_profissional_servicos_servico
  on profissional_servicos(
    servico_id,
    profissional_id
  );


create index if not exists idx_profissional_horarios_consulta
  on profissional_horarios(
    profissional_id,
    dia_semana,
    ativo
  );


create index if not exists idx_profissional_locais_data_consulta
  on profissional_locais_data(
    data,
    unidade_id,
    profissional_id
  );


-- =========================================================
-- RLS
-- =========================================================
--
-- O projeto utiliza o backend/server com a service role.
-- As novas tabelas não devem ficar diretamente abertas para
-- acesso público pelo Supabase.
-- =========================================================

alter table unidades
  enable row level security;

alter table profissional_servicos
  enable row level security;

alter table profissional_horarios
  enable row level security;

alter table profissional_locais_data
  enable row level security;


commit;