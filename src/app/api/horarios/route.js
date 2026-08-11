import { NextResponse } from "next/server";
import { db, conferirAmbiente, pegarBarbearia } from "@/lib/db";
import { FUSO_NOME, hora, limitesDoDia, montarInstante } from "@/lib/formato";
import { resolverUnidadeEfetiva } from "@/lib/unidades";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function texto(valor, max = 255) {
  return String(valor ?? "").trim().slice(0, max);
}

function dataValida(valor) {
  if (!DATA_RE.test(valor)) return false;

  const [ano, mes, dia] = valor.split("-").map(Number);
  const teste = new Date(Date.UTC(ano, mes - 1, dia));

  return (
    teste.getUTCFullYear() === ano &&
    teste.getUTCMonth() === mes - 1 &&
    teste.getUTCDate() === dia
  );
}

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function diasPermitidos(textoDias) {
  const textoNormalizado = normalizar(textoDias);

  if (!textoNormalizado) return null;

  const nomes = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ];

  const indice = Object.fromEntries(
    nomes.map((nome, i) => [nome, i])
  );

  const encontrados = new Set();

  const faixa =
    /(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\s*(?:a|ate|-)\s*(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?/g;

  let match;

  while ((match = faixa.exec(textoNormalizado))) {
    const inicio = indice[match[1]];
    const fim = indice[match[2]];

    let atual = inicio;

    encontrados.add(atual);

    while (atual !== fim) {
      atual = (atual + 1) % 7;
      encontrados.add(atual);

      if (encontrados.size === 7) break;
    }
  }

  for (const nome of nomes) {
    if (
      new RegExp(`\\b${nome}(?:-feira)?\\b`).test(textoNormalizado)
    ) {
      encontrados.add(indice[nome]);
    }
  }

  return encontrados.size ? encontrados : null;
}

function diaDaSemana(data) {
  const [ano, mes, dia] = data.split("-").map(Number);

  return new Date(
    Date.UTC(ano, mes - 1, dia, 12)
  ).getUTCDay();
}

function respostaVazia(erro = null, status = 200) {
  return NextResponse.json(
    {
      horarios: [],
      ...(erro ? { erro } : {}),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

/**
 * GET /api/horarios?data=2026-08-10&profissional=<id>&servico=<id>
 *
 * Retorna somente horários que:
 * - pertencem à grade da barbearia;
 * - estão dentro do horário de funcionamento;
 * - não estão no passado;
 * - cabem completamente antes do fechamento;
 * - não conflitam com outro agendamento do profissional;
 * - usam profissional e serviço válidos e ativos.
 */
export async function GET(req) {
  try {
    conferirAmbiente();

    const parametros = new URL(req.url).searchParams;

    const dataInformada = texto(
      parametros.get("data"),
      10
    );

    const profissionalId = texto(
      parametros.get("profissional"),
      50
    );

    const servicoId = texto(
      parametros.get("servico"),
      50
    );
    const unidadeId = texto(parametros.get("unidade"), 50);

    /*
     * Sem data ou profissional ainda não existe
     * informação suficiente para montar a agenda.
     */
    if (!dataInformada || !profissionalId || !unidadeId) {
      return respostaVazia();
    }

    /*
     * Validação básica dos parâmetros.
     */
    if (!dataValida(dataInformada)) {
      return respostaVazia(
        "Data inválida.",
        400
      );
    }

    if (!UUID_RE.test(profissionalId)) {
      return respostaVazia(
        "Profissional inválido.",
        400
      );
    }
    if (!UUID_RE.test(unidadeId)) return respostaVazia("Unidade inválida.", 400);

    if (
      servicoId &&
      !UUID_RE.test(servicoId)
    ) {
      return respostaVazia(
        "Serviço inválido.",
        400
      );
    }

    /*
     * Busca as configurações oficiais.
     */
    const barbearia =
      await pegarBarbearia();

    let aberturaTexto =
      HORA_RE.test(
        String(
          barbearia.hora_abertura ||
            ""
        )
      )
        ? String(
            barbearia.hora_abertura
          )
        : "09:00";

    let fechamentoTexto =
      HORA_RE.test(
        String(
          barbearia.hora_fechamento ||
            ""
        )
      )
        ? String(
            barbearia.hora_fechamento
          )
        : "20:00";

    const passoConfigurado =
      Number(
        barbearia.intervalo_min
      );

    const passo =
      Number.isFinite(
        passoConfigurado
      ) &&
      passoConfigurado > 0
        ? Math.floor(
            passoConfigurado
          )
        : 30;

    /*
     * Respeita os dias cadastrados.
     *
     * Exemplos:
     * Terça a sábado
     * Segunda a sexta
     * Segunda, quarta e sexta
     */
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
      return respostaVazia();
    }

    const { data: jornadas = [], error: erroJornada } = await db.from("profissional_horarios").select("hora_inicio,hora_fim").eq("profissional_id", profissionalId).eq("dia_semana", diaDaSemana(dataInformada)).eq("ativo", true).order("hora_inicio");
    if (erroJornada) throw erroJornada;
    if (!jornadas.length) return respostaVazia();
    const inicioProfissional = String(jornadas[0].hora_inicio || "").slice(0, 5);
    const fimProfissional = String(jornadas[jornadas.length - 1].hora_fim || "").slice(0, 5);
    if (HORA_RE.test(inicioProfissional) && inicioProfissional > aberturaTexto) aberturaTexto = inicioProfissional;
    if (HORA_RE.test(fimProfissional) && fimProfissional < fechamentoTexto) fechamentoTexto = fimProfissional;

    /*
     * Monta abertura e fechamento
     * usando o fuso da barbearia.
     */
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
      fechamento <= abertura
    ) {
      return respostaVazia(
        "Horário de funcionamento inválido.",
        500
      );
    }

    /*
     * Valida o profissional e, caso informado,
     * o serviço.
     */
    const consultas = [
      db
        .from("usuarios")
        .select(
          "id, papel, ativo, unidade_id"
        )
        .eq(
          "id",
          profissionalId
        )
        .maybeSingle(),
    ];

    if (servicoId) {
      consultas.push(
        db
          .from("servicos")
          .select(
            "id, duracao_min, ativo"
          )
          .eq(
            "id",
            servicoId
          )
          .maybeSingle()
      );
    }

    const resultados =
      await Promise.all(
        consultas
      );

    const {
      data: profissional,
      error: erroProfissional,
    } = resultados[0];

    if (erroProfissional) {
      throw erroProfissional;
    }

    /*
     * Não mostra horários de usuário inexistente,
     * cliente, admin ou barbeiro inativo.
     */
    if (
      !profissional ||
      profissional.papel !==
        "colaborador" ||
      !profissional.ativo
    ) {
      return respostaVazia(
        "Profissional indisponível.",
        400
      );
    }
    const unidadeEfetiva = await resolverUnidadeEfetiva(profissionalId, dataInformada, profissional.unidade_id);
    if (unidadeEfetiva !== unidadeId) return respostaVazia("O profissional não atende na unidade selecionada nessa data.", 400);
    if (servicoId) {
      const { data: vinculo, error: erroVinculo } = await db.from("profissional_servicos").select("profissional_id").eq("profissional_id", profissionalId).eq("servico_id", servicoId).maybeSingle();
      if (erroVinculo) throw erroVinculo;
      if (!vinculo) return respostaVazia("Serviço não realizado por esse profissional.", 400);
    }

    /*
     * Sem serviço informado, usa o intervalo
     * da agenda como duração provisória.
     */
    let duracao = passo;

    if (servicoId) {
      const {
        data: servico,
        error: erroServico,
      } = resultados[1];

      if (erroServico) {
        throw erroServico;
      }

      if (
        !servico ||
        !servico.ativo
      ) {
        return respostaVazia(
          "Serviço indisponível.",
          400
        );
      }

      const duracaoServico =
        Number(
          servico.duracao_min
        );

      if (
        !Number.isFinite(
          duracaoServico
        ) ||
        duracaoServico <= 0 ||
        duracaoServico >
          24 * 60
      ) {
        return respostaVazia(
          "Duração do serviço inválida.",
          500
        );
      }

      duracao =
        Math.floor(
          duracaoServico
        );
    }

    /*
     * Procura agendamentos do profissional
     * naquele dia.
     */
    const {
      de,
      ate,
    } = limitesDoDia(
      dataInformada
    );

    if (!de || !ate) {
      return respostaVazia(
        "Data inválida.",
        400
      );
    }

    const {
      data: ocupados = [],
      error: erroOcupados,
    } = await db
      .from("agendamentos")
      .select(
        "id, inicio, fim, status"
      )
      .eq(
        "profissional_id",
        profissionalId
      )
      .neq(
        "status",
        "cancelado"
      )
      .gte(
        "inicio",
        de
      )
      .lte(
        "inicio",
        ate
      )
      .order(
        "inicio",
        {
          ascending: true,
        }
      );

    if (erroOcupados) {
      throw erroOcupados;
    }

    const agora =
      new Date();

    const horarios = [];

    /*
     * Monta a grade de horários.
     *
     * Exemplo:
     * abertura: 09:00
     * intervalo: 30
     *
     * 09:00
     * 09:30
     * 10:00
     * ...
     */
    for (
      let inicioSlot =
        new Date(abertura);
      inicioSlot <
      fechamento;
      inicioSlot =
        new Date(
          inicioSlot.getTime() +
            passo *
              60000
        )
    ) {
      const fimSlot =
        new Date(
          inicioSlot.getTime() +
            duracao *
              60000
        );

      /*
       * Serviço precisa terminar
       * antes do fechamento.
       */
      if (
        fimSlot >
        fechamento
      ) {
        break;
      }

      /*
       * Não mostra horários passados.
       */
      if (
        inicioSlot <= agora
      ) {
        continue;
      }

      /*
       * Procura qualquer sobreposição.
       *
       * Exemplo:
       *
       * ocupado:
       * 14:00 até 14:40
       *
       * novo:
       * 14:30 até 15:10
       *
       * conflito = verdadeiro.
       */
      const conflita =
        ocupados.some(
          (ocupado) => {
            const inicioOcupado =
              new Date(
                ocupado.inicio
              );

            if (
              Number.isNaN(
                inicioOcupado.getTime()
              )
            ) {
              return false;
            }

            const fimOcupado =
              ocupado.fim
                ? new Date(
                    ocupado.fim
                  )
                : new Date(
                    inicioOcupado.getTime() +
                      passo *
                        60000
                  );

            if (
              Number.isNaN(
                fimOcupado.getTime()
              )
            ) {
              return false;
            }

            return (
              inicioSlot <
                fimOcupado &&
              fimSlot >
                inicioOcupado
            );
          }
        );

      if (conflita) {
        continue;
      }

      /*
       * Usa o mesmo fuso configurado
       * em formato.js.
       *
       * Não existe mais America/Sao_Paulo
       * escrito diretamente neste arquivo.
       */
      horarios.push(
        hora(
          inicioSlot.toISOString()
        )
      );
    }

    return NextResponse.json(
      {
        horarios,
        fuso:
          FUSO_NOME,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (e) {
    return respostaVazia(
      e?.message ||
        "Não foi possível consultar os horários.",
      500
    );
  }
}
