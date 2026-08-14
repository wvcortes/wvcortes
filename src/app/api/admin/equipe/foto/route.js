import { NextResponse } from "next/server";
import { exigirPapel } from "@/lib/auth";
import { db, conferirAmbiente } from "@/lib/db";
import { BUCKET_FOTOS_COLABORADORES, obterPathFotoStorage } from "@/lib/fotoColaborador";

const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSOES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(req) {
  try {
    conferirAmbiente();
    const admin = await exigirPapel(["admin"]);
    if (!admin) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    const form = await req.formData();
    const arquivo = form.get("foto");
    if (!(arquivo instanceof File) || !TIPOS.has(arquivo.type)) return NextResponse.json({ erro: "Escolha uma imagem JPG, JPEG, PNG ou WEBP." }, { status: 400 });
    if (arquivo.size <= 0 || arquivo.size > 5 * 1024 * 1024) return NextResponse.json({ erro: "A foto deve ter no máximo 5 MB." }, { status: 400 });
    const path = `${admin.id}/${crypto.randomUUID()}.${EXTENSOES[arquivo.type]}`;
    const envio = await db.storage.from(BUCKET_FOTOS_COLABORADORES).upload(path, arquivo, { contentType: arquivo.type, upsert: false });
    if (envio.error) return NextResponse.json({ erro: envio.error.message }, { status: 400 });
    const { data } = db.storage.from(BUCKET_FOTOS_COLABORADORES).getPublicUrl(path);
    if (!data?.publicUrl) {
      await db.storage.from(BUCKET_FOTOS_COLABORADORES).remove([path]);
      return NextResponse.json({ erro: "O Storage não retornou a URL pública da foto." }, { status: 500 });
    }
    return NextResponse.json({ url: data.publicUrl, path });
  } catch (e) {
    return NextResponse.json({ erro: e?.message || "Não foi possível enviar a foto." }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    conferirAmbiente();
    const admin = await exigirPapel(["admin"]);
    if (!admin) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });

    const { url } = await req.json().catch(() => ({}));
    const path = obterPathFotoStorage(url);
    if (!path) {
      return NextResponse.json({ erro: "A foto informada não pertence ao bucket de colaboradores." }, { status: 400 });
    }

    const removido = await db.storage.from(BUCKET_FOTOS_COLABORADORES).remove([path]);
    if (removido.error) return NextResponse.json({ erro: removido.error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erro: e?.message || "Não foi possível remover a foto." }, { status: 500 });
  }
}
