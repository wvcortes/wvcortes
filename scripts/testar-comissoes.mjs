import assert from "node:assert/strict";
import { calcularComissao } from "../src/lib/comissoes.js";

assert.equal(calcularComissao({ tipo: "percentual", valorConfigurado: 40, valorReal: 50 }), 20);
assert.equal(calcularComissao({ tipo: "fixo", valorConfigurado: 20, valorReal: 50 }), 20);
assert.equal(calcularComissao({ tipo: "fixo", valorConfigurado: 20, valorReal: 100, quantidade: 2 }), 40);
assert.equal(calcularComissao({ tipo: "percentual", valorConfigurado: 40, valorReal: 180 }), 72);
assert.equal(calcularComissao({ tipo: "percentual", valorConfigurado: 10, valorReal: 50 }), 5);
assert.equal(calcularComissao({ tipo: "percentual", valorConfigurado: 10, valorReal: 150, quantidade: 3 }), 15);
assert.equal(calcularComissao({ tipo: "fixo", valorConfigurado: 10, valorReal: 50 }), 10);
assert.equal(calcularComissao({ tipo: "fixo", valorConfigurado: 10, valorReal: 150, quantidade: 3 }), 30);

// Vendas isoladas (atendimento_id = null): percentual considera valor unitário
// vezes quantidade; fixo multiplica diretamente a quantidade.
const vendasIsoladas = [
  { atendimento_id: null, categoria: "produto", tipo: "fixo", valorConfigurado: 10, valorUnitario: 50, quantidade: 1, esperado: 10 },
  { atendimento_id: null, categoria: "produto", tipo: "fixo", valorConfigurado: 10, valorUnitario: 50, quantidade: 3, esperado: 30 },
  { atendimento_id: null, categoria: "produto", tipo: "percentual", valorConfigurado: 10, valorUnitario: 50, quantidade: 1, esperado: 5 },
  { atendimento_id: null, categoria: "produto", tipo: "percentual", valorConfigurado: 10, valorUnitario: 50, quantidade: 3, esperado: 15 },
  { atendimento_id: null, categoria: "servico", tipo: "percentual", valorConfigurado: 40, valorUnitario: 50, quantidade: 1, esperado: 20 },
  { atendimento_id: null, categoria: "servico", tipo: "fixo", valorConfigurado: 20, valorUnitario: 50, quantidade: 2, esperado: 40 },
];
for (const venda of vendasIsoladas) {
  assert.equal(venda.atendimento_id, null);
  assert.equal(
    calcularComissao({
      tipo: venda.tipo,
      valorConfigurado: venda.valorConfigurado,
      valorReal: venda.valorUnitario * venda.quantidade,
      quantidade: venda.quantidade,
    }),
    venda.esperado,
    `venda isolada de ${venda.categoria} (${venda.tipo})`,
  );
}
const snapshot = { servicos: calcularComissao({ tipo: "percentual", valorConfigurado: 40, valorReal: 50 }), produtos: calcularComissao({ tipo: "fixo", valorConfigurado: 10, valorReal: 150, quantidade: 3 }) };
assert.equal(snapshot.servicos + snapshot.produtos, 50);
calcularComissao({ tipo: "percentual", valorConfigurado: 15, valorReal: 150 });
assert.deepEqual(snapshot, { servicos: 20, produtos: 30 });
console.log("Testes de comissão: 16 cenários aprovados, incluindo vendas isoladas sem atendimento_id.");
