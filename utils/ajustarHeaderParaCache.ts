import app = require("teem");

export = function ajustarHeaderParaCache(res: app.Response): void {
	res.removeHeader("Cache-Control");
	res.removeHeader("Expires");
	res.removeHeader("Pragma");

	res.header("Cache-Control", "public, max-age=31536000, immutable");
}
