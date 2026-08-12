begin;

-- =========================================================
-- CONFIGURAÇÕES GERAIS
-- =========================================================

alter table public.barbearia
  add column if not exists agendamento_online_ativo boolean not null default false;

alter table public.barbearia
  alter column agendamento_online_ativo set default false;

-- =========================================================
-- UNIDADES / GEOLOCALIZAÇÃO DO PONTO
-- =========================================================

alter table public.unidades
  add column if not exists latitude numeric(10,7);

alter table public.unidades
  add column if not exists longitude numeric(10,7);

alter table public.unidades
  add column if not exists raio_ponto_m integer;

-- =========================================================
-- COMISSÕES
-- =========================================================

alter table public.usuarios
  add column if not exists comissao_servicos numeric(5,2);

alter table public.usuarios
  add column if not exists comissao_produtos numeric(5,2);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios'
      and column_name = 'comissao'
  ) then
    execute '
      update public.usuarios
      set comissao_servicos = coalesce(comissao_servicos, comissao, 0)
      where comissao_servicos is null
    ';
  else
    update public.usuarios
    set comissao_servicos = 0
    where comissao_servicos is null;
  end if;

  update public.usuarios
  set comissao_produtos = 0
  where comissao_produtos is null;
end $$;

alter table public.usuarios
  alter column comissao_servicos set default 0;

alter table public.usuarios
  alter column comissao_produtos set default 0;

alter table public.usuarios
  alter column comissao_servicos set not null;

alter table public.usuarios
  alter column comissao_produtos set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_comissao_servicos_valida'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
      add constraint usuarios_comissao_servicos_valida
      check (comissao_servicos between 0 and 100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_comissao_produtos_valida'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
      add constraint usuarios_comissao_produtos_valida
      check (comissao_produtos between 0 and 100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'unidades_coordenadas_validas'
      and conrelid = 'public.unidades'::regclass
  ) then
    alter table public.unidades
      add constraint unidades_coordenadas_validas
      check (
        (latitude is null and longitude is null)
        or
        (
          latitude is not null
          and longitude is not null
          and latitude between -90 and 90
          and longitude between -180 and 180
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'unidades_raio_valido'
      and conrelid = 'public.unidades'::regclass
  ) then
    alter table public.unidades
      add constraint unidades_raio_valido
      check (
        raio_ponto_m is null
        or raio_ponto_m between 10 and 10000
      );
  end if;
end $$;

-- =========================================================
-- STORAGE PRIVADO DE COMPROVANTES
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'comprovantes',
  'comprovantes',
  false,
  5000000,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id)
do update set
  public = false,
  file_size_limit = 5000000,
  allowed_mime_types = excluded.allowed_mime_types;

-- =========================================================
-- ATENDIMENTOS
-- =========================================================

create table if not exists public.atendimentos (
  id uuid primary key default gen_random_uuid(),

  cliente_id uuid
    references public.usuarios(id)
    on delete set null,

  nome_cliente text not null,

  telefone_cliente text,

  colaborador_id uuid not null
    references public.usuarios(id)
    on delete restrict,

  unidade_id uuid not null
    references public.unidades(id)
    on delete restrict,

  fila_id uuid,

  forma_pagamento text not null
    check (
      forma_pagamento in (
        'Dinheiro',
        'Pix',
        'Débito',
        'Crédito'
      )
    ),

  comprovante_path text,

  subtotal_servicos numeric(12,2) not null default 0
    check (subtotal_servicos >= 0),

  subtotal_produtos numeric(12,2) not null default 0
    check (subtotal_produtos >= 0),

  total numeric(12,2) not null default 0
    check (total >= 0),

  comissao_servico_percentual numeric(5,2) not null default 0
    check (comissao_servico_percentual between 0 and 100),

  comissao_produto_percentual numeric(5,2) not null default 0
    check (comissao_produto_percentual between 0 and 100),

  comissao_servicos numeric(12,2) not null default 0
    check (comissao_servicos >= 0),

  comissao_produtos numeric(12,2) not null default 0
    check (comissao_produtos >= 0),

  comissao_status text not null default 'VALIDADA'
    check (
      comissao_status in (
        'VALIDADA',
        'PENDENTE_VALIDACAO'
      )
    ),

  status text not null default 'FINALIZADO'
    check (
      status in (
        'FINALIZADO',
        'CANCELADO'
      )
    ),

  finalizado_em timestamptz not null default clock_timestamp(),

  criado_em timestamptz not null default clock_timestamp()
);

-- =========================================================
-- ITENS DO ATENDIMENTO
-- =========================================================

create table if not exists public.atendimento_itens (
  id uuid primary key default gen_random_uuid(),

  atendimento_id uuid not null
    references public.atendimentos(id)
    on delete restrict,

  tipo text not null
    check (
      tipo in (
        'servico',
        'produto'
      )
    ),

  servico_id uuid
    references public.servicos(id)
    on delete set null,

  produto_id uuid
    references public.produtos(id)
    on delete set null,

  descricao text not null,

  quantidade integer not null
    check (
      quantidade > 0
      and quantidade <= 999
    ),

  valor_unitario numeric(10,2) not null
    check (valor_unitario >= 0),

  total numeric(12,2) not null
    check (total >= 0),

  criado_em timestamptz not null default clock_timestamp(),

  check (
    (
      tipo = 'servico'
      and servico_id is not null
      and produto_id is null
    )
    or
    (
      tipo = 'produto'
      and produto_id is not null
      and servico_id is null
    )
  )
);

-- =========================================================
-- VENDAS VINCULADAS AO ATENDIMENTO
-- =========================================================

alter table public.vendas
  add column if not exists atendimento_id uuid
  references public.atendimentos(id)
  on delete restrict;

alter table public.vendas
  add column if not exists unidade_id uuid
  references public.unidades(id)
  on delete restrict;

create unique index if not exists vendas_atendimento_servico_uq
  on public.vendas (
    atendimento_id,
    servico_id
  )
  where atendimento_id is not null
    and tipo = 'servico'
    and servico_id is not null;

create unique index if not exists vendas_atendimento_produto_uq
  on public.vendas (
    atendimento_id,
    produto_id
  )
  where atendimento_id is not null
    and tipo = 'produto'
    and produto_id is not null;

-- =========================================================
-- PONTO
-- =========================================================

create table if not exists public.ponto_registros (
  id uuid primary key default gen_random_uuid(),

  colaborador_id uuid not null
    references public.usuarios(id)
    on delete restrict,

  unidade_id uuid
    references public.unidades(id)
    on delete restrict,

  tipo text not null
    check (
      tipo in (
        'ENTRADA',
        'INICIO_INTERVALO',
        'RETORNO',
        'SAIDA'
      )
    ),

  registrado_em timestamptz not null default clock_timestamp(),

  latitude numeric(10,7),

  longitude numeric(10,7),

  accuracy numeric(10,2),

  distancia_m numeric(10,2),

  status text not null
    check (
      status in (
        'VALIDADO',
        'FORA_DA_AREA',
        'PRECISAO_INSUFICIENTE',
        'PENDENTE_REVISAO'
      )
    ),

  check (
    (
      latitude is null
      and longitude is null
    )
    or
    (
      latitude is not null
      and longitude is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
    )
  ),

  check (
    accuracy is null
    or accuracy >= 0
  ),

  check (
    distancia_m is null
    or distancia_m >= 0
  )
);

create table if not exists public.ponto_revisoes (
  id uuid primary key default gen_random_uuid(),

  ponto_id uuid not null
    references public.ponto_registros(id)
    on delete restrict,

  admin_id uuid not null
    references public.usuarios(id)
    on delete restrict,

  status_anterior text not null,

  status_novo text not null,

  justificativa text not null,

  criado_em timestamptz not null default clock_timestamp()
);

-- =========================================================
-- FECHAMENTO SEMANAL
-- =========================================================

create table if not exists public.fechamentos_semanais (
  id uuid primary key default gen_random_uuid(),

  colaborador_id uuid not null
    references public.usuarios(id)
    on delete restrict,

  semana_inicio date not null,

  semana_fim date not null,

  status text not null default 'ABERTO'
    check (
      status in (
        'ABERTO',
        'FECHADO',
        'PAGO'
      )
    ),

  quantidade_atendimentos integer not null default 0
    check (quantidade_atendimentos >= 0),

  total_servicos numeric(12,2) not null default 0
    check (total_servicos >= 0),

  total_produtos numeric(12,2) not null default 0
    check (total_produtos >= 0),

  producao_total numeric(12,2) not null default 0
    check (producao_total >= 0),

  comissao_servicos numeric(12,2) not null default 0
    check (comissao_servicos >= 0),

  comissao_produtos numeric(12,2) not null default 0
    check (comissao_produtos >= 0),

  pendencias_ponto integer not null default 0
    check (pendencias_ponto >= 0),

  total_ajustes numeric(12,2) not null default 0,

  valor_final numeric(12,2) not null default 0,

  snapshot jsonb not null default '{}'::jsonb,

  fechado_por uuid
    references public.usuarios(id),

  fechado_em timestamptz,

  pago_por uuid
    references public.usuarios(id),

  pago_em timestamptz,

  criado_em timestamptz not null default clock_timestamp(),

  check (
    semana_fim >= semana_inicio
  ),

  unique (
    colaborador_id,
    semana_inicio,
    semana_fim
  )
);

create table if not exists public.fechamento_ajustes (
  id uuid primary key default gen_random_uuid(),

  fechamento_id uuid not null
    references public.fechamentos_semanais(id)
    on delete restrict,

  tipo text not null
    check (
      tipo in (
        'Bônus',
        'Adiantamento',
        'Desconto',
        'Correção',
        'Outro'
      )
    ),

  descricao text not null,

  valor numeric(12,2) not null,

  observacao text,

  admin_id uuid not null
    references public.usuarios(id)
    on delete restrict,

  criado_em timestamptz not null default clock_timestamp()
);

-- =========================================================
-- ÍNDICES
-- =========================================================

create index if not exists idx_atendimentos_colab_data
  on public.atendimentos (
    colaborador_id,
    finalizado_em
  );

create index if not exists idx_atendimentos_unidade_data
  on public.atendimentos (
    unidade_id,
    finalizado_em
  );

create index if not exists idx_ponto_colab_data
  on public.ponto_registros (
    colaborador_id,
    registrado_em
  );

create index if not exists idx_fechamentos_colab_semana
  on public.fechamentos_semanais (
    colaborador_id,
    semana_inicio,
    semana_fim
  );

create index if not exists idx_vendas_atendimento
  on public.vendas (
    atendimento_id
  )
  where atendimento_id is not null;

-- =========================================================
-- FINALIZAÇÃO ATÔMICA DO ATENDIMENTO
-- =========================================================

create or replace function public.finalizar_atendimento(
  p_colaborador uuid,
  p_nome text,
  p_telefone text,
  p_servicos jsonb,
  p_produtos jsonb,
  p_pagamento text,
  p_comprovante text default null,
  p_fila uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agora timestamptz := clock_timestamp();
  v_data_local date;

  v_unidade uuid;
  v_atendimento uuid;
  v_cliente uuid;

  v_s numeric(12,2) := 0;
  v_p numeric(12,2) := 0;

  v_cs numeric(5,2) := 0;
  v_cp numeric(5,2) := 0;

  v_item jsonb;
  v_row record;

  v_qtd integer;

  v_ponto_ok boolean := false;
begin
  v_data_local :=
    (v_agora at time zone 'America/Campo_Grande')::date;

  if trim(coalesce(p_nome, '')) = '' then
    raise exception 'Nome do cliente é obrigatório.';
  end if;

  if p_pagamento not in (
    'Dinheiro',
    'Pix',
    'Débito',
    'Crédito'
  ) then
    raise exception 'Forma de pagamento inválida.';
  end if;

  if p_servicos is null
     or jsonb_typeof(p_servicos) <> 'array'
     or jsonb_array_length(p_servicos) = 0 then
    raise exception 'Adicione ao menos um serviço.';
  end if;

  if p_produtos is not null
     and jsonb_typeof(p_produtos) <> 'array' then
    raise exception 'Lista de produtos inválida.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_servicos) item
    group by item ->> 'id'
    having count(*) > 1
  ) then
    raise exception 'O mesmo serviço não pode aparecer duplicado na comanda.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      coalesce(p_produtos, '[]'::jsonb)
    ) item
    group by item ->> 'id'
    having count(*) > 1
  ) then
    raise exception 'O mesmo produto não pode aparecer duplicado na comanda.';
  end if;

  if coalesce(trim(p_telefone), '') <> '' then
    select u.id
    into v_cliente
    from public.usuarios u
    where regexp_replace(
            coalesce(u.telefone, ''),
            '[^0-9]',
            '',
            'g'
          )
          =
          regexp_replace(
            p_telefone,
            '[^0-9]',
            '',
            'g'
          )
      and u.papel = 'cliente'
    order by u.criado_em
    limit 1;
  end if;

  select
    coalesce(
      (
        select pld.unidade_id
        from public.profissional_locais_data pld
        where pld.profissional_id = p_colaborador
          and pld.data = v_data_local
        limit 1
      ),
      u.unidade_id
    ),
    coalesce(
      u.comissao_servicos,
      0
    ),
    coalesce(
      u.comissao_produtos,
      0
    )
  into
    v_unidade,
    v_cs,
    v_cp
  from public.usuarios u
  where u.id = p_colaborador
    and u.papel = 'colaborador'
    and u.ativo = true;

  if not found then
    raise exception 'Colaborador inválido.';
  end if;

  if v_unidade is null then
    raise exception 'Colaborador sem unidade definida.';
  end if;

  -- =======================================================
  -- VALIDAR E SOMAR SERVIÇOS
  -- =======================================================

  for v_item in
    select value
    from jsonb_array_elements(p_servicos)
  loop
    begin
      v_qtd :=
        coalesce(
          nullif(
            v_item ->> 'quantidade',
            ''
          )::integer,
          1
        );
    exception
      when others then
        raise exception 'Quantidade de serviço inválida.';
    end;

    if v_qtd < 1 or v_qtd > 999 then
      raise exception 'Quantidade de serviço inválida.';
    end if;

    select
      s.id,
      s.nome,
      s.preco
    into v_row
    from public.servicos s
    where s.id = (v_item ->> 'id')::uuid
      and s.ativo = true
    for share;

    if not found then
      raise exception 'Serviço indisponível.';
    end if;

    v_s :=
      v_s +
      (
        v_row.preco *
        v_qtd
      );
  end loop;

  -- =======================================================
  -- VALIDAR E BLOQUEAR PRODUTOS
  -- =======================================================

  for v_item in
    select value
    from jsonb_array_elements(
      coalesce(
        p_produtos,
        '[]'::jsonb
      )
    )
  loop
    begin
      v_qtd :=
        coalesce(
          nullif(
            v_item ->> 'quantidade',
            ''
          )::integer,
          1
        );
    exception
      when others then
        raise exception 'Quantidade de produto inválida.';
    end;

    if v_qtd < 1 or v_qtd > 999 then
      raise exception 'Quantidade de produto inválida.';
    end if;

    select
      p.id,
      p.nome,
      p.preco,
      p.estoque
    into v_row
    from public.produtos p
    where p.id = (v_item ->> 'id')::uuid
      and p.ativo = true
    for update;

    if not found then
      raise exception 'Produto indisponível.';
    end if;

    if coalesce(v_row.estoque, 0) < v_qtd then
      raise exception
        'Estoque insuficiente para %.',
        v_row.nome;
    end if;

    v_p :=
      v_p +
      (
        v_row.preco *
        v_qtd
      );
  end loop;

  -- =======================================================
  -- VALIDAR PONTO
  -- =======================================================

  select exists (
    select 1
    from public.ponto_registros pr
    where pr.colaborador_id = p_colaborador
      and pr.unidade_id = v_unidade
      and (
        pr.registrado_em
        at time zone 'America/Campo_Grande'
      )::date = v_data_local
      and pr.tipo = 'ENTRADA'
      and pr.status = 'VALIDADO'
  )
  into v_ponto_ok;

  -- =======================================================
  -- CRIAR ATENDIMENTO
  -- =======================================================

  insert into public.atendimentos (
    cliente_id,
    nome_cliente,
    telefone_cliente,
    colaborador_id,
    unidade_id,
    fila_id,
    forma_pagamento,
    comprovante_path,
    subtotal_servicos,
    subtotal_produtos,
    total,
    comissao_servico_percentual,
    comissao_produto_percentual,
    comissao_servicos,
    comissao_produtos,
    comissao_status,
    finalizado_em,
    criado_em
  )
  values (
    v_cliente,
    trim(p_nome),
    nullif(
      trim(
        coalesce(
          p_telefone,
          ''
        )
      ),
      ''
    ),
    p_colaborador,
    v_unidade,
    p_fila,
    p_pagamento,
    nullif(
      trim(
        coalesce(
          p_comprovante,
          ''
        )
      ),
      ''
    ),
    v_s,
    v_p,
    v_s + v_p,
    v_cs,
    v_cp,
    round(
      v_s * v_cs / 100,
      2
    ),
    round(
      v_p * v_cp / 100,
      2
    ),
    case
      when v_ponto_ok
        then 'VALIDADA'
      else 'PENDENTE_VALIDACAO'
    end,
    v_agora,
    v_agora
  )
  returning id
  into v_atendimento;

  -- =======================================================
  -- GRAVAR SERVIÇOS
  -- =======================================================

  for v_item in
    select value
    from jsonb_array_elements(p_servicos)
  loop
    v_qtd :=
      coalesce(
        nullif(
          v_item ->> 'quantidade',
          ''
        )::integer,
        1
      );

    select
      s.id,
      s.nome,
      s.preco
    into v_row
    from public.servicos s
    where s.id =
      (v_item ->> 'id')::uuid;

    insert into public.atendimento_itens (
      atendimento_id,
      tipo,
      servico_id,
      descricao,
      quantidade,
      valor_unitario,
      total
    )
    values (
      v_atendimento,
      'servico',
      v_row.id,
      v_row.nome,
      v_qtd,
      v_row.preco,
      v_row.preco * v_qtd
    );

    insert into public.vendas (
      atendimento_id,
      unidade_id,
      colaborador_id,
      cliente_id,
      tipo,
      servico_id,
      descricao,
      quantidade,
      valor,
      forma_pagamento
    )
    values (
      v_atendimento,
      v_unidade,
      p_colaborador,
      v_cliente,
      'servico',
      v_row.id,
      v_row.nome,
      v_qtd,
      v_row.preco,
      p_pagamento
    );
  end loop;

  -- =======================================================
  -- GRAVAR PRODUTOS
  -- O trigger já existente em vendas fará a baixa de estoque.
  -- =======================================================

  for v_item in
    select value
    from jsonb_array_elements(
      coalesce(
        p_produtos,
        '[]'::jsonb
      )
    )
  loop
    v_qtd :=
      coalesce(
        nullif(
          v_item ->> 'quantidade',
          ''
        )::integer,
        1
      );

    select
      p.id,
      p.nome,
      p.preco
    into v_row
    from public.produtos p
    where p.id =
      (v_item ->> 'id')::uuid;

    insert into public.atendimento_itens (
      atendimento_id,
      tipo,
      produto_id,
      descricao,
      quantidade,
      valor_unitario,
      total
    )
    values (
      v_atendimento,
      'produto',
      v_row.id,
      v_row.nome,
      v_qtd,
      v_row.preco,
      v_row.preco * v_qtd
    );

    insert into public.vendas (
      atendimento_id,
      unidade_id,
      colaborador_id,
      cliente_id,
      tipo,
      produto_id,
      descricao,
      quantidade,
      valor,
      forma_pagamento
    )
    values (
      v_atendimento,
      v_unidade,
      p_colaborador,
      v_cliente,
      'produto',
      v_row.id,
      v_row.nome,
      v_qtd,
      v_row.preco,
      p_pagamento
    );
  end loop;

  return v_atendimento;
end;
$$;

-- =========================================================
-- PERMISSÕES DA FUNÇÃO
-- =========================================================

revoke all
on function public.finalizar_atendimento(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  uuid
)
from public;

revoke all
on function public.finalizar_atendimento(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  uuid
)
from anon;

revoke all
on function public.finalizar_atendimento(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  uuid
)
from authenticated;

grant execute
on function public.finalizar_atendimento(
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  uuid
)
to service_role;

-- =========================================================
-- RLS
-- =========================================================

alter table public.atendimentos
  enable row level security;

alter table public.atendimento_itens
  enable row level security;

alter table public.ponto_registros
  enable row level security;

alter table public.ponto_revisoes
  enable row level security;

alter table public.fechamentos_semanais
  enable row level security;

alter table public.fechamento_ajustes
  enable row level security;

commit;