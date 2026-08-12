import { cookies } from "next/headers";
import {
  SignJWT,
  jwtVerify,
} from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";

const NOME_COOKIE =
  "navalha_sessao";

const DIAS = 7;

const EMISSOR =
  "navalha-barbearia";

const AUDIENCIA =
  "navalha-web";

const VERSAO_SESSAO = 1;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let segredoCache = null;

/**
 * Retorna o AUTH_SECRET usado para
 * assinar e validar as sessões.
 *
 * Exigimos pelo menos 32 bytes.
 */
function segredo() {
  if (segredoCache) {
    return segredoCache;
  }

  const valor =
    process.env.AUTH_SECRET;

  if (!valor) {
    throw new Error(
      "Defina AUTH_SECRET no .env.local"
    );
  }

  const bytes =
    new TextEncoder().encode(
      valor
    );

  if (bytes.length < 32) {
    throw new Error(
      "AUTH_SECRET precisa ter pelo menos 32 caracteres aleatórios."
    );
  }

  segredoCache = bytes;

  return segredoCache;
}

/**
 * Configuração padrão do cookie.
 */
function opcoesCookie() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV ===
      "production",
    path: "/",
  };
}

/**
 * Valida uma senha antes de gerar hash.
 *
 * bcrypt considera no máximo 72 bytes.
 * Bloqueamos senhas maiores para evitar
 * duas senhas diferentes produzindo efeito
 * equivalente após o limite do bcrypt.
 */
function validarSenhaParaHash(
  senha
) {
  if (
    typeof senha !== "string"
  ) {
    throw new Error(
      "Senha inválida."
    );
  }

  if (senha.length < 6) {
    throw new Error(
      "A senha precisa ter pelo menos 6 caracteres."
    );
  }

  const tamanho =
    new TextEncoder().encode(
      senha
    ).length;

  if (tamanho > 72) {
    throw new Error(
      "A senha é muito longa. Use no máximo 72 bytes."
    );
  }

  return senha;
}

/**
 * Gera o hash de uma senha.
 *
 * Nunca salve a senha original no banco.
 */
export function gerarHash(
  senha
) {
  const senhaValida =
    validarSenhaParaHash(
      senha
    );

  return bcrypt.hashSync(
    senhaValida,
    10
  );
}

/**
 * Confere uma senha com o hash salvo.
 *
 * Em caso de valor inválido ou hash
 * corrompido, retorna false.
 */
export function conferirSenha(
  senha,
  hash
) {
  if (
    typeof senha !== "string" ||
    typeof hash !== "string" ||
    !hash
  ) {
    return false;
  }

  const tamanho =
    new TextEncoder().encode(
      senha
    ).length;

  if (
    tamanho === 0 ||
    tamanho > 72
  ) {
    return false;
  }

  try {
    return bcrypt.compareSync(
      senha,
      hash
    );
  } catch {
    return false;
  }
}

/**
 * Cria a sessão do usuário.
 *
 * O papel não é usado como fonte de
 * autorização definitiva.
 *
 * Sempre que precisamos autorizar algo,
 * usuarioAtual() consulta novamente
 * o usuário no banco.
 */
export async function criarSessao(
  usuario
) {
  if (
    !usuario ||
    !UUID_RE.test(
      String(
        usuario.id || ""
      )
    )
  ) {
    throw new Error(
      "Usuário inválido para criação da sessão."
    );
  }

  const id =
    String(usuario.id);

  const token =
    await new SignJWT({
      id,
      ver:
        VERSAO_SESSAO,
    })
      .setProtectedHeader({
        alg: "HS256",
        typ: "JWT",
      })
      .setSubject(id)
      .setIssuer(
        EMISSOR
      )
      .setAudience(
        AUDIENCIA
      )
      .setIssuedAt()
      .setExpirationTime(
        `${DIAS}d`
      )
      .sign(
        segredo()
      );

  const cookieStore = await cookies();
  cookieStore.set(
    NOME_COOKIE,
    token,
    {
      ...opcoesCookie(),

      maxAge:
        60 *
        60 *
        24 *
        DIAS,
    }
  );
}

/**
 * Remove a sessão atual.
 */
export async function encerrarSessao() {
  const cookieStore = await cookies();
  cookieStore.set(
    NOME_COOKIE,
    "",
    {
      ...opcoesCookie(),
      maxAge: 0,
      expires:
        new Date(0),
    }
  );
}

/**
 * Lê e valida uma sessão.
 *
 * Pode receber um token externo para
 * testes internos, mas normalmente
 * utiliza o cookie da requisição.
 */
export async function lerSessao(
  tokenExterno
) {
  const cookieStore = tokenExterno === undefined ? await cookies() : null;
  const token = tokenExterno ?? cookieStore?.get(NOME_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const {
      payload,
    } = await jwtVerify(
      token,
      segredo(),
      {
        algorithms: [
          "HS256",
        ],

        issuer:
          EMISSOR,

        audience:
          AUDIENCIA,
      }
    );

    const id =
      String(
        payload.sub ||
          payload.id ||
          ""
      );

    if (
      !UUID_RE.test(id)
    ) {
      return null;
    }

    if (
      payload.ver !==
      VERSAO_SESSAO
    ) {
      return null;
    }

    return {
      ...payload,
      id,
    };
  } catch {
    return null;
  }
}

/**
 * Retorna o usuário completo do banco
 * ou null quando não existe uma sessão
 * válida.
 *
 * O papel e o status ativo sempre vêm
 * novamente do banco.
 *
 * Isso significa que, se um usuário for
 * desativado ou tiver o papel alterado,
 * ele perde a permissão mesmo que ainda
 * tenha um cookie antigo.
 */
export async function usuarioAtual() {
  const sessao =
    await lerSessao();

  if (!sessao) {
    return null;
  }

  const {
    data,
    error,
  } = await db
    .from("usuarios")
    .select(
      [
        "id",
        "nome",
        "email",
        "telefone",
        "papel",
        "ativo",
        "excluido_em",
        "especialidade",
        "comissao",
        "comissao_servicos",
        "comissao_produtos",
        "unidade_id",
      ].join(",")
    )
    .eq(
      "id",
      sessao.id
    )
    .maybeSingle();

  if (error) {
    console.error(
      "[auth] Não foi possível consultar o usuário:",
      error.message
    );

    return null;
  }

  if (
    !data ||
    !data.ativo ||
    data.excluido_em
  ) {
    return null;
  }

  return data;
}

/**
 * Exige um dos papéis informados.
 *
 * Exemplo:
 *
 * await exigirPapel(["admin"])
 *
 * ou
 *
 * await exigirPapel([
 *   "admin",
 *   "colaborador"
 * ])
 */
export async function exigirPapel(
  papeis
) {
  if (
    !Array.isArray(
      papeis
    ) ||
    papeis.length === 0
  ) {
    return null;
  }

  const usuario =
    await usuarioAtual();

  if (!usuario) {
    return null;
  }

  return papeis.includes(
    usuario.papel
  )
    ? usuario
    : null;
}

export const COOKIE_SESSAO =
  NOME_COOKIE;
