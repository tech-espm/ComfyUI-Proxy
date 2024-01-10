import app = require("teem");
import ajustarHeaderParaCache = require("../utils/ajustarHeaderParaCache");
import appsettings = require("../appsettings");
import DataUtil = require("../utils/dataUtil");

interface Imagem {
	id: number;
	idusuario: number;
	tamanho: number;
	criacao: string;
}

class Imagem {
	public static readonly PrefixoAbsolutoIcone = "/i/";
	private static readonly CaminhoRelativoIcone = appsettings.pastaDados + "/i/";

	public static readonly PrefixoAbsolutoImagem = "/p/";
	private static readonly CaminhoRelativoImagem = appsettings.pastaDados + "/p/";

	private static async tentarOperacao<T>(operacao: () => Promise<T>, vezes: number): Promise<T> {
		try {
			return await operacao();
		} catch (ex: any) {
			vezes--;
			if (vezes <= 0)
				throw ex;

			return new Promise((resolve, reject) => {
				setTimeout(() => {
					Imagem.tentarOperacao(operacao, vezes).then(resolve, reject);
				}, 100);
			});
		}
	}

	public static validarPromptECriar(prompt: any, idusuario: number): Promise<string | number> {
		// @@@ Validar o prompt

		return app.sql.connect(async (sql) => {
			try {
				await sql.query("insert into imagem (idusuario, tamanho, criacao) values (?, 0, ?)", [idusuario, DataUtil.horarioDeBrasiliaISOComHorario()]);
			} catch (ex: any) {
				if (ex.code) {
					switch (ex.code) {
						case "ER_NO_REFERENCED_ROW":
						case "ER_NO_REFERENCED_ROW_2":
							return "Usuário não encontrado";
						default:
							throw ex;
					}
				} else {
					throw ex;
				}
			}

			return await sql.scalar("select last_insert_id()") as number;
		});
	}

	public static async listar(idusuario: number, admin: boolean, dataInicial: string, dataFinal: string): Promise<string | Imagem[]> {
		if (!(dataInicial = DataUtil.converterDataISO(dataInicial) as string))
			return "Data inicial inválida";

		if (!(dataFinal = DataUtil.converterDataISO(dataFinal) as string))
			return "Data final inválida";

		if (dataFinal < dataInicial)
			return "Data final deve ser maior ou igual à data inicial";

		dataInicial += " 00:00:00";
		dataFinal += " 23:59:59";

		return app.sql.connect(async (sql) => {
			const lista = await (admin ?
				sql.query("select i.id, i.tamanho, date_format(i.criacao, '%d/%m/%Y %H:%i') criacao, date_format(i.envio, '%d/%m/%Y %H:%i') envio, u.email from imagem i inner join usuario u on u.id = i.idusuario where i.criacao between ? and ?", [dataInicial, dataFinal]) :
				sql.query("select i.id, i.tamanho, date_format(i.criacao, '%d/%m/%Y %H:%i') criacao, date_format(i.envio, '%d/%m/%Y %H:%i') envio from imagem i where i.idusuario = ? and i.criacao between ? and ?", [idusuario, dataInicial, dataFinal])
			) as Imagem[];

			return (lista || []);
		});
	}

	public static async enviar(id: number, idusuario: number, base64I: string, base64P: string): Promise<string | null> {
		let bufferI: Buffer;
		let bufferP: Buffer;

		try {
			bufferI = Buffer.from(base64I || "", "base64");
			bufferP = Buffer.from(base64P || "", "base64");
		} catch (ex: any) {
			return "Formato do buffer inválido";
		}

		if (!bufferI.length)
			return "Buffer do ícone vazio";

		if (!bufferP.length)
			return "Buffer da imagem vazio";

		return app.sql.connect(async (sql) => {
			await sql.beginTransaction();

			const tamanho = await sql.scalar("select tamanho from imagem where id = ? and idusuario = ?", [id, idusuario]) as number | null;

			if (tamanho)
				return "Imagem já enviada";

			if (!tamanho && tamanho !== 0)
				return "Imagem não encontrada";

			await sql.query("update imagem set tamanho = ?, envio = ? where id = ?", [bufferP.length, DataUtil.horarioDeBrasiliaISOComHorario(), id]);

			if (!sql.affectedRows)
				return "Imagem não encontrada";

			await app.fileSystem.saveBuffer(Imagem.CaminhoRelativoIcone + id + ".png", bufferI);
			await app.fileSystem.saveBuffer(Imagem.CaminhoRelativoImagem + id + ".png", bufferP);

			await sql.commit();

			return null;
		});
	}

	public static async excluir(id: number, idusuario: number, admin: boolean): Promise<string | null> {
		return app.sql.connect(async (sql) => {
			const params = [id];

			if (!admin)
				params.push(idusuario);

			await sql.query("delete from imagem where id = ?" + (admin ? "" : " and idusuario = ?"), params);

			if (sql.affectedRows) {
				let caminho = Imagem.CaminhoRelativoIcone + id + ".png";

				if (await app.fileSystem.exists(caminho)) {
					try {
						await Imagem.tentarOperacao(() => app.fileSystem.deleteFile(caminho), 3);
					} catch (ex: any) {
						// Apenas ignora...
					}
				}

				caminho = Imagem.CaminhoRelativoImagem + id + ".png";

				if (await app.fileSystem.exists(caminho)) {
					try {
						await Imagem.tentarOperacao(() => app.fileSystem.deleteFile(caminho), 3);
					} catch (ex: any) {
						// Apenas ignora...
					}
				}

				return null;
			}

			return "Imagem não encontrada";
		});
	}

	public static async baixar(id: number, idusuario: number, admin: boolean, icone: boolean, res: app.Response): Promise<void> {
		const erro = await app.sql.connect(async (sql) => {
			const params = [id];

			if (!admin)
				params.push(idusuario);

			const tamanho = await sql.query("select tamanho from imagem where id = ?" + (admin ? "" : " and idusuario = ?"), params);

			return (tamanho ? null : "Imagem não encontrada");
		});

		if (erro) {
			res.status(400).json(erro);
			return;
		}

		const caminho = (icone ? Imagem.CaminhoRelativoIcone : Imagem.CaminhoRelativoImagem) + id + ".png";

		if (!await app.fileSystem.exists(caminho)) {
			res.status(400).json("Arquivo não encontrado");
			return;
		}

		ajustarHeaderParaCache(res);

		res.sendFile(app.fileSystem.absolutePath(caminho));
	}
}

export = Imagem;
