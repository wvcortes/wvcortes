"use client";

export default function Erro({ error, reset }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F5EFE6", color: "#14100E" }}>
        <div style={{ maxWidth: 560, margin: "18vh auto", padding: "0 24px" }}>
          <p style={{ letterSpacing: ".18em", fontSize: 12, color: "#6B1F2A", textTransform: "uppercase" }}>
            Algo travou
          </p>
          <h1 style={{ fontSize: 34, margin: "12px 0 16px" }}>A página não conseguiu carregar.</h1>
          <p style={{ lineHeight: 1.6, color: "#5b544e" }}>
            Quase sempre isso é conexão com o banco. Confira se o arquivo <code>.env.local</code> tem
            as três variáveis (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e AUTH_SECRET) e
            se o SQL de <code>supabase/schema.sql</code> já foi executado no Supabase.
          </p>
          <pre
            style={{
              marginTop: 20,
              padding: 16,
              background: "#FBF8F3",
              border: "1px solid #E2D9CC",
              fontSize: 12,
              whiteSpace: "pre-wrap",
            }}
          >
            {error?.message}
          </pre>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#6B1F2A",
              color: "#F5EFE6",
              border: 0,
              padding: "12px 22px",
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
