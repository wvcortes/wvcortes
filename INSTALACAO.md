# Instalação (PowerShell + Vercel)

Requisitos: Node.js 18.17 ou mais novo, conta no Supabase e conta na Vercel.

---

## 1. Banco no Supabase

1. Crie um projeto em https://supabase.com
2. Abra **SQL Editor > New query**
3. Cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**
4. Vá em **Project Settings > API** e copie:
   - **Project URL**
   - **service_role** (em Project API keys — é a chave secreta, nunca publique)

Acessos de exemplo criados pelo SQL (troque as senhas depois, pelo painel):

| Papel | E-mail | Senha |
|---|---|---|
| Dono | admin@navalha.com.br | navalha123 |
| Barbeiro | rafael@navalha.com.br | navalha123 |
| Barbeiro | bruno@navalha.com.br | navalha123 |

---

## 2. Rodar na sua máquina (PowerShell)

```powershell
cd C:\caminho\ate\navalha-barbearia

npm install

# cria o arquivo de variáveis
@"
NEXT_PUBLIC_SUPABASE_URL="https://SEUPROJETO.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="cole-a-service-role-key"
AUTH_SECRET="$([guid]::NewGuid().ToString() + [guid]::NewGuid().ToString())"
"@ | Out-File -FilePath .env.local -Encoding utf8

npm run dev
```

Abra http://localhost:3000

- Site: `/`
- Login: `/entrar`
- Painel do dono: `/painel`

> `AUTH_SECRET` é o que assina o cookie de sessão. Use o mesmo valor na Vercel;
> se trocar, todo mundo é deslogado.

---

## 3. Publicar na Vercel

```powershell
npm i -g vercel

git init
git add .
git commit -m "Sistema da barbearia"

vercel
```

Depois cadastre as três variáveis (Production, Preview e Development) em
**Settings > Environment Variables** no painel da Vercel:

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `AUTH_SECRET` | a mesma frase longa do `.env.local` |

Ou pela linha de comando:

```powershell
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add AUTH_SECRET production

vercel --prod
```

---

## 4. Primeiros ajustes no painel

1. Entre como dono em `/entrar`
2. **Configurações**: nome da barbearia, contato, horário de abertura, fechamento
   e o intervalo entre horários (é isso que define os horários oferecidos ao cliente)
3. **Equipe**: troque a senha dos barbeiros de exemplo ou cadastre os seus
4. **Serviços** e **Produtos**: ajuste preços, durações e o que fica visível no site
5. **Planos**: separe os benefícios com `|` — cada trecho vira um item da lista no site

---

## Perguntas rápidas

**Como mudo as cores e as fontes?**
`tailwind.config.js` (paleta) e `src/app/globals.css` (fontes e detalhes).

**Como acrescento um campo novo em serviços/produtos/clientes?**
Crie a coluna no Supabase e adicione uma linha em `campos` dentro de
`src/lib/recursos.js`. A tabela e o formulário se atualizam sozinhos.

**Como mudo o fuso horário?**
`src/lib/formato.js`, constantes `FUSO` e `FUSO_NOME`.

**Cobrança automática do plano mensal?**
Não está incluída: a assinatura entra como *pendente* e o dono confirma no
painel. Para cobrar automático, o próximo passo é plugar Mercado Pago ou Stripe
na rota `src/app/api/auth/cadastro/route.js`.
