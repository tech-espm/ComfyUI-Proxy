import app = require("teem");
import appsettings = require("../../appsettings");
import Imagem = require("../../models/imagem");
import Perfil = require("../../enums/perfil");
import Usuario = require("../../models/usuario");

class ImagemApiRoute {
	@app.http.post()
	public static async criar(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res);
		if (!u)
			return;

		const r = await Imagem.criar(u.id);

		if (typeof r === "string")
			res.status(400);

		res.json({
			id: r,
			idusuario: u.id
		});
	}

	@app.http.post()
	public static async listar(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res);
		if (!u)
			return;

		const dados = req.body;

		if (!dados) {
			res.status(400).json("Dados inválidos");
			return;
		}

		const r = await Imagem.listar(u.id, u.admin, dados.dataInicial, dados.dataFinal);

		if (typeof r === "string")
			res.status(400);

		res.json(r);
	}

	@app.http.post()
	public static async enviar(req: app.Request, res: app.Response) {
		const dados = req.body;

		if (!dados) {
			res.status(400).json("Dados inválidos");
			return;
		}

		if (!dados.chaveImagem || dados.chaveImagem !== appsettings.chaveImagem) {
			res.status(400).json("Chave inválida");
			return;
		}

		dados.id = parseInt(dados.id) || 0;
		dados.idusuario = parseInt(dados.idusuario) || 0;

		const erro = await Imagem.enviar(dados.id, dados.idusuario, dados.base64I, dados.base64P);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.json({
			id: dados.id,
			idusuario: dados.idusuario
		});
	}

	@app.http.delete()
	public static async excluir(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res);
		if (!u)
			return;

		const id = parseInt(req.query["id"] as string);

		if (isNaN(id)) {
			res.status(400).json("Id inválido");
			return;
		}

		const erro = await Imagem.excluir(id, u.id, u.admin);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}
}

export = ImagemApiRoute;
