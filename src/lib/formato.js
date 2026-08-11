/**
 * Fuso horário usado pela barbearia.
 *
 * Campo Grande/MS:
 * America/Campo_Grande
 * UTC-04:00
 *
 * FUSO_NOME é usado pelo Intl para exibição.
 * FUSO é usado ao transformar data + horário local
 * em um instante UTC para salvar no banco.
 */
export const FUSO = "-04:00";
export const FUSO_NOME = "America/Campo_Grande";

/**
 * Formata valores em Real brasileiro.
 */
export const dinheiro = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/**
 * Exibe somente a hora no fuso da barbearia.
 *
 * Exemplo:
 * 2026-08-11T18:00:00.000Z
 * vira 14:00 em Campo Grande.
 */
export const hora = (iso) => {
  if (!iso) return "";

  const data = new Date(iso);

  if (Number.isNaN(data.getTime())) {
    return "";
  }

  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: FUSO_NOME,
  });
};

/**
 * Exibe data e hora.
 *
 * Exemplo:
 * 11/08, 14:00
 */
export const dataHora = (iso) => {
  if (!iso) return "";

  const data = new Date(iso);

  if (Number.isNaN(data.getTime())) {
    return "";
  }

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: FUSO_NOME,
  });
};

/**
 * Exibe somente a data.
 *
 * Exemplo:
 * 11/08/2026
 */
export const dataCurta = (iso) => {
  if (!iso) return "";

  const data = new Date(iso);

  if (Number.isNaN(data.getTime())) {
    return "";
  }

  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: FUSO_NOME,
  });
};

/**
 * Retorna o dia atual da barbearia
 * no formato usado pelos inputs HTML.
 *
 * Exemplo:
 * 2026-08-11
 */
export const diaLocal = (data = new Date()) => {
  const valor =
    data instanceof Date
      ? data
      : new Date(data);

  if (Number.isNaN(valor.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: FUSO_NOME,
  }).format(valor);
};

/**
 * Valida uma data no formato YYYY-MM-DD.
 */
function dataValida(data) {
  if (
    typeof data !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data)
  ) {
    return false;
  }

  const [ano, mes, dia] = data
    .split("-")
    .map(Number);

  const teste = new Date(
    Date.UTC(ano, mes - 1, dia)
  );

  return (
    teste.getUTCFullYear() === ano &&
    teste.getUTCMonth() === mes - 1 &&
    teste.getUTCDate() === dia
  );
}

/**
 * Valida horário HH:mm.
 */
function horarioValido(horario) {
  return (
    typeof horario === "string" &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
      horario
    )
  );
}

/**
 * Junta:
 *
 * data:    2026-08-11
 * horario: 14:30
 *
 * considerando o horário local da barbearia.
 *
 * O Date retornado representa um instante real
 * e pode ser convertido para ISO antes de salvar
 * no Supabase.
 */
export const montarInstante = (
  data,
  horario
) => {
  if (
    !dataValida(data) ||
    !horarioValido(horario)
  ) {
    return new Date(NaN);
  }

  return new Date(
    `${data}T${horario}:00${FUSO}`
  );
};

/**
 * Retorna os limites de um dia inteiro
 * no fuso da barbearia.
 *
 * Usado nas consultas do Supabase.
 *
 * Exemplo:
 *
 * limitesDoDia("2026-08-11")
 *
 * {
 *   de: "...",
 *   ate: "..."
 * }
 */
export const limitesDoDia = (data) => {
  if (!dataValida(data)) {
    return {
      de: null,
      ate: null,
    };
  }

  const inicio = new Date(
    `${data}T00:00:00.000${FUSO}`
  );

  const fim = new Date(
    `${data}T23:59:59.999${FUSO}`
  );

  return {
    de: inicio.toISOString(),
    ate: fim.toISOString(),
  };
};