import app = require("teem");
import appsettings = require("../appsettings");
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

	public static async comfyUI(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (!u)
			res.redirect(app.root + "/login");
		else if (!u.ativo)
			res.render("index/erro", { layout: "layout-externo", mensagem: "A geração de imagens está desabilitada para o usuário", erro: null });
		else
			res.render("index/comfyUI", {
				layout: "layout-vazio",
				usuario: u,
				urlSite: appsettings.urlSite,
				urlWSProxy: appsettings.comfyUIWSProxy
			});
	}

	@app.http.all()
	public static async login(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req);
		if (!u) {
			let mensagem: string | null = null;
	
			if (req.body.email || req.body.senha || req.query.token) {
				[mensagem, u] = await Usuario.efetuarLogin(req.query.token as string, req.body.email as string, req.body.senha as string, res);
				if (mensagem)
					res.render("index/login", {
						layout: "layout-externo",
						mensagem: mensagem,
						ssoRedir: appsettings.ssoRedir
					});
				else
					res.redirect(app.root + "/");
			} else {
				res.render("index/login", {
					layout: "layout-externo",
					mensagem: null,
					ssoRedir: appsettings.ssoRedir
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

	@app.http.post()
	public static async clip(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		if (req.body && req.body.prompt && typeof req.body.prompt === "string") {
			try {
				const r = await app.request.json.postObject(appsettings.comfyUICLIP, {
					prompt: req.body.prompt
				});
				if (r.statusCode === 200 && typeof r.result === "number") {
					res.json(r.result);
					return;
				}
			} catch (ex: any) {
				// Apenas ignora...
			}
		}

		res.json("-");
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

	@app.route.methodName("baixarWorkflow/:id")
	public static async baixarWorkflow(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await Imagem.baixarWorkflow(parseInt(req.params["id"]), u.id, u.admin, res);
	}

	@app.http.hidden()
	private static async comfyUISend(method: string, rota: string, u: Usuario, req: app.Request, res: app.Response) {
		const url = appsettings.comfyUIAPI[u.id & 1] + rota;

		let r: app.BufferResponse;

		if (method === "post")
			r = await app.request.buffer.postObject(url, req.body, {
				headers: {
					"Comfy-User": u.email
				}
			});
		else
			r = await app.request.buffer.get(url, {
				headers: {
					"Comfy-User": u.email
				}
			});

		if (r.statusCode === 204)
			res.sendStatus(204);
		else
			res.status(r.statusCode).contentType(r.headers["content-type"] || "application/octet-stream").end(r.result || "");
	}

	@app.route.methodName("comfyUIAssets/*")
	public static async comfyUIAssets(req: app.Request, res: app.Response) {
		if (req.params && req.params[0]) {
			if (req.params[0].indexOf("..") >= 0 || req.params[0].indexOf("*") >= 0)
				res.status(404).json("Proibido");
			else
				res.sendFile(app.fileSystem.absolutePath("comfyUIAssets/" + req.params[0]));
		} else {
			res.sendStatus(404).json("Não encontrado");
		}
	}

	@app.route.methodName("extensions")
	public static async comfyUIExtensions(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await this.comfyUISend("get", "/extensions", u, req, res);
	}

	@app.route.methodName("embeddings")
	public static async comfyUIEmbeddings(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await this.comfyUISend("get", "/embeddings", u, req, res);
	}

	@app.route.methodName("history")
	public static async comfyUIHistory(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await this.comfyUISend("get", "/history?max_items=" + encodeURIComponent(req.query["max_items"] as string), u, req, res);
	}

	@app.route.methodName("object_info")
	public static async comfyUIObjectInfo(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await this.comfyUISend("get", "/object_info", u, req, res);
	}

	@app.route.methodName("queue")
	public static async comfyUIQueue(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await this.comfyUISend("get", "/queue", u, req, res);
	}

	@app.http.hidden()
	@app.route.methodName("queue")
	public static async comfyUIQueuePost(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		if (req.body && Array.isArray(req.body.delete) && req.body.delete[0]) {
			const erro = await Imagem.excluir(parseInt(req.body.delete[0]) || 0, u.id, u.admin, true);
			if (erro) {
				res.status(400).json(erro);
				return;
			}
		}

		res.sendStatus(204);
	}

	@app.route.methodName("prompt")
	public static async comfyUIPrompt(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await this.comfyUISend("get", "/prompt", u, req, res);
	}

	@app.http.post()
	@app.route.methodName("prompt")
	public static async comfyUIPromptPost(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		const r = await Imagem.validarPromptECriar(req.body, u.id);
		if (typeof r === "string") {
			res.status(400).json(r);
			return;
		}

		if (!req.body.extra_data.extra_pnginfo.workflow.extra)
			req.body.extra_data.extra_pnginfo.workflow.extra = {};

		req.body.extra_data.idusuario = u.id;
		req.body.extra_data.idimagem = r;
		req.body.extra_data.extra_pnginfo.workflow.extra.idusuario = u.id;
		req.body.extra_data.extra_pnginfo.workflow.extra.idimagem = r;
		req.body.number = r;

		await this.comfyUISend("post", "/prompt", u, req, res);
	}

	@app.route.methodName("settings")
	public static async comfyUISettings(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await this.comfyUISend("get", "/settings", u, req, res);
	}

	@app.http.post()
	@app.route.methodName("settings/*")
	public static async comfyUISettingsPost(req: app.Request, res: app.Response) {
		res.json(true);
		// Não é mais permitido alterar as settings
		/*
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		if (req.params && req.params[0]) {
			if (req.params[0].indexOf("..") >= 0 || req.params[0].indexOf("*") >= 0)
				res.status(404).json("Proibido");
			else
				await this.comfyUISend("post", "/settings/" + req.params[0], u, req, res);
		} else {
			res.sendStatus(404).json("Não encontrado");
		}
		*/
	}

	@app.route.methodName("system_stats")
	public static async comfyUISystemStats(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await this.comfyUISend("get", "/system_stats", u, req, res);
	}

	@app.route.methodName("userdata/*")
	public static async comfyUIUserdata(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		if (req.params && req.params[0]) {
			if (req.params[0].indexOf("..") >= 0 || req.params[0].indexOf("*") >= 0)
				res.status(404).json("Proibido");
			else
				await this.comfyUISend("get", "/userdata/" + req.params[0], u, req, res);
		} else {
			res.sendStatus(404).json("Não encontrado");
		}
	}

	@app.route.methodName("users")
	public static async comfyUIUsers(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		await this.comfyUISend("get", "/users", u, req, res);
	}

	@app.route.methodName("view")
	public static async comfyUIView(req: app.Request, res: app.Response) {
		let u = await Usuario.cookie(req, res);
		if (!u)
			return;

		let query = "";

		const i = req.url.indexOf("?");
		if (i >= 0)
			query = req.url.substring(i);

		let idimagem: number;
		if (!req.query["subfolder"] &&
			req.query["type"] === "output" &&
			(idimagem = parseInt(req.query["filename"] as string)) &&
			(idimagem + ".png") === req.query["filename"]) {
			res.redirect(app.root + "/p/" + idimagem);
			return;
		}

		await this.comfyUISend("get", "/view" + query, u, req, res);
	}
}

export = IndexRoute;
