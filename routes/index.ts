import app = require("teem");
import DataUtil = require("../utils/dataUtil");
import Imagem = require("../models/imagem");
import Usuario = require("../models/usuario");

class IndexRoute {
	public static async index(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (!u)
			res.redirect(app.root + "/login");
		else
			res.render("index/index", {
				layout: "layout-tabela",
				titulo: "Imagens",
				usuario: u,
				datatables: true,
				xlsx: true,
				dataInicial: DataUtil.horarioDeBrasiliaISO(-7 * 24 * 60 * 60),
				dataFinal: DataUtil.horarioDeBrasiliaISO()
			});
	}

	@app.http.all()
	public static async login(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (!u) {
			let mensagem: string | null = null;
	
			if (req.body.email || req.body.senha) {
				[mensagem, u] = await Usuario.efetuarLogin(req.body.email as string, req.body.senha as string, res);
				if (mensagem)
					res.render("index/login", {
						layout: "layout-externo",
						mensagem: mensagem
					});
				else
					res.redirect(app.root + "/");
			} else {
				res.render("index/login", {
					layout: "layout-externo",
					mensagem: null
				});
			}
		} else {
			res.redirect(app.root + "/");
		}
	}

	public static async redefinirSenha(req: app.Request, res: app.Response) {
		const i = req.url.indexOf("?");
		res.render("index/redefinirSenha", {
			layout: "layout-externo",
			token: ((i >= 0) ? req.url.substring(i + 1) : null)
		});
	}

	public static async acesso(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (!u)
			res.redirect(app.root + "/login");
		else
			res.render("index/acesso", {
				layout: "layout-sem-form",
				titulo: "Sem Permissão",
				usuario: u
			});
	}

	public static async perfil(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (!u)
			res.redirect(app.root + "/");
		else
			res.render("index/perfil", {
				titulo: "Meu Perfil",
				usuario: u
			});
	}

	public static async logout(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (u)
			await Usuario.efetuarLogout(u, res);
		res.redirect(app.root + "/");
	}

	@app.route.methodName("i/:id")
	public static async baixarI(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await Imagem.baixar(parseInt(req.params["id"]), u.id, u.admin, true, res);
	}

	@app.route.methodName("p/:id")
	public static async baixarP(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await Imagem.baixar(parseInt(req.params["id"]), u.id, u.admin, false, res);
	}
}

export = IndexRoute;
