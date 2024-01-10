
export = function extrairJWTPayload(jwt: string): string | null {
	if (!jwt)
		return null;

	const inicio = jwt.indexOf("."), fim = jwt.lastIndexOf(".");
	if (inicio <= 0 || fim <= inicio)
		return null;
	
	const base64UrlPayload = jwt.substring(inicio + 1, fim);
	if (!base64UrlPayload)
		return null;

	// JWT usa o padrão Base64URL, que usa - em vez de + e usa _ em vez de /
	// Aparentemente, o Node.js aceita nativamente tanto Base64 normal como
	// Base64URL quando o encoding pedido for "base64":
	// https://nodejs.org/docs/latest-v12.x/api/buffer.html#buffer_buffers_and_character_encodings
	try {
		return Buffer.from(base64UrlPayload, "base64").toString("utf-8");
	} catch (ex) {
		return null;
	}
}
