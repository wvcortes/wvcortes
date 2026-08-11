import { NextResponse } from "next/server";
import {
  db,
  conferirAmbiente,
} from "@/lib/db";
import {
  gerarHash,
  criarSessao,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATA_RE =
  /^\d{4}-\d{2}-\d{2}$/;

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

function texto(
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

function dataValida(
  valor
) {
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

  const teste =
    new Date(
      Date.UTC(
        ano,
        mes - 1,
        dia
      )
    );

  return (
    teste.getUTCFullYear() ===
      ano &&
    teste.getUTCMonth() ===
      mes - 1 &&
    teste.getUTCDate() ===
      dia
  );
}

/**
 * POST /api/auth/cadastro
 *
 * Cadastro público de cliente.
 *
 * Nome, telefone, e-mail e senha
 * são obrigatórios.
 *
 * Se vier plano_id válido,
 * cria também uma assinatura pendente.
 */
export async function POST(
  req
) {
  let usuarioCriadoId =
    null;

  try {
    conferirAmbiente();

    /**
     * Aceitamos somente JSON.
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
            "Dados de cadastro inválidos.",
        },
        400
      );
    }

    /**
     * Limpeza dos campos.
     */
    const nome =
      texto(
        corpo?.nome,
        120
      );

    const telefone =
      texto(
        corpo?.telefone,
        30
      );

    const email =
      texto(
        corpo?.email,
        180
      ).toLowerCase();

    const senha =
      typeof corpo?.senha ===
      "string"
        ? corpo.senha
        : "";

    const cpf =
      texto(
        corpo?.cpf,
        20
      ) || null;

    const nascimento =
      texto(
        corpo?.nascimento,
        10
      ) || null;

    const planoId =
      texto(
        corpo?.plano_id,
        50
      ) || null;

    /**
     * Campos obrigatórios.
     */
    const faltando = [];

    if (!nome) {
      faltando.push(
        "nome"
      );
    }

    if (!telefone) {
      faltando.push(
        "telefone"
      );
    }

    if (!email) {
      faltando.push(
        "email"
      );
    }

    if (!senha) {
      faltando.push(
        "senha"
      );
    }

    if (
      faltando.length >
      0
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

    /**
     * Nome mínimo.
     */
    if (
      nome.length < 2
    ) {
      return resposta(
        {
          erro:
            "Informe um nome válido.",
        },
        400
      );
    }

    /**
     * Telefone mínimo.
     */
    if (
      telefone.length < 8
    ) {
      return resposta(
        {
          erro:
            "Informe um telefone válido.",
        },
        400
      );
    }

    /**
     * E-mail.
     */
    if (
      !EMAIL_RE.test(
        email
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

    /**
     * Senha.
     *
     * O bcrypt usa no máximo 72 bytes.
     */
    const senhaBytes =
      new TextEncoder().encode(
        senha
      ).length;

    if (
      senha.length < 6
    ) {
      return resposta(
        {
          erro:
            "A senha precisa ter 6 caracteres ou mais.",
        },
        400
      );
    }

    if (
      senhaBytes > 72
    ) {
      return resposta(
        {
          erro:
            "A senha é muito longa.",
        },
        400
      );
    }

    /**
     * Nascimento opcional.
     */
    if (
      nascimento &&
      !dataValida(
        nascimento
      )
    ) {
      return resposta(
        {
          erro:
            "Informe uma data de nascimento válida.",
        },
        400
      );
    }

    /**
     * Plano opcional.
     *
     * Se houver plano_id, validamos ANTES
     * de criar o usuário.
     */
    let plano = null;

    if (planoId) {
      if (
        !UUID_RE.test(
          planoId
        )
      ) {
        return resposta(
          {
            erro:
              "Plano inválido.",
          },
          400
        );
      }

      const {
        data,
        error,
      } = await db
        .from(
          "planos"
        )
        .select(
          "id, nome, preco, ativo"
        )
        .eq(
          "id",
          planoId
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (
        !data ||
        !data.ativo
      ) {
        return resposta(
          {
            erro:
              "Esse plano não está disponível.",
          },
          400
        );
      }

      plano = data;
    }

    /**
     * Verifica previamente se o e-mail
     * já existe.
     *
     * A coluna também possui UNIQUE
     * no PostgreSQL, então existe uma
     * segunda proteção no próprio banco.
     */
    const {
      data: existente,
      error: erroBusca,
    } = await db
      .from(
        "usuarios"
      )
      .select("id")
      .eq(
        "email",
        email
      )
      .maybeSingle();

    if (erroBusca) {
      throw erroBusca;
    }

    if (existente) {
      return resposta(
        {
          erro:
            "Esse e-mail já tem cadastro. Entre com ele.",
        },
        409
      );
    }

    /**
     * Gera o hash somente no servidor.
     */
    const senhaHash =
      gerarHash(
        senha
      );

    /**
     * Cria exclusivamente um CLIENTE.
     *
     * Não utilizamos papel vindo do navegador.
     */
    const {
      data: usuario,
      error: erroUsuario,
    } = await db
      .from(
        "usuarios"
      )
      .insert({
        nome,
        email,
        telefone,

        cpf,

        nascimento,

        senha_hash:
          senhaHash,

        papel:
          "cliente",

        ativo:
          true,
      })
      .select(
        "id"
      )
      .single();

    if (erroUsuario) {
      /**
       * Proteção contra duas requisições
       * tentando cadastrar o mesmo e-mail
       * praticamente ao mesmo tempo.
       */
      if (
        erroUsuario.code ===
        "23505"
      ) {
        return resposta(
          {
            erro:
              "Esse e-mail já tem cadastro. Entre com ele.",
          },
          409
        );
      }

      throw erroUsuario;
    }

    usuarioCriadoId =
      usuario.id;

    /**
     * Se o cadastro foi iniciado a partir
     * de um plano, cria a assinatura.
     *
     * O valor NÃO vem do navegador.
     * Ele vem do plano salvo no banco.
     */
    if (plano) {
      const {
        error:
          erroAssinatura,
      } = await db
        .from(
          "assinaturas"
        )
        .insert({
          cliente_id:
            usuario.id,

          plano_id:
            plano.id,

          valor:
            Number(
              plano.preco ||
                0
            ),

          status:
            "pendente",
        });

      if (
        erroAssinatura
      ) {
        /**
         * Evita deixar um cadastro incompleto:
         *
         * usuário criado
         * +
         * assinatura falhou
         *
         * Como esse usuário acabou de ser criado
         * nesta própria requisição e ainda não
         * possui sessão, removemos o registro.
         */
        const {
          error:
            erroLimpeza,
        } = await db
          .from(
            "usuarios"
          )
          .delete()
          .eq(
            "id",
            usuario.id
          );

        usuarioCriadoId =
          null;

        if (
          erroLimpeza
        ) {
          console.error(
            "[auth/cadastro] Falha ao remover cadastro incompleto:",
            erroLimpeza.message
          );
        }

        throw erroAssinatura;
      }
    }

    /**
     * Cria a sessão somente depois que
     * todo o cadastro terminou corretamente.
     */
    await criarSessao({
      id:
        usuario.id,
    });

    return resposta(
      {
        destino:
          "/cliente",
      },
      201
    );
  } catch (e) {
    /**
     * Segurança extra caso alguma exceção
     * inesperada aconteça depois da criação
     * do usuário e antes da sessão.
     */
    if (
      usuarioCriadoId
    ) {
      try {
        await db
          .from(
            "usuarios"
          )
          .delete()
          .eq(
            "id",
            usuarioCriadoId
          );
      } catch {
        // Não substitui o erro original.
      }
    }

    console.error(
      "[auth/cadastro]",
      e
    );

    return resposta(
      {
        erro:
          process.env.NODE_ENV ===
          "development"
            ? e?.message ||
              "Não foi possível concluir o cadastro."
            : "Não foi possível concluir o cadastro.",
      },
      500
    );
  }
}