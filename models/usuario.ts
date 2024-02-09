import app = require("teem");
import { randomBytes } from "crypto";
import appsettings = require("../appsettings");
import DataUtil = require("../utils/dataUtil");
import Email = require("../utils/email");
import GeradorHash = require("../utils/geradorHash");
import intToHex = require("../utils/intToHex");
import Perfil = require("../enums/perfil");
import SafeBase64 = require("../utils/safeBase64");
import Validacao = require("../utils/validacao");

interface Usuario {
	id: number;
	email: string;
	nome: string;
	idperfil: Perfil;
	ativo: number;
	origem: string;
	senha: string;
	criacao: string;

	// Utilizados apenas através do cookie
	admin: boolean;
}

class Usuario {
	private static readonly IdAdmin = 1;

	public static async cookie(req: app.Request, res: app.Response | null = null, admin: boolean = false): Promise<Usuario | null> {
		let cookieStr = req.cookies[appsettings.cookie] as string;
		if (!cookieStr || cookieStr.length !== 48) {
			if (res) {
				res.statusCode = 403;
				res.json("Não permitido");
			}
			return null;
		} else {
			let id = parseInt(cookieStr.substring(0, 8), 16) ^ appsettings.usuarioHashId;
			let usuario: Usuario | null = null;

			await app.sql.connect(async (sql) => {
				let rows = await sql.query("select id, email, nome, idperfil, ativo, token from usuario where id = ? and exclusao is null", [id]);
				let row: any;

				if (!rows || !rows.length || !(row = rows[0]))
					return;

				let token = cookieStr.substring(16);

				if (!row.token || token !== (row.token as string))
					return;

				usuario = new Usuario();
				usuario.id = id;
				usuario.email = row.email as string;
				usuario.nome = row.nome as string;
				usuario.idperfil = row.idperfil as number;
				usuario.ativo = row.ativo as number;
				usuario.admin = (usuario.idperfil === Perfil.Administrador);
			});

			if (admin && usuario && (usuario as Usuario).idperfil !== Perfil.Administrador)
				usuario = null;
			if (!usuario && res) {
				res.statusCode = 403;
				res.json("Não permitido");
			}
			return usuario;
		}
	}

	private static gerarTokenCookie(id: number): [string, string] {
		let idStr = intToHex(id ^ appsettings.usuarioHashId);
		let idExtra = intToHex(0);
		let token = randomBytes(16).toString("hex");
		let cookieStr = idStr + idExtra + token;
		return [token, cookieStr];
	}

	public static async efetuarLogin(token: string | null, email: string | null, senha: string | null, res: app.Response): Promise<[string | null, Usuario | null]> {
		if (token) {
			const resposta = await app.request.json.get(appsettings.ssoToken + encodeURIComponent(token));
			if (!resposta.success || !resposta.result)
				return [(resposta.result && resposta.result.toString()) || ("Erro de comunicação de rede: " + resposta.statusCode), null];

			const json = resposta.result;
			if (json.erro)
				return [json.erro, null];

			email = json.dados.email;
			senha = null;
		} else if (!email || !senha) {
			return ["Usuário ou senha inválidos", null];
		}

		email = (email || "").normalize().trim().toLowerCase();
		if (email.endsWith("espm.br") && senha)
			return ["Estudantes e funcionários da ESPM devem efetuar o login através da outra opção", null];

		return await app.sql.connect(async (sql) => {
			const usuarios: Usuario[] = await sql.query("select id, nome, idperfil, ativo, senha from usuario where email = ? and exclusao is null", [email]);
			let usuario: Usuario;

			if (!usuarios || !usuarios.length || !(usuario = usuarios[0]) || (senha && !(await GeradorHash.validarSenha(senha.normalize(), usuario.senha as string))))
				return ["Usuário ou senha inválidos", null];

			let [token, cookieStr] = Usuario.gerarTokenCookie(usuario.id);

			await sql.query("update usuario set token = ? where id = ?", [token, usuario.id]);

			usuario.admin = (usuario.idperfil === Perfil.Administrador);

			res.cookie(appsettings.cookie, cookieStr, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, path: "/", secure: appsettings.cookieSecure });

			return [null, usuario];
		});
	}

	public static async efetuarLogout(usuario: Usuario, res: app.Response): Promise<void> {
		await app.sql.connect(async (sql) => {
			await sql.query("update usuario set token = null where id = ?", [usuario.id]);

			res.cookie(appsettings.cookie, "", { expires: new Date(0), httpOnly: true, path: "/", secure: appsettings.cookieSecure });
		});
	}

	public static async alterarPerfil(usuario: Usuario, res: app.Response, nome: string, senhaAtual: string, novaSenha: string): Promise<string | null> {
		nome = (nome || "").normalize().trim();
		if (nome.length < 3 || nome.length > 100)
			return "Nome inválido";

		if (!!senhaAtual !== !!novaSenha || (novaSenha && (novaSenha.length < 6 || novaSenha.length > 20)))
			return "Senha inválida";

		let r: string | null = null;

		await app.sql.connect(async (sql) => {
			if (senhaAtual) {
				let hash = await sql.scalar("select senha from usuario where id = ?", [usuario.id]) as string;
				if (!await GeradorHash.validarSenha(senhaAtual.normalize(), hash)) {
					r = "Senha atual não confere";
					return;
				}

				hash = await GeradorHash.criarHash(novaSenha.normalize());

				let [token, cookieStr] = Usuario.gerarTokenCookie(usuario.id);

				await sql.query("update usuario set nome = ?, senha = ?, token = ? where id = ?", [nome, hash, token, usuario.id]);

				res.cookie(appsettings.cookie, cookieStr, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, path: "/", secure: appsettings.cookieSecure });
			} else {
				await sql.query("update usuario set nome = ? where id = ?", [nome, usuario.id]);
			}
		});

		return r;
	}

	private static validar(usuario: Usuario, criacao: boolean): string | null {
		if (!usuario)
			return "Usuário inválido";

		usuario.id = parseInt(usuario.id as any);

		if (criacao) {
			// Limita o e-mail a 85 caracteres para deixar 15 sobrando, para tentar evitar perda de dados durante a concatenação da exclusão
			if (!usuario.email || !Validacao.isEmail(usuario.email = usuario.email.normalize().trim().toLowerCase()) || usuario.email.length > 85)
				return "E-mail inválido";
		} else {
			if (isNaN(usuario.id))
				return "Id inválido";
		}

		if (!usuario.nome || !(usuario.nome = usuario.nome.normalize().trim()) || usuario.nome.length > 100)
			return "Nome inválido";

		if (isNaN(usuario.idperfil = parseInt(usuario.idperfil as any) as Perfil))
			return "Perfil inválido";

		if (!(usuario.origem = (usuario.origem || "").normalize().trim().toUpperCase()))
			usuario.origem = "ESPM";
		else if (usuario.origem.length > 50)
			return "Origem inválida";

		if (criacao) {
			if (!usuario.senha || (usuario.senha = usuario.senha.normalize()).length < 6 || usuario.senha.length > 20)
				return "Senha inválida";
		}

		return null;
	}

	public static listar(): Promise<Usuario[]> {
		return app.sql.connect(async (sql) => {
			const lista = await sql.query("select u.id, u.email, u.nome, p.nome perfil, u.ativo, u.origem, date_format(u.criacao, '%d/%m/%Y') criacao from usuario u inner join perfil p on p.id = u.idperfil where u.exclusao is null order by u.email asc") as Usuario[];

			return (lista || []);
		});
	}

	public static obter(id: number): Promise<Usuario | null> {
		return app.sql.connect(async (sql) => {
			const lista = await sql.query("select id, email, nome, idperfil, ativo, origem, date_format(criacao, '%d/%m/%Y') criacao from usuario where id = ? and exclusao is null", [id]) as Usuario[];

			return ((lista && lista[0]) || null);
		});
	}

	public static async criar(usuario: Usuario): Promise<string | null> {
		let res: string | null;
		if ((res = Usuario.validar(usuario, true)))
			return res;

		return app.sql.connect(async (sql) => {
			try {
				await sql.query("insert into usuario (email, nome, idperfil, ativo, origem, senha, criacao) values (?, ?, ?, 1, ?, ?, now())", [usuario.email, usuario.nome, usuario.idperfil, usuario.origem, await GeradorHash.criarHash(usuario.senha)]);

				usuario.id = await sql.scalar("select last_insert_id()") as number;
			} catch (ex: any) {
				if (ex.code) {
					switch (ex.code) {
						case "ER_DUP_ENTRY":
							return `O e-mail ${usuario.email} já está em uso`;
						case "ER_NO_REFERENCED_ROW":
						case "ER_NO_REFERENCED_ROW_2":
							return "Perfil não encontrado";
						default:
							throw ex;
					}
				} else {
					throw ex;
				}
			}

			//await app.request.json.postObject(appsettings.comfyUIAPI[usuario.id & 1] + "/users", {
			//	"username": usuario.email
			//}, {
			//	headers: {
			//		"Comfy-User": usuario.email
			//	}
			//});

			return null;
		});
	}

	public static async editar(usuario: Usuario): Promise<string | null> {
		let res: string | null;
		if ((res = Usuario.validar(usuario, false)))
			return res;

		if (usuario.id === Usuario.IdAdmin)
			return "Não é possível editar o usuário administrador principal";

		return app.sql.connect(async (sql) => {
			await sql.query("update usuario set nome = ?, idperfil = ?, origem = ? where id = ? and exclusao is null", [usuario.nome, usuario.idperfil, usuario.origem, usuario.id]);

			return (sql.affectedRows ? null : "Usuário não encontrado");
		});
	}

	public static async excluir(id: number): Promise<string | null> {
		if (id === Usuario.IdAdmin)
			return "Não é possível excluir o usuário administrador principal";

		return app.sql.connect(async (sql) => {
			const agora = DataUtil.horarioDeBrasiliaISOComHorario();

			// Utilizar substr(email, instr(email, ':') + 1) para remover o prefixo, caso precise desfazer a exclusão (caso
			// não exista o prefixo, instr() vai retornar 0, que, com o + 1, faz o substr() retornar a própria string inteira)
			await sql.query("update usuario set email = concat('@', id, ':', email), token = null, exclusao = ? where id = ? and exclusao is null", [agora, id]);

			return (sql.affectedRows ? null : "Usuário não encontrado");
		});
	}

	public static async alterarAtivacao(id: number, ativo: number): Promise<string | null> {
		return app.sql.connect(async (sql) => {
			await sql.query("update usuario set ativo = ? where id = ? and exclusao is null", [ativo ? 1 : 0, id]);

			return (sql.affectedRows ? null : "Usuário não encontrado");
		});
	}

	public static async redefinirSenhaExterno(email: string): Promise<string | null> {
		if (!email || !(email = email.normalize().trim()))
			return "E-mail inválido";

		return app.sql.connect(async (sql) => {
			const usuarios: { id: number, nome: string }[] = await sql.query("select id, nome from usuario where email = ?", [email]);

			if (!usuarios || !usuarios.length)
				return "Usuário não encontrado";

			const tokenreset = randomBytes(32).toString("hex"),
				id = "0000000" + (usuarios[0].id ^ appsettings.usuarioHashId).toString(16),
				buffer = Buffer.from(id.substring(id.length - 8) + tokenreset, "utf-8");

			for (let i = buffer.length - 1; i >= 0; i--)
				buffer[i] ^= 0x55;

			const agora = new Date(),
				limite = new Date(agora.getTime() + (2 * 24 * 60 * 60 * 1000));

			await sql.query("update usuario set tokenreset = ?, datalimitereset = ? where id = ?", [tokenreset, limite.getTime().toString(), usuarios[0].id]);

			const link = appsettings.urlSite + app.root + "/redefinirSenha?" + SafeBase64.encode(buffer),
				html = `
					<p>Olá, ${usuarios[0].nome}!</p>
					<p>Recebemos um pedido para redefinir sua senha em ${agora.toLocaleString("pt-BR")}.</p>
					<p>Por favor, acesse o link <a target="_blank" href="${link}">${link}</a> até ${limite.toLocaleString("pt-BR")} para redefinir sua senha.</p>
				`;

			await Email.enviar({
				from: appsettings.mailFromGeral,
				to: email,
				subject: "ESPM IAGen - Redefinição de senha",
				html: html
			});

			return null;
		});
	}

	public static async redefinirSenhaToken(safeBase64Token: string, novaSenha: string): Promise<string | null> {
		if (!safeBase64Token)
			return "Informações de redefinição de senha inválidas";

		if ((novaSenha = novaSenha.normalize()).length < 6 || novaSenha.length > 20)
			return "Nova senha inválida";

		let id: number, tokenreset: string;

		try {
			const buffer = SafeBase64.decode(safeBase64Token);
			for (let i = buffer.length - 1; i >= 0; i--)
				buffer[i] ^= 0x55;

			const idTokenreset = buffer.toString("utf-8");
			if (idTokenreset.length < 32)
				return "Informações de redefinição de senha inválidas";

			id = parseInt(idTokenreset.substring(0, 8), 16);
			if (isNaN(id))
				return "Informações de redefinição de senha inválidas";

			id ^= appsettings.usuarioHashId;
			tokenreset = idTokenreset.substring(8);
		} catch (ex: any) {
			return "Informações de redefinição de senha inválidas";
		}

		return app.sql.connect(async (sql) => {
			const usuarios: { id: number, email: string, tokenreset: string, datalimitereset: string }[] = await sql.query("select id, email, tokenreset, datalimitereset from usuario where id = ? and exclusao is null", [id]);

			if (!usuarios || !usuarios.length)
				return "Usuário não encontrado";

			const datalimitereset = parseInt(usuarios[0].datalimitereset);

			if (!tokenreset || !usuarios[0].tokenreset || usuarios[0].tokenreset !== tokenreset || isNaN(datalimitereset))
				return "Código de redefinição inválido";

			if ((new Date()).getTime() > datalimitereset)
				return "Código de redefinição expirado";

			const hash = await GeradorHash.criarHash(novaSenha);

			await sql.query("update usuario set senha = ?, token = null, tokenreset = null, datalimitereset = null where id = ?", [hash, id]);

			return null;
		});
	}
}

export = Usuario;
