export const BUCKET_FOTOS_COLABORADORES = "colaboradores";

function baseSupabase() {
  const valor = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

/**
 * Resolve os três formatos aceitos em usuarios.foto_url:
 * URL absoluta, arquivo legado de /public e path do Storage.
 */
export function resolverFotoColaborador(fotoUrl) {
  const valor = typeof fotoUrl === "string" ? fotoUrl.trim() : "";
  if (!valor) return null;
  if (/^https?:\/\//i.test(valor)) return valor;
  if (valor.startsWith("/")) return valor;

  const base = baseSupabase();
  if (!base || valor.includes("..") || valor.includes("\\")) return null;

  const prefixoBucket = `${BUCKET_FOTOS_COLABORADORES}/`;
  const path = valor.startsWith(prefixoBucket)
    ? valor.slice(prefixoBucket.length)
    : valor;
  if (!path) return null;

  const pathSeguro = path
    .split("/")
    .filter(Boolean)
    .map((parte) => encodeURIComponent(decodeURIComponentSeguro(parte)))
    .join("/");
  if (!pathSeguro) return null;

  return `${base}/storage/v1/object/public/${BUCKET_FOTOS_COLABORADORES}/${pathSeguro}`;
}

export function obterPathFotoStorage(fotoUrl) {
  const valor = typeof fotoUrl === "string" ? fotoUrl.trim() : "";
  if (!valor || valor.startsWith("/") || valor.includes("..") || valor.includes("\\")) return null;

  const base = baseSupabase();
  const prefixoPublico = `${base}/storage/v1/object/public/${BUCKET_FOTOS_COLABORADORES}/`;
  let path = valor;
  if (/^https?:\/\//i.test(valor)) {
    if (!base || !valor.startsWith(prefixoPublico)) return null;
    path = valor.slice(prefixoPublico.length);
  } else if (valor.startsWith(`${BUCKET_FOTOS_COLABORADORES}/`)) {
    path = valor.slice(BUCKET_FOTOS_COLABORADORES.length + 1);
  }

  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  return path && !path.startsWith("/") ? path : null;
}

function decodeURIComponentSeguro(valor) {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}
