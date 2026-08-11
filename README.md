# Navalha · SaaS para barbearia

Sistema completo em **Next.js (Node.js)** com site público, painel do dono,
área do colaborador e área do cliente. Feito para rodar na **Vercel** com banco
**Supabase (PostgreSQL)**.

## O que já vem pronto

**Site público**
- Home com a tabela de preços da casa, planos e equipe
- Página de serviços (puxa direto do banco)
- Página de planos mensais
- Agendamento online com horários livres calculados em tempo real
- Cadastro do cliente (nome, telefone e e-mail obrigatórios) e login

**Painel do dono (admin)**
- Visão geral: caixa do dia, agenda de hoje, receita recorrente e fechamento por barbeiro
- Agenda completa, vendas, serviços, produtos, planos, assinaturas, clientes e equipe
- Configurações da barbearia: nome, contato, horário de abertura/fechamento e intervalo entre horários

**Área do colaborador**
- Enxerga apenas a agenda dele, por dia
- Marca o horário como concluído ou cancelado
- Lançamento rápido de vendas (serviço ou produto) e comanda do dia com total

**Área do cliente**
- Próximos horários, histórico e situação do plano

## Papéis de acesso

| Papel | Entra em | Enxerga |
|---|---|---|
| `admin` | `/painel` | tudo |
| `colaborador` | `/colaborador` | agenda e vendas próprias |
| `cliente` | `/cliente` | agendamentos e plano próprios |

## Tudo é editável

O arquivo **`src/lib/recursos.js`** controla as telas de cadastro do painel.
Cada campo listado ali vira automaticamente coluna na tabela, campo no
formulário e rota de API. Para acrescentar, por exemplo, "tempo de garantia"
em serviços: crie a coluna no Supabase e adicione uma linha em `campos`.
Nenhum outro arquivo precisa mudar.

Cores, fontes e espaçamentos ficam em **`tailwind.config.js`** e
**`src/app/globals.css`**.

## Estrutura

```
src/
  app/
    page.js                 site (home)
    servicos/ planos/ agendar/ entrar/ cadastro/
    painel/                 área do dono
    colaborador/            área do barbeiro
    cliente/                área do cliente
    api/                    rotas de servidor
  components/               UI, painel e CRUD genérico
  lib/                      banco, sessão, formatos e mapa de recursos
supabase/schema.sql         banco + dados de exemplo
```

Passo a passo de instalação: veja **INSTALACAO.md**.
