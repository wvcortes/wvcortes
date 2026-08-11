function campo(id, valor) {
  const texto = String(valor ?? "");
  return `${id}${String(texto.length).padStart(2, "0")}${texto}`;
}

function crc16(texto) {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i += 1) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function limpar(valor, max) {
  return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 .-]/g, "").trim().toUpperCase().slice(0, max);
}

export function gerarPix({ chave, nome, cidade, valor, referencia = "WV CORTES" }) {
  const quantia = Number(valor);
  if (!chave || !limpar(nome, 25) || !limpar(cidade, 15) || !Number.isFinite(quantia) || quantia <= 0) throw new Error("Configuração Pix incompleta.");
  const conta = campo("00", "BR.GOV.BCB.PIX") + campo("01", String(chave).trim());
  const adicional = campo("05", limpar(referencia, 25) || "***");
  const base = campo("00", "01") + campo("26", conta) + campo("52", "0000") + campo("53", "986") + campo("54", quantia.toFixed(2)) + campo("58", "BR") + campo("59", limpar(nome, 25)) + campo("60", limpar(cidade, 15)) + campo("62", adicional) + "6304";
  return base + crc16(base);
}
