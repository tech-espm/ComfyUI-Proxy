import app = require("teem");
import appsettings = require("./appsettings");
import Imagem = require("./models/imagem");
import Perfil = require("./enums/perfil");

app.run({
	localIp: appsettings.localIp,
	root: appsettings.root,
	port: appsettings.port,
	sqlConfig: appsettings.sqlConfig,

	onInit: function () {
		app.express.locals.Perfil = Perfil;
		app.express.locals.PrefixoAbsolutoIcone = Imagem.PrefixoAbsolutoIcone;
		app.express.locals.PrefixoAbsolutoImagem = Imagem.PrefixoAbsolutoImagem;
	},

	htmlErrorHandler: function (err: any, req: app.Request, res: app.Response, next: app.NextFunction) {
		// Como é um ambiente de desenvolvimento, deixa o objeto do erro
		// ir para a página, que possivelmente exibirá suas informações
		res.render("index/erro", { layout: "layout-externo", mensagem: (err.status === 404 ? null : (err.message || "Ocorreu um erro desconhecido")), erro: err });
	}
});
