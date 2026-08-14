import { NextResponse } from "next/server";
import {
  db,
  conferirAmbiente,
  pegarBarbearia,
} from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { montarInstante } from "@/lib/formato";
import { resolverUnidadeEfetiva } from "@/lib/unidades";

export const dynamic = "force-dynamic";

const STATUS_VALIDOS = [
  "agendado",
  "confirmado",
  "concluido",
  "cancelado",
];

const TRANSICOES = {
  agendado: [
    "confirmado",
    "concluido",
    "cancelado",
  ],

  confirmado: [
    "concluido",
    "cancelado",
  ],

  concluido: [],

  cancelado: [],
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATA_RE =
  /^\d{4}-\d{2}-\d{2}$/;

const HORA_RE =
  /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resposta(
  dados,
  status = 200
) {
  return NextResponse.json(
    dados,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

function texto(
  valor,
  max = 255
) {
  return String(
    valor ?? ""
  )
    .trim()
    .slice(0, max);
}

function dataValida(valor) {
  if (
    !DATA_RE.test(valor)
  ) {
    return false;
  }

  const [
    ano,
    mes,
    dia,
  ] = valor
    .split("-")
    .map(Number);

  const data =
    new Date(
      Date.UTC(
        ano,
        mes - 1,
        dia
      )
    );

  return (
    data.getUTCFullYear() ===
      ano &&
    data.getUTCMonth() ===
      mes - 1 &&
    data.getUTCDate() ===
      dia
  );
}

function minutos(horario) {
  const [
    hora,
    minuto,
  ] = horario
    .split(":")
    .map(Number);

  return (
    hora * 60 +
    minuto
  );
}

function normalizar(valor) {
  return String(
    valor || ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase();
}

function diasPermitidos(
  textoDias
) {
  const textoNormalizado =
    normalizar(
      textoDias
    );

  if (!textoNormalizado) {
    return null;
  }

  const nomes = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ];

  const indice =
    Object.fromEntries(
      nomes.map(
        (nome, i) => [
          nome,
          i,
        ]
      )
    );

  const encontrados =
    new Set();

  const faixa =
    /(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\s*(?:a|ate|-)\s*(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?/g;

  let match;

  while (
    (
      match =
        faixa.exec(
          textoNormalizado
        )
    )
  ) {
    const inicio =
      indice[
        match[1]
      ];

    const fim =
      indice[
        match[2]
      ];

    let atual =
      inicio;

    encontrados.add(
      atual
    );

    while (
      atual !== fim
    ) {
      atual =
        (atual + 1) %
        7;

      encontrados.add(
        atual
      );

      if (
        encontrados.size ===
        7
      ) {
        break;
      }
    }
  }

  for (
    const nome of nomes
  ) {
    if (
      new RegExp(
        `\\b${nome}(?:-feira)?\\b`
      ).test(
        textoNormalizado
      )
    ) {
      encontrados.add(
        indice[nome]
      );
    }
  }

  return encontrados.size
    ? encontrados
    : null;
}

function diaDaSemana(
  data
) {
  const [
    ano,
    mes,
    dia,
  ] = data
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(
      ano,
      mes - 1,
      dia,
      12
    )
  ).getUTCDay();
}

/**
 * Aceita tanto:
 *
 * 09:00
 * 09:00:00
 *
 * caso o banco devolva TIME
 * com segundos.
 */
function horaConfigurada(
  valor,
  padrao
) {
  const hora =
    String(
      valor || ""
    ).slice(0, 5);

  return HORA_RE.test(
    hora
  )
    ? hora
    : padrao;
}

function erroConflitoBanco(
  erro
) {
  return (
    erro?.code ===
      "23P01" ||
    String(
      erro?.message ||
        ""
    )
      .toLowerCase()
      .includes(
        "agendamentos_sem_sobreposicao"
      )
  );
}

/**
 * POST /api/agendamentos
 *
 * Usado pelo site público e
 * pela área do cliente.
 */
export async function POST(
  req
) {
  try {
    conferirAmbiente();

    const contentType =
      req.headers.get(
        "content-type"
      ) || "";

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
      return resposta(
        {
          erro:
            "Formato da requisição inválido.",
        },
        415
      );
    }

    const [usuarioAutenticado, barbearia] = await Promise.all([
      usuarioAtual().catch(() => null),
      pegarBarbearia(),
    ]);
    const operacaoInterna = ["admin", "colaborador"].includes(usuarioAutenticado?.papel);
    if (!operacaoInterna && barbearia.agendamento_online_ativo === false) {
      return resposta({ erro: "Agendamento online indisponível no momento." }, 403);
    }

    let corpo;

    try {
      corpo =
        await req.json();
    } catch {
      return resposta(
        {
          erro:
            "Dados inválidos.",
        },
        400
      );
    }

    const obrigatorios = [
      "nome_cliente",
      "telefone_cliente",
      "unidade_id",
      "profissional_id",
      "servico_id",
      "data",
      "horario",
    ];

    const faltando =
      obrigatorios.filter(
        (campo) =>
          !texto(
            corpo[campo]
          )
      );

    if (
      faltando.length
    ) {
      return resposta(
        {
          erro:
            `Preencha: ${faltando.join(
              ", "
            )}.`,
        },
        400
      );
    }

    const nomeCliente =
      texto(
        corpo.nome_cliente,
        120
      );

    const telefoneCliente =
      texto(
        corpo.telefone_cliente,
        30
      );

    const emailCliente =
      texto(
        corpo.email_cliente,
        180
      ).toLowerCase();

    const observacoes =
      texto(
        corpo.observacoes,
        1000
      ) || null;

    let profissionalId =
      texto(
        corpo.profissional_id,
        50
      );

    const servicoId =
      texto(
        corpo.servico_id,
        50
      );
    const unidadeId = texto(corpo.unidade_id, 50);

    const dataInformada =
      texto(
        corpo.data,
        10
      );

    const horarioInformado =
      texto(
        corpo.horario,
        5
      );

    if (
      nomeCliente.length <
      2
    ) {
      return resposta(
        {
          erro:
            "Informe o nome do cliente.",
        },
        400
      );
    }

    if (
      telefoneCliente.length <
      8
    ) {
      return resposta(
        {
          erro:
            "Informe um telefone válido.",
        },
        400
      );
    }

    if (
      emailCliente &&
      !EMAIL_RE.test(
        emailCliente
      )
    ) {
      return resposta(
        {
          erro:
            "Informe um e-mail válido.",
        },
        400
      );
    }

    if (
      !UUID_RE.test(unidadeId) || !UUID_RE.test(
        profissionalId
      ) ||
      !UUID_RE.test(
        servicoId
      )
    ) {
      return resposta(
        {
          erro:
            "Serviço ou profissional inválido.",
        },
        400
      );
    }

    if (
      !dataValida(
        dataInformada
      ) ||
      !HORA_RE.test(
        horarioInformado
      )
    ) {
      return resposta(
        {
          erro:
            "Data ou horário inválido.",
        },
        400
      );
    }

    if (usuarioAutenticado?.papel === "colaborador") profissionalId = usuarioAutenticado.id;

    const [
      respostaServico,
      respostaProfissional,
    ] =
      await Promise.all([
        db
          .from(
            "servicos"
          )
          .select(
            "id, preco, duracao_min, ativo"
          )
          .eq(
            "id",
            servicoId
          )
          .maybeSingle(),

        db
          .from(
            "usuarios"
          )
          .select(
            "id, papel, ativo, unidade_id"
          )
          .eq(
            "id",
            profissionalId
          )
          .maybeSingle(),
      ]);

    if (
      respostaServico.error
    ) {
      throw respostaServico.error;
    }

    if (
      respostaProfissional.error
    ) {
      throw respostaProfissional.error;
    }

    const servico =
      respostaServico.data;

    const profissional =
      respostaProfissional.data;

    if (
      !servico ||
      !servico.ativo
    ) {
      return resposta(
        {
          erro:
            "Esse serviço não está disponível.",
        },
        400
      );
    }

    if (
      !profissional ||
      profissional.papel !==
        "colaborador" ||
      !profissional.ativo
    ) {
      return resposta(
        {
          erro:
            "Esse profissional não está disponível.",
        },
        400
      );
    }
    const unidadeEfetiva = await resolverUnidadeEfetiva(profissionalId, dataInformada, profissional.unidade_id);
    if (unidadeEfetiva !== unidadeId) return resposta({ erro: "O profissional não atende na unidade selecionada nessa data." }, 400);
    const { data: habilitado, error: erroHabilitado } = await db.from("profissional_servicos").select("profissional_id").eq("profissional_id", profissionalId).eq("servico_id", servicoId).maybeSingle();
    if (erroHabilitado) throw erroHabilitado;
    if (!habilitado) return resposta({ erro: "Esse profissional não realiza o serviço selecionado." }, 400);

    const duracao =
      Number(
        servico.duracao_min
      );

    if (
      !Number.isFinite(
        duracao
      ) ||
      duracao <= 0 ||
      duracao >
        24 * 60
    ) {
      return resposta(
        {
          erro:
            "A duração desse serviço é inválida.",
        },
        400
      );
    }

    const aberturaTexto =
      horaConfigurada(
        barbearia.hora_abertura,
        "09:00"
      );

    const fechamentoTexto =
      horaConfigurada(
        barbearia.hora_fechamento,
        "20:00"
      );

    const intervalo =
      Number(
        barbearia.intervalo_min
      );

    const passo =
      Number.isFinite(
        intervalo
      ) &&
      intervalo > 0
        ? Math.floor(
            intervalo
          )
        : 30;

    const permitidos =
      diasPermitidos(
        barbearia.dias_funcionamento
      );

    if (
      permitidos &&
      !permitidos.has(
        diaDaSemana(
          dataInformada
        )
      )
    ) {
      return resposta(
        {
          erro:
            "A barbearia não atende nesse dia da semana.",
        },
        400
      );
    }

    const inicio =
      montarInstante(
        dataInformada,
        horarioInformado
      );

    if (
      Number.isNaN(
        inicio.getTime()
      )
    ) {
      return resposta(
        {
          erro:
            "Data ou horário inválido.",
        },
        400
      );
    }

    const fim =
      new Date(
        inicio.getTime() +
          duracao *
            60000
      );

    const abertura =
      montarInstante(
        dataInformada,
        aberturaTexto
      );

    const fechamento =
      montarInstante(
        dataInformada,
        fechamentoTexto
      );

    if (
      Number.isNaN(
        abertura.getTime()
      ) ||
      Number.isNaN(
        fechamento.getTime()
      ) ||
      fechamento <=
        abertura
    ) {
      return resposta(
        {
          erro:
            "Horário de funcionamento inválido.",
        },
        500
      );
    }

    if (
      inicio.getTime() <=
      Date.now()
    ) {
      return resposta(
        {
          erro:
            "Escolha um horário futuro.",
        },
        400
      );
    }

    if (
      inicio <
        abertura ||
      fim >
        fechamento
    ) {
      return resposta(
        {
          erro:
            "Esse horário está fora do funcionamento da barbearia.",
        },
        400
      );
    }

    const { data: jornadas = [], error: erroJornada } = await db.from("profissional_horarios").select("hora_inicio,hora_fim").eq("profissional_id", profissionalId).eq("dia_semana", diaDaSemana(dataInformada)).eq("ativo", true);
    if (erroJornada) throw erroJornada;
    const dentroDaJornada = jornadas.some((jornada) => {
      const ji = montarInstante(dataInformada, String(jornada.hora_inicio || "").slice(0, 5));
      const jf = montarInstante(dataInformada, String(jornada.hora_fim || "").slice(0, 5));
      return !Number.isNaN(ji.getTime()) && inicio >= ji && fim <= jf;
    });
    if (!dentroDaJornada) return resposta({ erro: "Esse horário está fora da jornada do profissional." }, 400);

    const inicioMin =
      minutos(
        horarioInformado
      );

    const aberturaMin =
      minutos(
        aberturaTexto
      );

    if (
      (
        inicioMin -
        aberturaMin
      ) %
        passo !==
      0
    ) {
      return resposta(
        {
          erro:
            "Esse horário não pertence à grade de atendimento.",
        },
        400
      );
    }

    /**
     * Verifica diretamente qualquer
     * sobreposição com o intervalo
     * que está sendo solicitado.
     */
    const {
      data: conflitos = [],
      error:
        erroConflitos,
    } = await db
      .from(
        "agendamentos"
      )
      .select(
        "id"
      )
      .eq(
        "profissional_id",
        profissionalId
      )
      .neq(
        "status",
        "cancelado"
      )
      .lt(
        "inicio",
        fim.toISOString()
      )
      .gt(
        "fim",
        inicio.toISOString()
      )
      .limit(1);

    if (
      erroConflitos
    ) {
      throw erroConflitos;
    }

    if (
      conflitos.length >
      0
    ) {
      return resposta(
        {
          erro:
            "Esse horário acabou de ser ocupado. Escolha outro.",
        },
        409
      );
    }

    /**
     * cliente_id nunca é aceito
     * diretamente do navegador.
     */
    const usuario = usuarioAutenticado;

    const clienteId =
      usuario?.papel ===
      "cliente"
        ? usuario.id
        : null;

    const {
      data,
      error,
    } = await db
      .from(
        "agendamentos"
      )
      .insert({
        unidade_id: unidadeId,
        cliente_id:
          clienteId,

        nome_cliente:
          nomeCliente,

        telefone_cliente:
          telefoneCliente,

        email_cliente:
          emailCliente ||
          null,

        profissional_id:
          profissionalId,

        servico_id:
          servicoId,

        inicio:
          inicio.toISOString(),

        fim:
          fim.toISOString(),

        preco:
          Number(
            servico.preco ||
              0
          ),

        observacoes,

        status:
          "agendado",
        origem: usuario?.papel === "colaborador" ? texto(corpo.origem, 40) || "manual" : "site",
      })
      .select(
        [
          "id",
          "cliente_id",
          "nome_cliente",
          "telefone_cliente",
          "email_cliente",
          "profissional_id",
          "servico_id",
          "inicio",
          "fim",
          "preco",
          "observacoes",
          "status",
        ].join(",")
      )
      .single();

    if (error) {
      /**
       * Mesmo se duas pessoas tentarem
       * reservar exatamente ao mesmo
       * tempo, a constraint do PostgreSQL
       * continua sendo a última proteção.
       */
      if (
        erroConflitoBanco(
          error
        )
      ) {
        return resposta(
          {
            erro:
              "Esse horário acabou de ser ocupado. Escolha outro.",
          },
          409
        );
      }

      throw error;
    }

    return resposta(
      {
        agendamento:
          data,
      },
      201
    );
  } catch (e) {
    console.error(
      "[api/agendamentos POST]",
      e
    );

    return resposta(
      {
        erro:
          process.env.NODE_ENV ===
          "development"
            ? e?.message ||
              "Não foi possível agendar."
            : "Não foi possível agendar.",
      },
      500
    );
  }
}

/**
 * PATCH /api/agendamentos
 *
 * Altera a situação de um
 * agendamento.
 *
 * Apenas:
 * - admin
 * - colaborador
 *
 * Colaborador só pode alterar
 * os próprios atendimentos.
 */
export async function PATCH(
  req
) {
  try {
    conferirAmbiente();

    const usuario =
      await usuarioAtual().catch(
        () => null
      );

    if (
      !usuario ||
      ![
        "admin",
        "colaborador",
      ].includes(
        usuario.papel
      )
    ) {
      return resposta(
        {
          erro:
            "Sem permissão.",
        },
        403
      );
    }

    const contentType =
      req.headers.get(
        "content-type"
      ) || "";

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
      return resposta(
        {
          erro:
            "Formato da requisição inválido.",
        },
        415
      );
    }

    let corpo;

    try {
      corpo =
        await req.json();
    } catch {
      return resposta(
        {
          erro:
            "Dados inválidos.",
        },
        400
      );
    }

    const id =
      texto(
        corpo.id,
        50
      );

    const novoStatus =
      texto(
        corpo.status,
        20
      ).toLowerCase();

    if (
      !UUID_RE.test(
        id
      ) ||
      !STATUS_VALIDOS.includes(
        novoStatus
      )
    ) {
      return resposta(
        {
          erro:
            "Dados inválidos.",
        },
        400
      );
    }

    /**
     * Primeiro descobrimos qual
     * é a situação atual.
     *
     * Assim ninguém consegue pular
     * as regras chamando a API
     * manualmente.
     */
    const {
      data: atual,
      error:
        erroAtual,
    } = await db
      .from(
        "agendamentos"
      )
      .select(
        "id, profissional_id, status"
      )
      .eq(
        "id",
        id
      )
      .maybeSingle();

    if (erroAtual) {
      throw erroAtual;
    }

    if (!atual) {
      return resposta(
        {
          erro:
            "Agendamento não encontrado.",
        },
        404
      );
    }

    /**
     * O colaborador nunca pode
     * modificar atendimento de
     * outro profissional.
     */
    if (
      usuario.papel ===
        "colaborador" &&
      atual.profissional_id !==
        usuario.id
    ) {
      return resposta(
        {
          erro:
            "Agendamento não encontrado ou sem permissão para alterá-lo.",
        },
        404
      );
    }

    /**
     * Se já está nesse status,
     * tratamos como sucesso.
     *
     * Isso evita erro em caso de
     * clique duplo ou atualização
     * duplicada.
     */
    if (
      atual.status ===
      novoStatus
    ) {
      return resposta({
        ok: true,

        agendamento: {
          id:
            atual.id,

          status:
            atual.status,
        },
      });
    }

    if (
      !STATUS_VALIDOS.includes(
        atual.status
      )
    ) {
      return resposta(
        {
          erro:
            "O agendamento possui uma situação inválida e não pode ser alterado.",
        },
        409
      );
    }

    const permitidas =
      TRANSICOES[
        atual.status
      ] || [];

    /**
     * Estados finais:
     *
     * concluído
     * cancelado
     *
     * Não podem voltar nem trocar
     * para outro status por esta API.
     */
    if (
      !permitidas.includes(
        novoStatus
      )
    ) {
      const mensagens = {
        concluido:
          "Esse atendimento já foi concluído e não pode mais ser alterado.",

        cancelado:
          "Esse atendimento já foi cancelado e não pode mais ser alterado.",
      };

      return resposta(
        {
          erro:
            mensagens[
              atual.status
            ] ||
            "Essa mudança de situação não é permitida.",
        },
        409
      );
    }

    /**
     * Atualização atômica:
     *
     * só altera se o status ainda
     * for exatamente o mesmo que
     * acabamos de consultar.
     *
     * Isso evita duas alterações
     * simultâneas passando juntas.
     */
    let consulta = db
      .from(
        "agendamentos"
      )
      .update({
        status:
          novoStatus,
      })
      .eq(
        "id",
        id
      )
      .eq(
        "status",
        atual.status
      );

    if (
      usuario.papel ===
      "colaborador"
    ) {
      consulta =
        consulta.eq(
          "profissional_id",
          usuario.id
        );
    }

    const {
      data,
      error,
    } =
      await consulta
        .select(
          "id, status"
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return resposta(
        {
          erro:
            "Esse atendimento acabou de ser alterado. Atualize a agenda e tente novamente.",
        },
        409
      );
    }

    return resposta({
      ok: true,

      agendamento:
        data,
    });
  } catch (e) {
    console.error(
      "[api/agendamentos PATCH]",
      e
    );

    return resposta(
      {
        erro:
          process.env.NODE_ENV ===
          "development"
            ? e?.message ||
              "Não foi possível atualizar o agendamento."
            : "Não foi possível atualizar o agendamento.",
      },
      500
    );
  }
}
