﻿import app = require("teem");
import Perfil = require("../../enums/perfil");
import Usuario = require("../../models/usuario");

class UsuarioApiRoute {
	@app.http.post()
	public static async alterarPerfil(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res);
		if (!u)
			return;

		const erro = await Usuario.alterarPerfil(u, res, req.body.nome, req.body.senhaAtual, req.body.novaSenha);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	@app.http.post()
	public static async criar(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res, true);
		if (!u)
			return;

		const erro = await Usuario.criar(req.body);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	@app.http.post()
	public static async editar(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res, true);
		if (!u)
			return;

		const usuario: Usuario = req.body;

		if (usuario) {
			if (parseInt(usuario.id as any) === u.id) {
				res.status(400).json("Um usuário não pode editar a si próprio");
				return;
			}
		}

		const erro = await Usuario.editar(usuario);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	@app.http.delete()
	public static async excluir(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res, true);
		if (!u)
			return;

		const id = parseInt(req.query["id"] as string);

		if (isNaN(id)) {
			res.status(400).json("Id inválido");
			return;
		}

		if (id === u.id) {
			res.status(400).json("Um usuário não pode excluir a si próprio");
			return;
		}

		const erro = await Usuario.excluir(id);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	public static async alterarAtivacao(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req, res, true);
		if (!u)
			return;

		const id = parseInt(req.query["id"] as string);

		if (isNaN(id)) {
			res.status(400).json("Id inválido");
			return;
		}

		const erro = await Usuario.alterarAtivacao(id, parseInt(req.query["ativo"] as string));

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	@app.http.post()
	public static async redefinirSenhaExterno(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req);
		if (u) {
			res.status(400).json("Um usuário não pode redefinir sua senha estando conectado ao sistema");
			return;
		}

		const erro = await Usuario.redefinirSenhaExterno(req.query["email"] as string);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}

	@app.http.post()
	public static async redefinirSenhaToken(req: app.Request, res: app.Response) {
		const u = await Usuario.cookie(req);
		if (u) {
			res.status(400).json("Um usuário não pode redefinir sua senha estando conectado ao sistema");
			return;
		}

		const erro = await Usuario.redefinirSenhaToken(req.query["token"] as string, req.query["senha"] as string);

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		res.sendStatus(204);
	}
}

export = UsuarioApiRoute;
