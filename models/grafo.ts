
export class No {
	public readonly id: number;
	public readonly classe: string;
	public readonly texto: string | null;
	public readonly entradas: Aresta[];
	public readonly saidas: Aresta[];
	public readonly sampler: boolean;

	public entradaNegativa: Aresta | null; // Apenas para samplers
	public entradaPositiva: Aresta | null; // Apenas para samplers

	public visitando: boolean;
	public validadoNegativo: boolean;
	public validadoPositivo: boolean;

	public constructor(id: number, classe: string, texto?: string | null) {
		this.id = id;
		this.classe = classe;
		this.texto = texto || null;
		this.entradas = [];
		this.saidas = [];
		this.sampler = classe.startsWith("KSampler");
		this.entradaNegativa = null;
		this.entradaPositiva = null;
		this.visitando = false;
		this.validadoNegativo = false;
		this.validadoPositivo = false;
	}
}

export class Aresta {
	public readonly id: number;
	public noEntradaDaAresta: No | null;
	public noSaidaDaAresta: No | null;

	public constructor(id: number) {
		this.id = id;
		this.noEntradaDaAresta = null;
		this.noSaidaDaAresta = null;
	}

	public definirNoEntradaDaAresta(no: No) {
		if (!this.noEntradaDaAresta) {
			this.noEntradaDaAresta = no;
			no.saidas.push(this);
		}
	}

	public definirNoSaidaDaAresta(no: No) {
		if (!this.noSaidaDaAresta) {
			this.noSaidaDaAresta = no;
			no.entradas.push(this);
		}
	}
}

export class Grafo {
	public static extrair(nosOriginais: any[]): string | Grafo {
		if (!nosOriginais || !nosOriginais.length)
			return "Nenhum nó encontrado";

		// Replica a estrutura do grafo com base nas entradas e saídas
		const nos: No[] = [];
		const nosPorId = new Map<number, No>();
		const arestasPorId = new Map<number, Aresta>();

		let saveImages = 0;
		for (let i = nosOriginais.length - 1; i >= 0; i--) {
			const noOriginal = nosOriginais[i];

			if (noOriginal.widgets_values) {
				switch (noOriginal.type) {
					case "EmptyLatentImage":
						if (typeof noOriginal.widgets_values[0] !== "number" || isNaN(noOriginal.widgets_values[0]))
							return "Width inválida";
						if (noOriginal.widgets_values[0] < 8)
							return "Width menor do que 8";
						if (noOriginal.widgets_values[0] > 2048)
							return "Width maior do que 2048";
						if (noOriginal.widgets_values[0] & 3)
							return "Width não é um múltiplo de 8";

						if (typeof noOriginal.widgets_values[1] !== "number" || isNaN(noOriginal.widgets_values[1]))
							return "Height inválida";
						if (noOriginal.widgets_values[1] < 8)
							return "Height menor do que 8";
						if (noOriginal.widgets_values[1] > 2048)
							return "Height maior do que 2048";
						if (noOriginal.widgets_values[1] & 3)
							return "Height não é um múltiplo de 8";

						if ((noOriginal.widgets_values[0] * noOriginal.widgets_values[1]) > (1024 * 2048))
							return "O produto de width x height não pode ser maior do que " + (1024 * 2048);

						if (typeof noOriginal.widgets_values[2] !== "number" || isNaN(noOriginal.widgets_values[2]) || noOriginal.widgets_values[2] !== 1)
							return "batch_size diferente de 1";
						break;

					case "KSampler":
						if (typeof noOriginal.widgets_values[0] !== "number" || isNaN(noOriginal.widgets_values[0]))
							return "Seed inválida";
						if (noOriginal.widgets_values[0] < 0)
							return "Seed deve ser maior ou igual a 0";
						if (noOriginal.widgets_values[0] > Number.MAX_SAFE_INTEGER)
							return "Seed deve ser menor ou igual a " + Number.MAX_SAFE_INTEGER;

						if (typeof noOriginal.widgets_values[2] !== "number" || isNaN(noOriginal.widgets_values[2]))
							return "Steps inválidos";
						if (noOriginal.widgets_values[2] < 1)
							return "Steps deve ser maior ou igual a 1";
						if (noOriginal.widgets_values[2] > 25)
							return "Steps deve ser menor ou igual a 25";
						break;

					case "KSamplerAdvanced":
						if (typeof noOriginal.widgets_values[1] !== "number" || isNaN(noOriginal.widgets_values[1]))
							return "Seed inválida";
						if (noOriginal.widgets_values[1] < 0)
							return "Seed deve ser maior ou igual a 0";
						if (noOriginal.widgets_values[1] > Number.MAX_SAFE_INTEGER)
							return "Seed deve ser menor ou igual a " + Number.MAX_SAFE_INTEGER;

						if (typeof noOriginal.widgets_values[3] !== "number" || isNaN(noOriginal.widgets_values[3]))
							return "Steps inválidos";
						if (noOriginal.widgets_values[3] < 1)
							return "Steps deve ser maior ou igual a 1";
						if (noOriginal.widgets_values[3] > 25)
							return "Steps deve ser menor ou igual a 25";
						break;
				}
			}

			const no = new No(noOriginal.id, noOriginal.type, (noOriginal.type === "CLIPTextEncode" && noOriginal.widgets_values && noOriginal.widgets_values[0]) || null);
			if (no.classe.startsWith("SaveImage"))
				saveImages++;

			nos.push(no);
			nosPorId.set(no.id, no);

			const inputs: any[] = noOriginal.inputs;
			if (inputs) {
				for (let j = inputs.length - 1; j >= 0; j--) {
					const input = inputs[j];
					if (input && typeof input.link === "number") {
						const id: number = input.link;
						let aresta = arestasPorId.get(id);
						if (!aresta) {
							aresta = new Aresta(id);
							arestasPorId.set(id, aresta);
						}

						// Como estamos tratando os inputs do nó, aqui é a saída da aresta
						aresta.definirNoSaidaDaAresta(no);

						if (no.sampler) {
							if (input.name === "positive")
								no.entradaPositiva = aresta;
							else if (input.name === "negative")
								no.entradaNegativa = aresta;
						}
					}
				}
			}

			const outputs: any[] = noOriginal.outputs;
			if (outputs) {
				for (let j = outputs.length - 1; j >= 0; j--) {
					const output = outputs[j];
					if (!output)
						continue;

					if (typeof output.link === "number") {
						const id: number = output.link;
						let aresta = arestasPorId.get(id);
						if (!aresta) {
							aresta = new Aresta(id);
							arestasPorId.set(id, aresta);
						}

						// Como estamos tratando os outputs do nó, aqui é a entrada da aresta
						aresta.definirNoEntradaDaAresta(no);
					}

					if (output.links) {
						for (let k = output.links.length - 1; k >= 0; k--) {
							const id: number = output.links[k];
							let aresta = arestasPorId.get(id);
							if (!aresta) {
								aresta = new Aresta(id);
								arestasPorId.set(id, aresta);
							}

							// Como estamos tratando os outputs do nó, aqui é a entrada da aresta
							aresta.definirNoEntradaDaAresta(no);
						}
					}
				}
			}
		}

		if (saveImages > 1)
			return 'Não é permitido utilizar mais de um nó do tipo "Save Image"';

		return new Grafo(nos, nosPorId, arestasPorId);
	}

	public readonly nos: No[];
	public readonly nosPorId: Map<number, No>;
	public readonly arestasPorId: Map<number, Aresta>;

	public constructor(nos: No[], nosPorId: Map<number, No>, arestasPorId: Map<number, Aresta>) {
		this.nos = nos;
		this.nosPorId = nosPorId;
		this.arestasPorId = arestasPorId;
	}

	public validarPrompts(): string | null {
		const nos = this.nos;

		// Agora, partindo da entrada positiva e negativa dos samplers, tenta chegar aos textos para poder validar
		for (let i = nos.length - 1; i >= 0; i--) {
			if (!nos[i].sampler)
				continue;

			let erro = this.buscarEValidarPrompt(nos[i], true);
			if (erro)
				return erro;

			erro = this.buscarEValidarPrompt(nos[i], false);
			if (erro)
				return erro;
		}

		return null;
	}

	private buscarEValidarPrompt(sampler: No, positivo: boolean): string | null {
		const nos = this.nos;
		const nosPorId = this.nosPorId;
		const arestasPorId = this.arestasPorId;

		for (let i = nos.length - 1; i >= 0; i--)
			nos[i].visitando = false;

		sampler.visitando = true;

		const proximosNos: No[] = [];

		if (positivo) {
			if (sampler.entradaPositiva && sampler.entradaPositiva.noEntradaDaAresta)
				proximosNos.push(sampler.entradaPositiva.noEntradaDaAresta);
		} else {
			if (sampler.entradaNegativa && sampler.entradaNegativa.noEntradaDaAresta)
				proximosNos.push(sampler.entradaNegativa.noEntradaDaAresta);
		}

		while (proximosNos.length) {
			const no = proximosNos.shift() as No;
			if (no.visitando)
				return "Dependência cíclica encontrada entre os nós";

			no.visitando = true;

			if (no.texto) {
				if (positivo) {
					if (!no.validadoPositivo) {
						no.validadoPositivo = true;
						console.log("positivo: " + no.texto);
					} else {
						console.log("positivo rep: " + no.texto);
					}
				} else {
					if (!no.validadoNegativo) {
						no.validadoNegativo = true;
						console.log("negativo: " + no.texto);
					} else {
						console.log("negativo rep: " + no.texto);
					}
				}
			}
		}

		return null;
	}
}
