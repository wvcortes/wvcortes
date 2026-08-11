import GerenciadorLocais from "@/components/GerenciadorLocais";

export const dynamic = "force-dynamic";
export default function MeusLocais() {
  return <><p className="etiqueta text-couro">Meu atendimento</p><h1 className="mt-3 font-display text-4xl">Locais por data</h1><p className="mt-3 mb-8 text-sm text-fumaca">Uma exceção vale somente para a data escolhida. Nos demais dias, sua unidade padrão continua sendo usada.</p><GerenciadorLocais /></>;
}
