import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const NOME_COOKIE = "navalha_sessao";

const EMISSOR = "navalha-barbearia";
const AUDIENCIA = "navalha-web";
const VERSAO_SESSAO = 1;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Retorna o segredo usado para validar
 * o JWT da sessão.
 *
 * Precisa ser exatamente o mesmo AUTH_SECRET
 * usado em src/lib/auth.js.
 */
function segredo() {
  const valor = process.env.AUTH_SECRET;

  if (!valor) {
    throw new Error(
      "AUTH_SECRET não configurado."
    );
  }

  const bytes =
    new TextEncoder().encode(valor);

  if (bytes.length < 32) {
    throw new Error(
      "AUTH_SECRET inválido."
    );
  }

  return bytes;
}

/**
 * Remove o cookie inválido e manda
 * o usuário de volta para o login.
 */
function redirecionarParaLogin(req) {
  const url = req.nextUrl.clone();

  url.pathname = "/entrar";
  url.search = "";

  const resposta =
    NextResponse.redirect(url);

  resposta.cookies.set(
    NOME_COOKIE,
    "",
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    }
  );

  return resposta;
}

/**
 * Middleware das áreas protegidas.
 *
 * IMPORTANTE:
 *
 * O middleware confirma que o cookie/JWT
 * é válido.
 *
 * A autorização definitiva de papel:
 *
 * admin
 * colaborador
 * cliente
 *
 * deve continuar sendo feita pelo servidor,
 * consultando o usuário atual no banco.
 */
export async function middleware(req) {
  const token =
    req.cookies.get(
      NOME_COOKIE
    )?.value;

  if (!token) {
    return redirecionarParaLogin(
      req
    );
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

    /**
     * Confere se o usuário do token
     * possui um ID válido.
     */
    if (!UUID_RE.test(id)) {
      return redirecionarParaLogin(
        req
      );
    }

    /**
     * Permite invalidar sessões antigas
     * quando alterarmos o formato do token.
     */
    if (
      payload.ver !==
      VERSAO_SESSAO
    ) {
      return redirecionarParaLogin(
        req
      );
    }

    return NextResponse.next();
  } catch {
    return redirecionarParaLogin(
      req
    );
  }
}

export const config = {
  matcher: [
    "/painel/:path*",
    "/colaborador/:path*",
    "/cliente/:path*",
  ],
};