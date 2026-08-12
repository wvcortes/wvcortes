import { montarInstante } from "./formato";

/**
 * =====================================================================
 * MAPA DE RECURSOS
 *
 * Este arquivo é o coração editável do painel administrativo.
 *
 * Cada bloco abaixo pode gerar automaticamente:
 * - tabela no painel;
 * - formulário de cadastro;
 * - edição;
 * - exclusão;
 * - integração com /api/admin/[recurso].
 *
 * Para criar um novo campo:
 * 1. adicione a coluna no Supabase;
 * 2. adicione o campo neste arquivo;
 * 3. confirme se a API precisa de alguma regra de negócio específica.
 *
 * Tipos aceitos:
 * texto
 * area
 * numero
 * dinheiro
 * inteiro
 * booleano
 * selecao
 * data
 * datahora
 * senha
 * relacao
 * =====================================================================
 */

export const RECURSOS = {
  unidades: {
    titulo: "Unidades WV Cortes",
    singular: "unidade",
    descricao: "Unidades disponíveis para equipe e agendamentos. Desative em vez de excluir unidades com histórico.",
    ordenar: { coluna: "nome", crescente: true },
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true },
      { nome: "latitude", rotulo: "Latitude", tipo: "numero", ajuda: "Use a coordenada real da unidade." },
      { nome: "longitude", rotulo: "Longitude", tipo: "numero" },
      { nome: "raio_ponto_m", rotulo: "Raio permitido para ponto (m)", tipo: "inteiro" },
      { nome: "ativo", rotulo: "Ativa", tipo: "booleano", padrao: true },
    ],
  },
  servicos: {
    titulo: "Serviços e procedimentos",
    singular: "serviço",
    descricao:
      "Tudo que a barbearia executa na cadeira: corte, barba, sobrancelha, combos.",

    ordenar: {
      coluna: "ordem",
      crescente: true,
    },

    campos: [
      {
        nome: "nome",
        rotulo: "Nome",
        tipo: "texto",
        obrigatorio: true,
      },
      {
        nome: "categoria",
        rotulo: "Categoria",
        tipo: "texto",
      },
      {
        nome: "preco",
        rotulo: "Preço",
        tipo: "dinheiro",
        obrigatorio: true,
      },
      {
        nome: "duracao_min",
        rotulo: "Duração (min)",
        tipo: "inteiro",
        padrao: 30,
        obrigatorio: true,
      },
      {
        nome: "descricao",
        rotulo: "Descrição",
        tipo: "area",
        naTabela: false,
      },
      {
        nome: "ordem",
        rotulo: "Ordem na vitrine",
        tipo: "inteiro",
        padrao: 0,
        naTabela: false,
      },
      {
        nome: "ativo",
        rotulo: "Ativo",
        tipo: "booleano",
        padrao: true,
      },
    ],
  },

  produtos: {
    titulo: "Produtos",
    singular: "produto",
    descricao:
      "Itens de revenda: pomadas, óleos, shampoos.",

    ordenar: {
      coluna: "nome",
      crescente: true,
    },

    campos: [
      { nome: "foto_url", rotulo: "URL da foto", tipo: "texto", naTabela: false },
      {
        nome: "nome",
        rotulo: "Nome",
        tipo: "texto",
        obrigatorio: true,
      },
      {
        nome: "preco",
        rotulo: "Preço de venda",
        tipo: "dinheiro",
        obrigatorio: true,
      },
      {
        nome: "custo",
        rotulo: "Custo",
        tipo: "dinheiro",
      },
      {
        nome: "estoque",
        rotulo: "Estoque",
        tipo: "inteiro",
        padrao: 0,
      },
      {
        nome: "descricao",
        rotulo: "Descrição",
        tipo: "area",
        naTabela: false,
      },
      {
        nome: "ativo",
        rotulo: "Ativo",
        tipo: "booleano",
        padrao: true,
      },
    ],
  },

  planos: {
    titulo: "Planos mensais",
    singular: "plano",
    descricao:
      "Assinaturas exibidas no site. Separe os benefícios com | (barra vertical).",

    ordenar: {
      coluna: "ordem",
      crescente: true,
    },

    campos: [
      {
        nome: "nome",
        rotulo: "Nome",
        tipo: "texto",
        obrigatorio: true,
      },
      {
        nome: "preco",
        rotulo: "Preço por mês",
        tipo: "dinheiro",
        obrigatorio: true,
      },
      {
        nome: "periodicidade",
        rotulo: "Periodicidade",
        tipo: "texto",
        padrao: "Mensal",
      },
      {
        nome: "descricao",
        rotulo: "Chamada",
        tipo: "texto",
        naTabela: false,
      },
      {
        nome: "beneficios",
        rotulo: "Benefícios (separe com |)",
        tipo: "area",
        naTabela: false,
        ajuda:
          "Ex.: 2 cortes por mês|15% off em produtos",
      },
      {
        nome: "destaque",
        rotulo: "Destacar no site",
        tipo: "booleano",
        padrao: false,
      },
      {
        nome: "ordem",
        rotulo: "Ordem",
        tipo: "inteiro",
        padrao: 0,
        naTabela: false,
      },
      {
        nome: "ativo",
        rotulo: "Ativo",
        tipo: "booleano",
        padrao: true,
      },
    ],
  },

  equipe: {
    titulo: "Equipe",
    singular: "colaborador",
    tabela: "usuarios",
    descricao:
      "Barbeiros com acesso à área de trabalho deles.",

    filtroFixo: {
      coluna: "papel",
      valor: "colaborador",
    },

    valoresFixos: {
      papel: "colaborador",
    },

    ordenar: {
      coluna: "nome",
      crescente: true,
    },

    campos: [
      {
        nome: "nome",
        rotulo: "Nome",
        tipo: "texto",
        obrigatorio: true,
      },
      {
        nome: "email",
        rotulo: "E-mail de acesso",
        tipo: "texto",
        obrigatorio: true,
      },
      {
        nome: "telefone",
        rotulo: "Telefone",
        tipo: "texto",
        obrigatorio: true,
      },
      { nome: "whatsapp_pessoal", rotulo: "WhatsApp pessoal (privado)", tipo: "texto", naTabela: false },
      { nome: "foto_url", rotulo: "URL da foto", tipo: "texto", naTabela: false },
      { nome: "unidade_id", rotulo: "Unidade", tipo: "relacao", relacao: { recurso: "unidades", rotulo: "nome" }, obrigatorio: true },
      {
        nome: "senha",
        rotulo: "Senha",
        tipo: "senha",
        naTabela: false,
        obrigatorioAoCriar: true,
        ajuda:
          "Ao editar, deixe em branco para manter a senha atual.",
      },
      {
        nome: "especialidade",
        rotulo: "Especialidade",
        tipo: "texto",
      },
      {
        nome: "comissao_servicos",
        rotulo: "Comissão (%)",
        tipo: "numero",
        padrao: 40,
      },
      {
        nome: "comissao_produtos",
        rotulo: "Comissão sobre produtos (%)",
        tipo: "numero",
        padrao: 0,
      },
      {
        nome: "ativo",
        rotulo: "Ativo",
        tipo: "booleano",
        padrao: true,
      },
    ],
  },

  clientes: {
    titulo: "Clientes",
    singular: "cliente",
    tabela: "usuarios",
    descricao:
      "Cadastro completo de quem passa pela cadeira.",

    filtroFixo: {
      coluna: "papel",
      valor: "cliente",
    },

    valoresFixos: {
      papel: "cliente",
    },

    ordenar: {
      coluna: "criado_em",
      crescente: false,
    },

    campos: [
      {
        nome: "nome",
        rotulo: "Nome",
        tipo: "texto",
        obrigatorio: true,
      },
      {
        nome: "telefone",
        rotulo: "Telefone",
        tipo: "texto",
        obrigatorio: true,
      },
      {
        nome: "email",
        rotulo: "E-mail",
        tipo: "texto",
        obrigatorio: true,
      },
      {
        nome: "cpf",
        rotulo: "CPF",
        tipo: "texto",
      },
      {
        nome: "nascimento",
        rotulo: "Nascimento",
        tipo: "data",
      },
      {
        nome: "senha",
        rotulo: "Senha",
        tipo: "senha",
        naTabela: false,
        obrigatorioAoCriar: true,
        ajuda:
          "Ao editar, deixe em branco para manter a senha atual.",
      },
      {
        nome: "observacoes",
        rotulo: "Observações",
        tipo: "area",
        naTabela: false,
      },
      {
        nome: "ativo",
        rotulo: "Ativo",
        tipo: "booleano",
        padrao: true,
      },
    ],
  },

  assinaturas: {
    titulo: "Assinaturas",
    singular: "assinatura",
    descricao:
      "Quem está em qual plano e quando cobra de novo.",

    ordenar: {
      coluna: "criado_em",
      crescente: false,
    },

    campos: [
      {
        nome: "cliente_id",
        rotulo: "Cliente",
        tipo: "relacao",
        relacao: {
          recurso: "clientes",
          rotulo: "nome",
        },
        obrigatorio: true,
      },
      {
        nome: "plano_id",
        rotulo: "Plano",
        tipo: "relacao",
        relacao: {
          recurso: "planos",
          rotulo: "nome",
        },
        obrigatorio: true,
      },
      {
        nome: "valor",
        rotulo: "Valor",
        tipo: "dinheiro",
      },
      {
        nome: "status",
        rotulo: "Situação",
        tipo: "selecao",
        opcoes: [
          "ativa",
          "pendente",
          "cancelada",
        ],
        padrao: "ativa",
      },
      {
        nome: "inicio",
        rotulo: "Início",
        tipo: "data",
      },
      {
        nome: "proxima_cobranca",
        rotulo: "Próxima cobrança",
        tipo: "data",
      },
    ],
  },

  agendamentos: {
    titulo: "Agenda",
    singular: "agendamento",
    descricao:
      "Crie, edite e acompanhe os horários da barbearia. O fim e o valor são calculados automaticamente pelo serviço escolhido.",

    ordenar: {
      coluna: "inicio",
      crescente: false,
    },

    campos: [
      { nome: "unidade_id", rotulo: "Unidade", tipo: "relacao", relacao: { recurso: "unidades", rotulo: "nome" }, obrigatorio: true },
      {
        nome: "nome_cliente",
        rotulo: "Cliente",
        tipo: "texto",
        obrigatorio: true,
      },
      {
        nome: "telefone_cliente",
        rotulo: "Telefone",
        tipo: "texto",
        obrigatorio: true,
      },
      {
        nome: "email_cliente",
        rotulo: "E-mail",
        tipo: "texto",
        naTabela: false,
      },
      {
        nome: "profissional_id",
        rotulo: "Profissional",
        tipo: "relacao",
        relacao: {
          recurso: "equipe",
          rotulo: "nome",
        },
        obrigatorio: true,
      },
      {
        nome: "servico_id",
        rotulo: "Serviço",
        tipo: "relacao",
        relacao: {
          recurso: "servicos",
          rotulo: "nome",
        },
        obrigatorio: true,
      },
      {
        nome: "inicio",
        rotulo: "Data e horário",
        tipo: "datahora",
        obrigatorio: true,
        ajuda:
          "Escolha o início do atendimento. O término é calculado automaticamente pela duração do serviço.",
      },
      {
        nome: "fim",
        rotulo: "Término",
        tipo: "datahora",
        somenteLeitura: true,
        ajuda:
          "Calculado automaticamente pela duração do serviço.",
      },
      {
        nome: "preco",
        rotulo: "Valor",
        tipo: "dinheiro",
        somenteLeitura: true,
        ajuda:
          "Usa automaticamente o preço cadastrado no serviço.",
      },
      {
        nome: "status",
        rotulo: "Situação",
        tipo: "selecao",
        opcoes: [
          "agendado",
          "confirmado",
          "concluido",
          "cancelado",
        ],
        padrao: "agendado",
      },
      {
        nome: "observacoes",
        rotulo: "Observações",
        tipo: "area",
        naTabela: false,
      },
    ],
  },

  vendas: {
    titulo: "Vendas",
    singular: "venda",
    descricao:
      "Lançamentos do dia por colaborador.",

    ordenar: {
      coluna: "criado_em",
      crescente: false,
    },

    campos: [
      {
        nome: "colaborador_id",
        rotulo: "Colaborador",
        tipo: "relacao",
        relacao: {
          recurso: "equipe",
          rotulo: "nome",
        },
        obrigatorio: true,
      },
      {
        nome: "descricao",
        rotulo: "Descrição",
        tipo: "texto",
        obrigatorio: true,
      },
      {
        nome: "tipo",
        rotulo: "Tipo",
        tipo: "selecao",
        opcoes: [
          "servico",
          "produto",
        ],
        padrao: "servico",
      },
      {
        nome: "quantidade",
        rotulo: "Qtd.",
        tipo: "inteiro",
        padrao: 1,
      },
      {
        nome: "valor",
        rotulo: "Valor",
        tipo: "dinheiro",
        obrigatorio: true,
      },
      {
        nome: "forma_pagamento",
        rotulo: "Pagamento",
        tipo: "selecao",
        opcoes: [
          "Dinheiro",
          "Pix",
          "Débito",
          "Crédito",
        ],
        padrao: "Dinheiro",
      },
      {
        nome: "criado_em",
        rotulo: "Data",
        tipo: "datahora",
        naTabela: true,
        somenteLeitura: true,
      },
    ],
  },
};

/**
 * Retorna a configuração de um recurso.
 */
export function pegarRecurso(chave) {
  return RECURSOS[chave] || null;
}

/**
 * Alguns recursos usam uma tabela diferente
 * do nome mostrado no painel.
 *
 * Exemplo:
 *
 * equipe   -> usuarios
 * clientes -> usuarios
 */
export function tabelaDe(chave) {
  const recurso = RECURSOS[chave];

  return recurso?.tabela || chave;
}

/**
 * Converte número vindo de formulário.
 *
 * Aceita:
 * 55
 * "55"
 * "55,90"
 * "55.90"
 */
function converterNumero(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero = Number(
    String(valor)
      .trim()
      .replace(",", ".")
  );

  return Number.isFinite(numero)
    ? numero
    : null;
}

/**
 * Converte inteiro.
 */
function converterInteiro(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return null;
  }

  return Math.trunc(numero);
}

/**
 * Converte datetime-local para um instante correto
 * no fuso da barbearia.
 *
 * Isso é importante principalmente na Vercel.
 *
 * O navegador envia algo como:
 *
 * 2026-08-11T14:30
 *
 * Não podemos simplesmente fazer:
 *
 * new Date(valor)
 *
 * porque o servidor pode estar em UTC.
 */
function converterDataHora(valor) {
  if (!valor) {
    return null;
  }

  const texto = String(valor).trim();

  /*
   * Valor vindo de <input type="datetime-local">
   */
  const local =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(
      texto
    );

  if (local) {
    const data = local[1];
    const horario = local[2];

    const instante =
      montarInstante(
        data,
        horario
      );

    if (
      Number.isNaN(
        instante.getTime()
      )
    ) {
      return null;
    }

    return instante.toISOString();
  }

  /*
   * Se já vier como ISO completo com timezone,
   * podemos interpretar diretamente.
   *
   * Exemplos:
   * 2026-08-11T18:30:00.000Z
   * 2026-08-11T14:30:00-04:00
   */
  const instante =
    new Date(texto);

  if (
    Number.isNaN(
      instante.getTime()
    )
  ) {
    return null;
  }

  return instante.toISOString();
}

/**
 * Normaliza data simples.
 *
 * Mantemos YYYY-MM-DD porque colunas do tipo
 * date do PostgreSQL não precisam de timezone.
 */
function converterData(valor) {
  if (!valor) {
    return null;
  }

  const texto =
    String(valor)
      .trim()
      .slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      texto
    )
  ) {
    return null;
  }

  const [
    ano,
    mes,
    dia,
  ] = texto
    .split("-")
    .map(Number);

  const teste =
    new Date(
      Date.UTC(
        ano,
        mes - 1,
        dia
      )
    );

  if (
    teste.getUTCFullYear() !==
      ano ||
    teste.getUTCMonth() !==
      mes - 1 ||
    teste.getUTCDate() !==
      dia
  ) {
    return null;
  }

  return texto;
}

/**
 * Converte os valores enviados pelos
 * formulários para os tipos usados no banco.
 */
export function normalizar(
  campo,
  valor
) {
  /*
   * Campo vazio.
   */
  if (
    valor === "" ||
    valor === undefined ||
    valor === null
  ) {
    return campo.tipo ===
      "booleano"
      ? false
      : null;
  }

  switch (campo.tipo) {
    case "dinheiro":
    case "numero":
      return converterNumero(
        valor
      );

    case "inteiro":
      return converterInteiro(
        valor
      );

    case "booleano":
      return (
        valor === true ||
        valor === "true" ||
        valor === "on" ||
        valor === 1 ||
        valor === "1"
      );

    case "datahora":
      return converterDataHora(
        valor
      );

    case "data":
      return converterData(
        valor
      );

    case "texto":
    case "area":
    case "selecao":
    case "relacao":
      return String(
        valor
      ).trim();

    default:
      return valor;
  }
}
