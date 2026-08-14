export function calcularComissao({ tipo, valorConfigurado, valorReal, quantidade = 1 }) {
  const valor = Number(valorConfigurado);
  const total = Number(valorReal);
  const qtd = Number(quantidade);
  if (tipo === "percentual") return Math.round(total * valor) / 100;
  if (tipo === "fixo") return Math.round(qtd * valor * 100) / 100;
  return 0;
}

export function validarConfiguracaoComissoes(dados) {
  for (const categoria of ["servico", "produto"]) {
    const tipo = dados[`${categoria}_comissao_tipo`];
    const valor = dados[`${categoria}_comissao_valor`];
    const nome = categoria === "servico" ? "serviços" : "produtos";
    if (tipo == null && valor == null) continue;
    if (!tipo && valor != null) return `Escolha o tipo da comissão de ${nome}.`;
    if (tipo && (valor === null || valor === undefined || valor === "")) return `Informe o valor da comissão de ${nome}.`;
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero < 0) return `Valor da comissão de ${nome} inválido.`;
    if (tipo === "percentual" && numero > 100) return `A comissão percentual de ${nome} deve ficar entre 0 e 100%.`;
    if (!["percentual", "fixo"].includes(tipo)) return `Tipo da comissão de ${nome} inválido.`;
  }
  return null;
}

