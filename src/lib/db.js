import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Conexão do Supabase usada SOMENTE no servidor.
 *
 * Nunca importe este arquivo em componentes
 * que tenham "use client".
 *
 * A chave SUPABASE_SERVICE_ROLE_KEY possui
 * acesso administrativo ao banco e jamais
 * pode chegar ao navegador.
 */

const url = String(
  process.env.NEXT_PUBLIC_SUPABASE_URL || ""
).trim();

const chave = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
).trim();

/**
 * Valida uma URL HTTP/HTTPS.
 */
function urlValida(valor) {
  try {
    const endereco = new URL(valor);

    return (
      endereco.protocol === "https:" ||
      endereco.protocol === "http:"
    );
  } catch {
    return false;
  }
}

/**
 * Confere se o ambiente possui todas
 * as informações necessárias.
 *
 * Agora não usamos mais URL ou chave falsas
 * como fallback, porque isso escondia o
 * problema real de configuração.
 */
export function conferirAmbiente() {
  if (!url) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL no arquivo .env.local."
    );
  }

  if (!urlValida(url)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL possui uma URL inválida."
    );
  }

  if (!chave) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY no arquivo .env.local."
    );
  }

  if (chave.length < 20) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY parece estar inválida."
    );
  }

  return true;
}

/**
 * Falha imediatamente com uma mensagem clara
 * caso o servidor seja iniciado sem as
 * variáveis necessárias.
 */
conferirAmbiente();

/**
 * Cliente administrativo do Supabase.
 *
 * persistSession e autoRefreshToken ficam
 * desligados porque a autenticação do sistema
 * é feita por nosso próprio cookie/JWT.
 */
export const db = createClient(
  url,
  chave,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Valores usados somente caso a tabela exista,
 * mas ainda não tenha a linha única id = 1.
 */
const BARBEARIA_PADRAO = Object.freeze({
  id: 1,

  nome:
    "Navalha Barbearia",

  slogan:
    "Corte, barba e cuidado com hora marcada.",

  sobre: "",

  telefone: "",

  whatsapp: "",

  email: "",

  endereco: "",

  instagram: "",

  hora_abertura:
    "09:00",

  hora_fechamento:
    "20:00",

  dias_funcionamento:
    "Terca a sabado",

  intervalo_min: 30,
});

/**
 * Retorna as configurações da barbearia.
 *
 * Existe apenas uma linha:
 *
 * barbearia.id = 1
 */
export async function pegarBarbearia() {
  conferirAmbiente();

  const {
    data,
    error,
  } = await db
    .from("barbearia")
    .select(
      [
        "id",
        "nome",
        "slogan",
        "sobre",
        "telefone",
        "whatsapp",
        "email",
        "endereco",
        "instagram",
        "hora_abertura",
        "hora_fechamento",
        "dias_funcionamento",
        "intervalo_min",
      ].join(",")
    )
    .eq(
      "id",
      1
    )
    .maybeSingle();

  /**
   * Antes qualquer erro era silenciosamente
   * ignorado e o sistema mostrava dados padrão.
   *
   * Isso podia esconder:
   *
   * - chave errada;
   * - tabela inexistente;
   * - falha no Supabase;
   * - problema de permissão.
   *
   * Agora o erro real chega ao servidor.
   */
  if (error) {
    throw new Error(
      `Não foi possível carregar as configurações da barbearia: ${error.message}`
    );
  }

  /**
   * Tabela existe, mas a linha id=1
   * ainda não foi cadastrada.
   */
  if (!data) {
    return {
      ...BARBEARIA_PADRAO,
    };
  }

  const intervalo =
    Number(
      data.intervalo_min
    );

  return {
    ...BARBEARIA_PADRAO,
    ...data,

    intervalo_min:
      Number.isFinite(intervalo) &&
      intervalo > 0
        ? Math.floor(intervalo)
        : BARBEARIA_PADRAO.intervalo_min,
  };
}