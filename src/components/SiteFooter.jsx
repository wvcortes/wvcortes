import Link from "next/link";

export default function SiteFooter({ barbearia }) {
  return (
    <footer className="mt-24 bg-tinta text-marfim">
      <div className="poste" />
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl">{barbearia?.nome}</p>
          <p className="mt-3 max-w-xs text-sm text-marfim/60">{barbearia?.slogan}</p>
        </div>
        <div className="text-sm text-marfim/70">
          <p className="etiqueta text-latao">Onde fica</p>
          <p className="mt-3">{barbearia?.endereco}</p>
          <p className="mt-1">{barbearia?.dias_funcionamento}</p>
          <p className="mt-1 font-mono">
            {barbearia?.hora_abertura} às {barbearia?.hora_fechamento}
          </p>
        </div>
        <div className="text-sm text-marfim/70">
          <p className="etiqueta text-latao">Contato</p>
          <p className="mt-3">{barbearia?.telefone}</p>
          <p className="mt-1">{barbearia?.email}</p>
          <p className="mt-1">{barbearia?.instagram}</p>
          <Link href="/entrar" className="etiqueta mt-5 inline-block text-marfim/50 hover:text-latao">
            acesso da equipe
          </Link>
        </div>
      </div>
    </footer>
  );
}
