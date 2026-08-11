import { NextResponse } from "next/server";
import {
  db,
  conferirAmbiente,
} from "@/lib/db";
import {
  conferirSenha,
  criarSessao,
} from "@/lib/auth";

export const dynamic =
  "force-dynamic";

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PAPEIS_VALIDOS = [
  "admin",
  "colaborador",
  "cliente",
];

/**
 * Hash válido usado apenas quando o e-mail
 * informado não existe.
 *
 * Isso faz o servidor ainda executar bcrypt
 * em tentativas com e-mails inexistentes,
 * reduzindo diferença de tempo entre:
 *
 * - usuário inexistente
 * - senha incorreta
 *
 * O valor não é uma senha nem um segredo.
 */
const HASH_DUMMY =
  "$2a$10$BloF/fGJqSYATDKONHjzBOtYYrO9FV9PXDaLIVsNgWGZxFKsO18Bu";

function resposta(
  corpo,
  status = 200
) {
  return NextResponse.json(
    corpo,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

function limparTexto(
  valor,
  limite = 255
) {
  return String(
    valor ?? ""
  )
    .trim()
    .slice(
      0,
      limite
    );
}

/**
 * POST /api/auth/entrar
 */
export async function POST(
  req
) {
  try {
    conferirAmbiente();

    /**
     * Login só aceita JSON.
     */
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
            "Requisição inválida.",
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
            "Dados de acesso inválidos.",
        },
        400
      );
    }

    const email =
      limparTexto(
        corpo?.email,
        180
      ).toLowerCase();

    const senha =
      typeof corpo?.senha ===
      "string"
        ? corpo.senha
        : "";

    /**
     * Campos obrigatórios.
     */
    if (
      !email ||
      !senha
    ) {
      return resposta(
        {
          erro:
            "Informe e-mail e senha.",
        },
        400
      );
    }

    /**
     * Evita consultas inúteis ao banco.
     */
    if (
      !EMAIL_RE.test(
        email
      )
    ) {
      return resposta(
        {
          erro:
            "E-mail ou senha não conferem.",
        },
        401
      );
    }

    /**
     * bcrypt trabalha com no máximo 72 bytes.
     *
     * Também colocamos um limite geral
     * para evitar entradas absurdamente grandes.
     */
    const tamanhoSenha =
      new TextEncoder().encode(
        senha
      ).length;

    if (
      tamanhoSenha === 0 ||
      tamanhoSenha > 72
    ) {
      return resposta(
        {
          erro:
            "E-mail ou senha não conferem.",
        },
        401
      );
    }

    /**
     * IMPORTANTE:
     *
     * Antes:
     *
     * select("*")
     *
     * Agora buscamos somente o que o login
     * realmente precisa.
     *
     * senha_hash permanece exclusivamente
     * no servidor.
     */
    const {
      data: usuario,
      error,
    } = await db
      .from(
        "usuarios"
      )
      .select(
        [
          "id",
          "nome",
          "email",
          "papel",
          "ativo",
          "senha_hash",
        ].join(",")
      )
      .eq(
        "email",
        email
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    /**
     * Mesmo quando o usuário não existe,
     * fazemos uma comparação bcrypt.
     */
    const senhaCorreta =
      conferirSenha(
        senha,
        usuario
          ?.senha_hash ||
          HASH_DUMMY
      );

    /**
     * Usamos a mesma mensagem para:
     *
     * - e-mail inexistente;
     * - senha incorreta;
     * - usuário inativo.
     *
     * Isso evita informar a terceiros
     * se determinada conta existe.
     */
    if (
      !usuario ||
      !senhaCorreta ||
      !usuario.ativo
    ) {
      return resposta(
        {
          erro:
            "E-mail ou senha não conferem.",
        },
        401
      );
    }

    /**
     * Somente papéis conhecidos podem entrar.
     */
    if (
      !PAPEIS_VALIDOS.includes(
        usuario.papel
      )
    ) {
      console.error(
        "[auth/entrar] Papel inválido:",
        usuario.id,
        usuario.papel
      );

      return resposta(
        {
          erro:
            "Esse acesso não está disponível.",
        },
        403
      );
    }

    /**
     * Cria cookie de sessão seguro.
     */
    await criarSessao(
      usuario
    );

    /**
     * Define a área correta.
     */
    const destinos = {
      admin:
        "/painel",

      colaborador:
        "/colaborador",

      cliente:
        "/cliente",
    };

    return resposta({
      destino:
        destinos[
          usuario.papel
        ],
    });
  } catch (e) {
    console.error(
      "[auth/entrar]",
      e
    );

    return resposta(
      {
        erro:
          process.env.NODE_ENV ===
          "development"
            ? e?.message ||
              "Não foi possível entrar."
            : "Não foi possível entrar.",
      },
      500
    );
  }
}