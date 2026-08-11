import { gerarHash } from "./auth";
import { normalizar } from "./recursos";

/**
 * Monta o objeto que será enviado ao banco
 * a partir dos dados dos formulários do painel.
 *
 * Regras importantes:
 *
 * - campos somenteLeitura nunca são enviados;
 * - somente campos definidos em recursos.js são aceitos;
 * - senha nunca é enviada diretamente ao banco;
 * - senha vazia durante edição mantém a senha atual;
 * - valoresFixos do recurso sempre prevalecem.
 */
export function montarPayload(config, corpo = {}) {
  const dados = {};

  if (
    !config ||
    !Array.isArray(config.campos) ||
    !corpo ||
    typeof corpo !== "object"
  ) {
    return {
      ...(config?.valoresFixos || {}),
    };
  }

  for (const campo of config.campos) {
    /**
     * Campos calculados ou gerados pelo banco
     * não devem vir do formulário.
     */
    if (campo.somenteLeitura) {
      continue;
    }

    /**
     * Ignora campos que nem foram enviados.
     *
     * Isso é importante principalmente em edição,
     * porque evita sobrescrever dados sem necessidade.
     */
    if (
      !Object.prototype.hasOwnProperty.call(
        corpo,
        campo.nome
      )
    ) {
      continue;
    }

    const valor = corpo[campo.nome];

    /**
     * Senhas recebem tratamento especial.
     *
     * O formulário utiliza o campo virtual:
     *
     * senha
     *
     * mas no banco existe:
     *
     * senha_hash
     *
     * Se a senha vier vazia durante uma edição,
     * simplesmente não alteramos senha_hash.
     */
    if (campo.tipo === "senha") {
      if (
        valor === null ||
        valor === undefined ||
        String(valor) === ""
      ) {
        continue;
      }

      dados.senha_hash = gerarHash(
        String(valor)
      );

      continue;
    }

    /**
     * Todos os demais campos passam pelo
     * normalizador definido em recursos.js.
     *
     * Exemplos:
     *
     * dinheiro -> Number
     * inteiro  -> inteiro
     * booleano -> true/false
     * datahora -> ISO no fuso da barbearia
     */
    dados[campo.nome] = normalizar(
      campo,
      valor
    );
  }

  /**
   * valoresFixos vêm por último propositalmente.
   *
   * Assim ninguém consegue, por exemplo,
   * criar um cliente enviando:
   *
   * papel: "admin"
   *
   * porque o recurso "clientes" força:
   *
   * papel: "cliente"
   */
  return {
    ...dados,
    ...(config.valoresFixos || {}),
  };
}