-- =====================================================================
-- NAVALHA · Banco de dados
-- Supabase / PostgreSQL
--
-- Este arquivo pode ser executado novamente.
--
-- Ele:
-- - cria as tabelas;
-- - adiciona índices;
-- - ativa RLS;
-- - protege conflito de agenda;
-- - controla estoque automaticamente;
-- - mantém os dados iniciais sem duplicá-los.
-- =====================================================================

begin;

-- =====================================================================
-- EXTENSÕES
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;


-- =====================================================================
-- CONFIGURAÇÃO DA BARBEARIA
-- Uma única linha: id = 1
-- =====================================================================

create table if not exists barbearia (
  id                  int primary key default 1,
  nome                text not null default 'Navalha Barbearia',
  slogan              text default 'Corte, barba e cuidado com hora marcada.',
  sobre               text default 'Uma barbearia de bairro com padrão de alfaiataria.',
  telefone            text default '(00) 0000-0000',
  whatsapp            text default '5500000000000',
  email               text default 'contato@suabarbearia.com.br',
  endereco            text default 'Rua Exemplo, 100 - Centro',
  instagram           text default '@suabarbearia',
  hora_abertura       text default '09:00',
  hora_fechamento     text default '20:00',
  dias_funcionamento  text default 'Terça a sábado',
  intervalo_min       int default 30,

  constraint linha_unica
    check (id = 1)
);


-- =====================================================================
-- USUÁRIOS
-- admin | colaborador | cliente
-- =====================================================================

create table if not exists usuarios (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  email           text not null unique,
  telefone        text not null,
  senha_hash      text not null,

  papel           text not null default 'cliente'
    check (
      papel in (
        'admin',
        'colaborador',
        'cliente'
      )
    ),

  ativo           boolean not null default true,

  especialidade   text,
  comissao        numeric(5,2) default 0,

  cpf             text,
  nascimento      date,
  observacoes     text,

  criado_em       timestamptz not null default now()
);


-- =====================================================================
-- SERVIÇOS
-- =====================================================================

create table if not exists servicos (
  id           uuid primary key default gen_random_uuid(),

  nome         text not null,
  descricao    text,

  preco        numeric(10,2) not null default 0,

  duracao_min  int not null default 30,

  categoria    text default 'Barbearia',

  ativo        boolean not null default true,

  ordem        int default 0
);


-- =====================================================================
-- PRODUTOS
-- =====================================================================

create table if not exists produtos (
  id          uuid primary key default gen_random_uuid(),

  nome        text not null,
  descricao   text,

  preco       numeric(10,2) not null default 0,

  custo       numeric(10,2) default 0,

  estoque     int default 0,

  ativo       boolean not null default true
);


-- =====================================================================
-- PLANOS
-- =====================================================================

create table if not exists planos (
  id             uuid primary key default gen_random_uuid(),

  nome           text not null,
  descricao      text,

  preco          numeric(10,2) not null default 0,

  periodicidade  text default 'Mensal',

  beneficios     text,

  destaque       boolean not null default false,

  ativo          boolean not null default true,

  ordem          int default 0
);


-- =====================================================================
-- ASSINATURAS
-- =====================================================================

create table if not exists assinaturas (
  id                uuid primary key default gen_random_uuid(),

  cliente_id        uuid references usuarios(id) on delete set null,

  plano_id          uuid references planos(id) on delete set null,

  status            text not null default 'ativa'
    check (
      status in (
        'ativa',
        'pendente',
        'cancelada'
      )
    ),

  inicio            date not null default current_date,

  proxima_cobranca  date,

  valor             numeric(10,2) default 0,

  criado_em         timestamptz not null default now()
);


-- =====================================================================
-- AGENDAMENTOS
-- =====================================================================

create table if not exists agendamentos (
  id                uuid primary key default gen_random_uuid(),

  cliente_id        uuid references usuarios(id) on delete set null,

  nome_cliente      text not null,

  telefone_cliente  text not null,

  email_cliente     text,

  profissional_id   uuid references usuarios(id) on delete set null,

  servico_id        uuid references servicos(id) on delete set null,

  inicio            timestamptz not null,

  fim               timestamptz,

  status            text not null default 'agendado'
    check (
      status in (
        'agendado',
        'confirmado',
        'concluido',
        'cancelado'
      )
    ),

  preco             numeric(10,2) default 0,

  observacoes       text,

  criado_em         timestamptz not null default now()
);


-- =====================================================================
-- VENDAS
--
-- valor = valor UNITÁRIO
--
-- Exemplo:
--
-- produto R$ 50
-- quantidade 2
--
-- total = R$ 100
-- =====================================================================

create table if not exists vendas (
  id                uuid primary key default gen_random_uuid(),

  colaborador_id    uuid references usuarios(id) on delete set null,

  cliente_id        uuid references usuarios(id) on delete set null,

  tipo              text not null default 'servico'
    check (
      tipo in (
        'servico',
        'produto'
      )
    ),

  servico_id        uuid references servicos(id) on delete set null,

  produto_id        uuid references produtos(id) on delete set null,

  descricao         text not null,

  quantidade        int not null default 1,

  valor             numeric(10,2) not null default 0,

  forma_pagamento   text default 'Dinheiro',

  criado_em         timestamptz not null default now()
);


-- =====================================================================
-- AJUSTES PARA BANCOS QUE JÁ EXISTEM
-- =====================================================================

update usuarios
set email = lower(trim(email))
where email <> lower(trim(email));


update produtos
set estoque = 0
where estoque is null;


alter table produtos
  alter column estoque set default 0;


alter table produtos
  alter column estoque set not null;


-- ---------------------------------------------------------------------
-- Corrige agendamentos antigos que estejam sem horário final.
--
-- Se houver serviço:
-- usa a duração cadastrada.
--
-- Se não houver:
-- usa 30 minutos.
-- ---------------------------------------------------------------------

update agendamentos a
set fim =
  a.inicio
  +
  make_interval(
    mins =>
      coalesce(
        (
          select s.duracao_min
          from servicos s
          where s.id = a.servico_id
        ),
        30
      )
  )
where
  a.fim is null
  or a.fim <= a.inicio;


alter table agendamentos
  alter column fim set not null;


-- =====================================================================
-- ALTERA FK DE ASSINATURA
--
-- Antes o cliente podia ser apagado em CASCADE
-- junto com o histórico da assinatura.
--
-- Agora preservamos o histórico.
-- =====================================================================

alter table assinaturas
  drop constraint if exists assinaturas_cliente_id_fkey;


alter table assinaturas
  add constraint assinaturas_cliente_id_fkey
  foreign key (cliente_id)
  references usuarios(id)
  on delete set null;


-- =====================================================================
-- CONSTRAINTS EXTRAS
-- =====================================================================

do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'usuarios_comissao_valida'
      and conrelid = 'usuarios'::regclass
  ) then

    alter table usuarios
      add constraint usuarios_comissao_valida
      check (
        comissao is null
        or (
          comissao >= 0
          and comissao <= 100
        )
      );

  end if;

end $$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'servicos_preco_valido'
      and conrelid = 'servicos'::regclass
  ) then

    alter table servicos
      add constraint servicos_preco_valido
      check (preco >= 0);

  end if;

end $$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'servicos_duracao_valida'
      and conrelid = 'servicos'::regclass
  ) then

    alter table servicos
      add constraint servicos_duracao_valida
      check (
        duracao_min > 0
        and duracao_min <= 1440
      );

  end if;

end $$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'produtos_preco_valido'
      and conrelid = 'produtos'::regclass
  ) then

    alter table produtos
      add constraint produtos_preco_valido
      check (preco >= 0);

  end if;

end $$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'produtos_custo_valido'
      and conrelid = 'produtos'::regclass
  ) then

    alter table produtos
      add constraint produtos_custo_valido
      check (
        custo is null
        or custo >= 0
      );

  end if;

end $$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'produtos_estoque_valido'
      and conrelid = 'produtos'::regclass
  ) then

    alter table produtos
      add constraint produtos_estoque_valido
      check (estoque >= 0);

  end if;

end $$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'planos_preco_valido'
      and conrelid = 'planos'::regclass
  ) then

    alter table planos
      add constraint planos_preco_valido
      check (preco >= 0);

  end if;

end $$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'assinaturas_valor_valido'
      and conrelid = 'assinaturas'::regclass
  ) then

    alter table assinaturas
      add constraint assinaturas_valor_valido
      check (
        valor is null
        or valor >= 0
      );

  end if;

end $$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'agendamentos_intervalo_valido'
      and conrelid = 'agendamentos'::regclass
  ) then

    alter table agendamentos
      add constraint agendamentos_intervalo_valido
      check (fim > inicio);

  end if;

end $$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'vendas_quantidade_valida'
      and conrelid = 'vendas'::regclass
  ) then

    alter table vendas
      add constraint vendas_quantidade_valida
      check (quantidade > 0);

  end if;

end $$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'vendas_valor_valido'
      and conrelid = 'vendas'::regclass
  ) then

    alter table vendas
      add constraint vendas_valor_valido
      check (valor >= 0);

  end if;

end $$;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'vendas_pagamento_valido'
      and conrelid = 'vendas'::regclass
  ) then

    alter table vendas
      add constraint vendas_pagamento_valido
      check (
        forma_pagamento in (
          'Dinheiro',
          'Pix',
          'Débito',
          'Crédito'
        )
      );

  end if;

end $$;


-- =====================================================================
-- E-MAIL SEMPRE NORMALIZADO
--
-- Exemplo:
--
-- Admin@Navalha.com.br
--
-- vira:
--
-- admin@navalha.com.br
-- =====================================================================

create or replace function normalizar_email_usuario()
returns trigger
language plpgsql
as $$
begin

  new.email :=
    lower(
      trim(new.email)
    );

  return new;

end;
$$;


drop trigger if exists trg_normalizar_email_usuario
on usuarios;


create trigger trg_normalizar_email_usuario
before insert or update of email
on usuarios
for each row
execute function normalizar_email_usuario();


-- Proteção extra contra e-mails iguais
-- usando maiúsculas/minúsculas diferentes.

create unique index if not exists
usuarios_email_normalizado_uq
on usuarios (
  lower(trim(email))
);


-- =====================================================================
-- PROTEÇÃO CONTRA DOIS AGENDAMENTOS AO MESMO TEMPO
--
-- Exemplo:
--
-- Bruno:
-- 14:00 até 14:40
--
-- outro:
-- 14:30 até 15:10
--
-- O PostgreSQL BLOQUEIA.
--
-- 14:40 até 15:20
-- é permitido.
-- =====================================================================

do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'agendamentos_sem_sobreposicao'
      and conrelid = 'agendamentos'::regclass
  ) then

    alter table agendamentos
      add constraint agendamentos_sem_sobreposicao

      exclude using gist (

        profissional_id with =,

        tstzrange(
          inicio,
          fim,
          '[)'
        ) with &&

      )

      where (
        status <> 'cancelado'
        and profissional_id is not null
      );

  end if;

end $$;


-- =====================================================================
-- CONTROLE AUTOMÁTICO DE ESTOQUE
--
-- INSERT:
-- venda de produto -> diminui estoque
--
-- DELETE:
-- excluiu venda -> devolve estoque
--
-- UPDATE:
-- alterou produto ou quantidade ->
-- corrige estoque automaticamente
--
-- Tudo acontece dentro da MESMA transação.
-- =====================================================================

create or replace function movimentar_estoque_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  estoque_atual integer;
  produto_ativo boolean;
begin

  -- ================================================================
  -- INSERT
  -- ================================================================

  if tg_op = 'INSERT' then

    if new.tipo = 'produto' then

      if new.produto_id is null then
        raise exception
          'Selecione o produto vendido.';
      end if;


      if new.quantidade is null
         or new.quantidade <= 0 then

        raise exception
          'A quantidade precisa ser maior que zero.';

      end if;


      -- Produto não usa servico_id.

      new.servico_id := null;


      select
        p.estoque,
        p.ativo

      into
        estoque_atual,
        produto_ativo

      from produtos p

      where p.id = new.produto_id

      for update;


      if not found then

        raise exception
          'Produto não encontrado.';

      end if;


      if not produto_ativo then

        raise exception
          'Esse produto está inativo.';

      end if;


      if estoque_atual < new.quantidade then

        raise exception
          'Estoque insuficiente. Disponível: %.',
          estoque_atual;

      end if;


      update produtos

      set estoque =
        estoque - new.quantidade

      where id =
        new.produto_id;

    else

      -- Serviço não usa produto_id.

      new.produto_id := null;

    end if;


    return new;

  end if;


  -- ================================================================
  -- DELETE
  -- ================================================================

  if tg_op = 'DELETE' then

    if old.tipo = 'produto'
       and old.produto_id is not null then

      update produtos

      set estoque =
        estoque + old.quantidade

      where id =
        old.produto_id;

    end if;


    return old;

  end if;


  -- ================================================================
  -- UPDATE
  -- ================================================================

  if tg_op = 'UPDATE' then

    -- Só mexemos no estoque se algum dado
    -- relacionado ao estoque mudou.

    if
      old.tipo is distinct from new.tipo
      or old.produto_id is distinct from new.produto_id
      or old.quantidade is distinct from new.quantidade
    then

      -- Primeiro devolvemos o estoque antigo.

      if old.tipo = 'produto'
         and old.produto_id is not null then

        update produtos

        set estoque =
          estoque + old.quantidade

        where id =
          old.produto_id;

      end if;


      -- Depois aplicamos a nova movimentação.

      if new.tipo = 'produto' then

        if new.produto_id is null then

          raise exception
            'Selecione o produto vendido.';

        end if;


        if new.quantidade is null
           or new.quantidade <= 0 then

          raise exception
            'A quantidade precisa ser maior que zero.';

        end if;


        new.servico_id := null;


        select
          p.estoque,
          p.ativo

        into
          estoque_atual,
          produto_ativo

        from produtos p

        where p.id =
          new.produto_id

        for update;


        if not found then

          raise exception
            'Produto não encontrado.';

        end if;


        if not produto_ativo then

          raise exception
            'Esse produto está inativo.';

        end if;


        if estoque_atual < new.quantidade then

          raise exception
            'Estoque insuficiente. Disponível: %.',
            estoque_atual;

        end if;


        update produtos

        set estoque =
          estoque - new.quantidade

        where id =
          new.produto_id;

      else

        new.produto_id := null;

      end if;

    end if;


    return new;

  end if;


  return null;

end;
$$;


drop trigger if exists
trg_movimentar_estoque_venda
on vendas;


create trigger
trg_movimentar_estoque_venda

before insert or update or delete

on vendas

for each row

execute function movimentar_estoque_venda();


-- =====================================================================
-- ÍNDICES
-- =====================================================================

create index if not exists
idx_agend_inicio
on agendamentos (
  inicio
);


create index if not exists
idx_agend_profissional_inicio
on agendamentos (
  profissional_id,
  inicio
);


create index if not exists
idx_agend_cliente_inicio
on agendamentos (
  cliente_id,
  inicio
);


create index if not exists
idx_vendas_data
on vendas (
  criado_em
);


create index if not exists
idx_vendas_colab
on vendas (
  colaborador_id
);


create index if not exists
idx_vendas_produto
on vendas (
  produto_id
);


create index if not exists
idx_assinaturas_cliente
on assinaturas (
  cliente_id
);


-- =====================================================================
-- ROW LEVEL SECURITY
--
-- O sistema acessa o banco pelo servidor
-- usando service_role.
--
-- Não criamos policies públicas.
-- =====================================================================

alter table barbearia
  enable row level security;

alter table usuarios
  enable row level security;

alter table servicos
  enable row level security;

alter table produtos
  enable row level security;

alter table planos
  enable row level security;

alter table assinaturas
  enable row level security;

alter table agendamentos
  enable row level security;

alter table vendas
  enable row level security;


-- =====================================================================
-- DADOS INICIAIS
--
-- Senha dos acessos de exemplo:
--
-- navalha123
--
-- IMPORTANTE:
-- troque essas senhas antes de produção.
-- =====================================================================


-- ---------------------------------------------------------------------
-- BARBEARIA
-- ---------------------------------------------------------------------

insert into barbearia (
  id
)
values (
  1
)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- USUÁRIOS
-- ---------------------------------------------------------------------

insert into usuarios (
  nome,
  email,
  telefone,
  senha_hash,
  papel,
  especialidade,
  comissao
)
values

(
  'Dono da Barbearia',
  'admin@navalha.com.br',
  '(67) 90000-0001',
  '$2a$10$BloF/fGJqSYATDKONHjzBOtYYrO9FV9PXDaLIVsNgWGZxFKsO18Bu',
  'admin',
  null,
  0
),

(
  'Rafael Souza',
  'rafael@navalha.com.br',
  '(67) 90000-0002',
  '$2a$10$BloF/fGJqSYATDKONHjzBOtYYrO9FV9PXDaLIVsNgWGZxFKsO18Bu',
  'colaborador',
  'Corte clássico e navalha',
  40
),

(
  'Bruno Lima',
  'bruno@navalha.com.br',
  '(67) 90000-0003',
  '$2a$10$BloF/fGJqSYATDKONHjzBOtYYrO9FV9PXDaLIVsNgWGZxFKsO18Bu',
  'colaborador',
  'Barba e degradê',
  40
)

on conflict (email)
do nothing;


-- ---------------------------------------------------------------------
-- SERVIÇOS
--
-- WHERE NOT EXISTS evita duplicação
-- quando o schema for executado novamente.
-- ---------------------------------------------------------------------

insert into servicos (
  nome,
  descricao,
  preco,
  duracao_min,
  categoria,
  ordem
)

select
  v.nome,
  v.descricao,
  v.preco,
  v.duracao_min,
  v.categoria,
  v.ordem

from (
  values

  (
    'Corte social',
    'Tesoura e máquina, finalização com pomada.',
    55::numeric,
    40,
    'Cabelo',
    1
  ),

  (
    'Corte degradê',
    'Transição trabalhada na máquina, acabamento na navalha.',
    65::numeric,
    45,
    'Cabelo',
    2
  ),

  (
    'Barba na toalha quente',
    'Toalha quente, navalha e balm calmante.',
    45::numeric,
    30,
    'Barba',
    3
  ),

  (
    'Cabelo + barba',
    'O combo da casa.',
    95::numeric,
    70,
    'Combo',
    4
  ),

  (
    'Sobrancelha na navalha',
    'Alinhamento discreto.',
    20::numeric,
    15,
    'Detalhes',
    5
  ),

  (
    'Pezinho',
    'Retoque de acabamento entre cortes.',
    25::numeric,
    15,
    'Detalhes',
    6
  )

) as v(
  nome,
  descricao,
  preco,
  duracao_min,
  categoria,
  ordem
)

where not exists (
  select 1

  from servicos s

  where
    lower(trim(s.nome))
    =
    lower(trim(v.nome))
);


-- ---------------------------------------------------------------------
-- PRODUTOS
-- ---------------------------------------------------------------------

insert into produtos (
  nome,
  descricao,
  preco,
  custo,
  estoque
)

select
  v.nome,
  v.descricao,
  v.preco,
  v.custo,
  v.estoque

from (
  values

  (
    'Pomada modeladora 120g',
    'Fixação média, brilho seco.',
    62::numeric,
    28::numeric,
    24
  ),

  (
    'Óleo para barba 30ml',
    'Amaciante, aroma amadeirado.',
    58::numeric,
    25::numeric,
    18
  ),

  (
    'Shampoo antiqueda 250ml',
    'Uso diário.',
    74::numeric,
    33::numeric,
    12
  )

) as v(
  nome,
  descricao,
  preco,
  custo,
  estoque
)

where not exists (
  select 1

  from produtos p

  where
    lower(trim(p.nome))
    =
    lower(trim(v.nome))
);


-- ---------------------------------------------------------------------
-- PLANOS
-- ---------------------------------------------------------------------

insert into planos (
  nome,
  descricao,
  preco,
  beneficios,
  destaque,
  ordem
)

select
  v.nome,
  v.descricao,
  v.preco,
  v.beneficios,
  v.destaque,
  v.ordem

from (
  values

  (
    'Aparado',
    'Para quem corta uma vez por mês.',
    89::numeric,
    '1 corte por mês|10% off em produtos|Agendamento prioritário',
    false,
    1
  ),

  (
    'Navalha',
    'O plano da casa: cabelo e barba sempre em dia.',
    159::numeric,
    '2 cortes por mês|2 barbas por mês|15% off em produtos|Cerveja ou café por conta da casa',
    true,
    2
  ),

  (
    'Alfaiataria',
    'Cuidado completo, sem contar visitas.',
    249::numeric,
    'Cortes ilimitados|Barba ilimitada|Sobrancelha inclusa|20% off em produtos|Horário reservado no sábado',
    false,
    3
  )

) as v(
  nome,
  descricao,
  preco,
  beneficios,
  destaque,
  ordem
)

where not exists (
  select 1

  from planos p

  where
    lower(trim(p.nome))
    =
    lower(trim(v.nome))
);


commit;