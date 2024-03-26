import { api } from "./api.js";
import { ComfyDialog as _ComfyDialog } from "./ui/dialog.js";
import { toggleSwitch } from "./ui/toggleSwitch.js";
import { ComfySettingsDialog } from "./ui/settings.js";

export const ComfyDialog = _ComfyDialog;

/**
 * 
 * @param { string } tag HTML Element Tag and optional classes e.g. div.class1.class2
 * @param { string | Element | Element[] | {
 * 	 parent?: Element,
 *   $?: (el: Element) => void, 
 *   dataset?: DOMStringMap,
 *   style?: CSSStyleDeclaration,
 * 	 for?: string
 * } | undefined } propsOrChildren 
 * @param { Element[] | undefined } [children]
 * @returns 
 */
export function $el(tag, propsOrChildren, children) {
	const split = tag.split(".");
	const element = document.createElement(split.shift());
	if (split.length > 0) {
		element.classList.add(...split);
	}

	if (propsOrChildren) {
		if (typeof propsOrChildren === "string") {
			propsOrChildren = { textContent: propsOrChildren };
		} else if (propsOrChildren instanceof Element) {
			propsOrChildren = [propsOrChildren];
		}
		if (Array.isArray(propsOrChildren)) {
			element.append(...propsOrChildren);
		} else {
			const {parent, $: cb, dataset, style} = propsOrChildren;
			delete propsOrChildren.parent;
			delete propsOrChildren.$;
			delete propsOrChildren.dataset;
			delete propsOrChildren.style;

			if (Object.hasOwn(propsOrChildren, "for")) {
				element.setAttribute("for", propsOrChildren.for)
			}

			if (style) {
				Object.assign(element.style, style);
			}

			if (dataset) {
				Object.assign(element.dataset, dataset);
			}

			Object.assign(element, propsOrChildren);
			if (children) {
				element.append(...(children instanceof Array ? children : [children]));
			}

			if (parent) {
				parent.append(element);
			}

			if (cb) {
				cb(element);
			}
		}
	}
	return element;
}

function dragElement(dragEl, settings) {
	var posDiffX = 0,
		posDiffY = 0,
		posStartX = 0,
		posStartY = 0,
		newPosX = 0,
		newPosY = 0;
	if (dragEl.getElementsByClassName("drag-handle")[0]) {
		// if present, the handle is where you move the DIV from:
		dragEl.getElementsByClassName("drag-handle")[0].onmousedown = dragMouseDown;
	} else {
		// otherwise, move the DIV from anywhere inside the DIV:
		dragEl.onmousedown = dragMouseDown;
	}

	// When the element resizes (e.g. view queue) ensure it is still in the windows bounds
	const resizeObserver = new ResizeObserver(() => {
		ensureInBounds();
	}).observe(dragEl);

	function ensureInBounds() {
		if (dragEl.classList.contains("comfy-menu-manual-pos")) {
			newPosX = Math.min(document.body.clientWidth - dragEl.clientWidth, Math.max(0, dragEl.offsetLeft));
			newPosY = Math.min(document.body.clientHeight - dragEl.clientHeight, Math.max(0, dragEl.offsetTop));

			positionElement();
		}
	}

	function positionElement() {
		const halfWidth = document.body.clientWidth / 2;
		const anchorRight = newPosX + dragEl.clientWidth / 2 > halfWidth;

		// set the element's new position:
		if (anchorRight) {
			dragEl.style.left = "unset";
			dragEl.style.right = document.body.clientWidth - newPosX - dragEl.clientWidth + "px";
		} else {
			dragEl.style.left = newPosX + "px";
			dragEl.style.right = "unset";
		}

		dragEl.style.top = newPosY + "px";
		dragEl.style.bottom = "unset";

		if (savePos) {
			localStorage.setItem(
				"Comfy.MenuPosition",
				JSON.stringify({
					x: dragEl.offsetLeft,
					y: dragEl.offsetTop,
				})
			);
		}
	}

	function restorePos() {
		let pos = localStorage.getItem("Comfy.MenuPosition");
		if (pos) {
			pos = JSON.parse(pos);
			newPosX = pos.x;
			newPosY = pos.y;
			positionElement();
			ensureInBounds();
		}
	}

	let savePos = undefined;
	settings.addSetting({
		id: "Comfy.MenuPosition",
		name: "Save menu position",
		type: "boolean",
		defaultValue: savePos,
		onChange(value) {
			if (savePos === undefined && value) {
				restorePos();
			}
			savePos = value;
		},
	});

	function dragMouseDown(e) {
		e = e || window.event;
		e.preventDefault();
		// get the mouse cursor position at startup:
		posStartX = e.clientX;
		posStartY = e.clientY;
		document.onmouseup = closeDragElement;
		// call a function whenever the cursor moves:
		document.onmousemove = elementDrag;
	}

	function elementDrag(e) {
		e = e || window.event;
		e.preventDefault();

		dragEl.classList.add("comfy-menu-manual-pos");

		// calculate the new cursor position:
		posDiffX = e.clientX - posStartX;
		posDiffY = e.clientY - posStartY;
		posStartX = e.clientX;
		posStartY = e.clientY;

		newPosX = Math.min(document.body.clientWidth - dragEl.clientWidth, Math.max(0, dragEl.offsetLeft + posDiffX));
		newPosY = Math.min(document.body.clientHeight - dragEl.clientHeight, Math.max(0, dragEl.offsetTop + posDiffY));

		positionElement();
	}

	window.addEventListener("resize", () => {
		ensureInBounds();
	});

	function closeDragElement() {
		// stop moving when mouse button is released:
		document.onmouseup = null;
		document.onmousemove = null;
	}
}

class ComfyList {
	#type;
	#text;
	#reverse;

	constructor(text, type, reverse) {
		this.#text = text;
		this.#type = type || text.toLowerCase();
		this.#reverse = reverse || false;
		this.element = $el("div.comfy-list");
		this.element.style.display = "none";
	}

	get visible() {
		return this.element.style.display !== "none";
	}

	async load() {
		const items = await api.getItems(this.#type);
		this.element.replaceChildren(
			...Object.keys(items).flatMap((section) => [
				$el("h4", {
					textContent: section,
				}),
				$el("div.comfy-list-items", [
					...(this.#reverse ? items[section].reverse() : items[section]).map((item) => {
						// Allow items to specify a custom remove action (e.g. for interrupt current prompt)
						const removeAction = item.remove || {
							name: "Delete",
							cb: () => api.deleteItem(this.#type, item.prompt[1]),
						};
						// @@@ ESPM
						return $el("div", {textContent: item.prompt[0]}, [
							//$el("button", {
							//	textContent: "Load",
							//	onclick: async () => {
							//		await app.loadGraphData(item.prompt[3].extra_pnginfo.workflow);
							//		if (item.outputs) {
							//			app.nodeOutputs = item.outputs;
							//		}
							//	},
							//}),
							//$el("button", {
							//	textContent: removeAction.name,
							//	onclick: async () => {
							//		await removeAction.cb();
							//		await this.update();
							//	},
							//}),
						]);
					}),
				]),
			]),
			$el("div.comfy-list-actions", [
				$el("button", {
					textContent: "Clear " + this.#text,

					// @@@ ESPM
					style: {display: "none"},

					onclick: async () => {
						await api.clearItems(this.#type);
						await this.load();
					},
				}),
				$el("button", {textContent: "Refresh", onclick: () => this.load()}),
			])
		);
	}

	async update() {
		if (this.visible) {
			await this.load();
		}
	}

	async show() {
		this.element.style.display = "block";
		this.button.textContent = "Close";

		await this.load();
	}

	hide() {
		this.element.style.display = "none";
		this.button.textContent = "View " + this.#text;
	}

	toggle() {
		if (this.visible) {
			this.hide();
			return false;
		} else {
			this.show();
			return true;
		}
	}
}

// @@@ ESPM
window.loadPrompt = function (positivePrompt, negativePrompt) {
	try {
		let sampler = null;

		for (let i = 0; i < 2; i++) {
			const nodeType = (i ? "KSamplerAdvanced" : "KSampler");
			sampler = app?.graph?._nodes?.find(n => n.type == nodeType);
			if (!sampler || !sampler.inputs[1] || !sampler.inputs[2] || (typeof sampler.inputs[1].link) !== "number" || (typeof sampler.inputs[2].link) !== "number" || !app.graph.links) {
				if (i) {
					app.ui.dialog.show('<span style="color:var(--input-text)">Não foi possível localizar um nó do tipo KSampler ou KSampler (Advanced) com as entradas positiva e negativa conectadas!</span>');
					return;
				}
			} else {
				break;
			}
		}

		const positiveLink = app.graph.links[sampler.inputs[1].link];
		const negativeLink = app.graph.links[sampler.inputs[2].link];

		let positiveNode;
		if (!positiveLink || !(positiveNode = app.graph._nodes.find(n => n.id == positiveLink.origin_id))?.widgets[0]) {
			app.ui.dialog.show('<span style="color:var(--input-text)">Não foi possível localizar um nó conectado à entrada positiva do sampler!</span>');
			return;
		}

		let negativeNode;
		if (!negativeLink || !(negativeNode = app.graph._nodes.find(n => n.id == negativeLink.origin_id))?.widgets[0]) {
			app.ui.dialog.show('<span style="color:var(--input-text)">Não foi possível localizar um nó conectado à entrada negativa do sampler!</span>');
			return;
		}

		positiveNode.widgets[0].value = positivePrompt;
		if (positiveNode.widgets[1])
			positiveNode.widgets[1].value = "-";

		negativeNode.widgets[0].value = negativePrompt;
		if (negativeNode.widgets[1])
			negativeNode.widgets[1].value = "-";

		app.ui.dialog.close();
	} catch (ex) {
		app.ui.dialog.show(`<span style="color:var(--input-text)">${ex.message}</span>`);
	}
};

export class ComfyUI {
	constructor(app) {
		this.app = app;
		this.dialog = new ComfyDialog();
		this.settings = new ComfySettingsDialog(app);

		this.batchCount = 1;
		this.lastQueueSize = 0;
		this.queue = new ComfyList("Queue");
		this.history = new ComfyList("History", "history", true);

		api.addEventListener("status", () => {
			this.queue.update();
			this.history.update();
		});

		const confirmClear = this.settings.addSetting({
			id: "Comfy.ConfirmClear",
			name: "Require confirmation when clearing workflow",
			type: "boolean",
			defaultValue: true,
		});

		const promptFilename = this.settings.addSetting({
			id: "Comfy.PromptFilename",
			name: "Prompt for filename when saving workflow",
			type: "boolean",
			defaultValue: true,
		});

		/**
		 * file format for preview
		 *
		 * format;quality
		 *
		 * ex)
		 * webp;50 -> webp, quality 50
		 * jpeg;80 -> rgb, jpeg, quality 80
		 *
		 * @type {string}
		 */
		const previewImage = this.settings.addSetting({
			id: "Comfy.PreviewFormat",
			name: "When displaying a preview in the image widget, convert it to a lightweight image, e.g. webp, jpeg, webp;50, etc.",
			type: "text",
			defaultValue: "",
		});

		this.settings.addSetting({
			id: "Comfy.DisableSliders",
			name: "Disable sliders.",
			type: "boolean",
			defaultValue: false,
		});

		this.settings.addSetting({
			id: "Comfy.DisableFloatRounding",
			name: "Disable rounding floats (requires page reload).",
			type: "boolean",
			defaultValue: false,
		});

		this.settings.addSetting({
			id: "Comfy.FloatRoundingPrecision",
			name: "Decimal places [0 = auto] (requires page reload).",
			type: "slider",
			attrs: {
				min: 0,
				max: 6,
				step: 1,
			},
			defaultValue: 0,
		});

		// @@@ ESPM
		let fileInputProcessing = false;

		const fileInput = $el("input", {
			id: "comfy-file-input",
			type: "file",
			accept: ".json,image/png,.latent,.safetensors,image/webp",
			style: {display: "none"},
			parent: document.body,

			// @@@ ESPM
			onchange: async () => {
				if (!fileInput.value)
					return;
				if (!fileInputProcessing) {
					fileInputProcessing = true;
					try {
						await app.handleFile(fileInput.files[0]);
					} catch (error) {
						console.error(error);
					}
					fileInputProcessing = false;
				}
				fileInput.value = "";
			},
		});

		const autoQueueModeEl = toggleSwitch(
			"autoQueueMode",
			[
				{ text: "instant", tooltip: "A new prompt will be queued as soon as the queue reaches 0" },
				{ text: "change", tooltip: "A new prompt will be queued when the queue is at 0 and the graph is/has changed" },
			],
			{
				onChange: (value) => {
					this.autoQueueMode = value.item.value;
				},
			}
		);
		autoQueueModeEl.style.display = "none";

		api.addEventListener("graphChanged", () => {
			if (this.autoQueueMode === "change" && this.autoQueueEnabled === true) {
				if (this.lastQueueSize === 0) {
					this.graphHasChanged = false;
					app.queuePrompt(0, this.batchCount);
				} else {
					this.graphHasChanged = true;
				}
			}
		});

		this.menuContainer = $el("div.comfy-menu", {parent: document.body}, [
			$el("div.drag-handle", {
				style: {
					overflow: "hidden",
					position: "relative",
					width: "100%",
					cursor: "default"
				}
			}, [
				$el("span.drag-handle"),
				$el("span", {$: (q) => (this.queueSize = q)}),
				$el("button.comfy-settings-btn", {
					// @@@ ESPM
					style: {display: "none"},
					textContent: "⚙️", onclick: () => this.settings.show()
				}),
			]),
			$el("button.comfy-queue-btn", {
				id: "queue-button",
				textContent: "Queue Prompt",
				onclick: () => app.queuePrompt(0, this.batchCount),
			}),
			$el("div", {
				// @@@ ESPM
				style: {display: "none"},
			}, [
				$el("label", {innerHTML: "Extra options"}, [
					$el("input", {
						type: "checkbox",
						onchange: (i) => {
							document.getElementById("extraOptions").style.display = i.srcElement.checked ? "block" : "none";
							this.batchCount = i.srcElement.checked ? document.getElementById("batchCountInputRange").value : 1;
							document.getElementById("autoQueueCheckbox").checked = false;
							this.autoQueueEnabled = false;
						},
					}),
				]),
			]),
			$el("div", {id: "extraOptions", style: {width: "100%", display: "none"}}, [
				$el("div",[

					$el("label", {innerHTML: "Batch count"}),
					$el("input", {
						id: "batchCountInputNumber",
						type: "number",
						value: this.batchCount,
						min: "1",
						style: {width: "35%", "margin-left": "0.4em"},
						oninput: (i) => {
							this.batchCount = i.target.value;
							document.getElementById("batchCountInputRange").value = this.batchCount;
						},
					}),
					$el("input", {
						id: "batchCountInputRange",
						type: "range",
						min: "1",
						max: "100",
						value: this.batchCount,
						oninput: (i) => {
							this.batchCount = i.srcElement.value;
							document.getElementById("batchCountInputNumber").value = i.srcElement.value;
						},
					}),		
				]),
				$el("div",[
					$el("label",{
						for:"autoQueueCheckbox",
						innerHTML: "Auto Queue"
					}),
					$el("input", {
						id: "autoQueueCheckbox",
						type: "checkbox",
						checked: false,
						title: "Automatically queue prompt when the queue size hits 0",
						onchange: (e) => {
							this.autoQueueEnabled = e.target.checked;
							autoQueueModeEl.style.display = this.autoQueueEnabled ? "" : "none";
						}
					}),
					autoQueueModeEl
				])
			]),
			$el("div.comfy-menu-btns", [
				$el("button", {
					id: "queue-front-button",
					textContent: "Queue Front",

					// @@@ ESPM
					style: {display: "none"},

					onclick: () => app.queuePrompt(-1, this.batchCount)
				}),
				$el("button", {
					$: (b) => (this.queue.button = b),
					id: "comfy-view-queue-button",
					textContent: "View Queue",
					onclick: () => {
						this.history.hide();
						this.queue.toggle();
					},
				}),
				$el("button", {
					$: (b) => (this.history.button = b),
					id: "comfy-view-history-button",
					textContent: "View History",

					// @@@ ESPM
					style: {display: "none"},

					onclick: () => {
						this.queue.hide();
						this.history.toggle();
					},
				}),
			]),
			this.queue.element,
			this.history.element,
			$el("button", {
				id: "comfy-save-button",
				textContent: "Save",
				onclick: () => {
					let filename = "workflow.json";
					if (promptFilename.value) {
						filename = prompt("Save workflow as:", filename);
						if (!filename) return;
						if (!filename.toLowerCase().endsWith(".json")) {
							filename += ".json";
						}
					}
					app.graphToPrompt().then(p=>{
						const json = JSON.stringify(p.workflow, null, 2); // convert the data to a JSON string
						const blob = new Blob([json], {type: "application/json"});
						const url = URL.createObjectURL(blob);
						const a = $el("a", {
							href: url,
							download: filename,
							style: {display: "none"},
							parent: document.body,
						});
						a.click();
						setTimeout(function () {
							a.remove();
							window.URL.revokeObjectURL(url);
						}, 0);
					});
				},
			}),
			$el("button", {
				id: "comfy-dev-save-api-button",
				textContent: "Save (API Format)",
				style: {width: "100%", display: "none"},
				onclick: () => {
					let filename = "workflow_api.json";
					if (promptFilename.value) {
						filename = prompt("Save workflow (API) as:", filename);
						if (!filename) return;
						if (!filename.toLowerCase().endsWith(".json")) {
							filename += ".json";
						}
					}
					app.graphToPrompt().then(p=>{
						const json = JSON.stringify(p.output, null, 2); // convert the data to a JSON string
						const blob = new Blob([json], {type: "application/json"});
						const url = URL.createObjectURL(blob);
						const a = $el("a", {
							href: url,
							download: filename,
							style: {display: "none"},
							parent: document.body,
						});
						a.click();
						setTimeout(function () {
							a.remove();
							window.URL.revokeObjectURL(url);
						}, 0);
					});
				},
			}),
			$el("button", {id: "comfy-load-button", textContent: "Load", onclick: () => fileInput.click()}),
			$el("button", {
				id: "comfy-refresh-button",
				textContent: "Refresh",
				onclick: () => app.refreshComboInNodes()
			}),
			$el("button", {id: "comfy-clipspace-button", textContent: "Clipspace", onclick: () => app.openClipspace()}),
			$el("button", {
				id: "comfy-clear-button", textContent: "Clear", onclick: () => {
					if (!confirmClear.value || confirm("Clear workflow?")) {
						app.clean();
						app.graph.clear();
					}
				}
			}),
			$el("button", {
				id: "comfy-load-default-button", textContent: "Load Default", onclick: async () => {
					if (!confirmClear.value || confirm("Load default workflow?")) {
						await app.loadGraphData()
					}
				}
			}),

			// @@@ ESPM
			$el("div"),

			$el("button", {
				textContent: "Dicas e Estilos", onclick: async () => {
					app.ui.dialog.show(`<span style="color:var(--input-text)"><b>DICAS GERAIS</b>

					Procure utilizar as seguintes combinações de largura x altura para gerar as imagens da melhor forma possível:

					- 1024 x 1024 (quadrado)
					- 896 x 1152 (retrato)
					- 1152 x 896 (paisagem)
					- 1024 x 2048 (retrato ultra wide - evite utilizar com humanos!)
					- 2048 x 1024 (paisagem ultra wide - evite utilizar com humanos!)

					<hr />
					<b>CONFIGURAÇÕES IDEAIS POR MODELO</b>

					artium_v20
					juggernautXL_v7Rundiffusion
					omnium_v11
					realvisxlV30Turbo_v30Bakedvae
					realvisxlV40_v40Bakedvae
					tamarinXL_v10
					- steps: 20 ... 40 (mas o sistema limita em 25, por desempenho 😅)
					- sampler_name: dpmpp_2m (ou outros samplers)
					- scheduler: karras (ou outros schedulers)

					dreamshaperXL_turboDpmppSDE
					- cfg: 2
					- steps: 4 ... 8
					- sampler_name: dpmpp_sde
					- scheduler: karras

					<hr />
					<b>NÃO SABE POR ONDE COMEÇAR O PROMPT?</b>

					Experimente utilizar alguns dos prompts abaixo como ponto de partida! 😊

					Basta clicar nos botões para preencher os campos dos prompts positivo e negativo com as sugestões.

					Em seguida, troque a palavra PROMPT pela expressão desejada (Cuidado para não excluir o ponto final que vem depois da palavra!).

					Por fim, edite o restante dos prompts positivo e negativo conforme desejar.

					Cuidado! Nem todo prompt/assunto funciona bem com todo estilo! É preciso testar! 😅

					<b>ESTILOS PRINCIPAIS</b>

					<div style="display: flex; flex-wrap: wrap; flex-direction: row; justify-content: space-evenly; align-items: stretch;">
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('professional 3d model PROMPT. octane render, highly detailed, volumetric, dramatic lighting', 'ugly, deformed, noisy, low poly, blurry, painting')">3D Model</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('analog film photo PROMPT. faded film, desaturated, 35mm photo, grainy, vignette, vintage, Kodachrome, Lomography, stained, highly detailed, found footage', 'painting, drawing, illustration, glitch, deformed, mutated, cross-eyed, ugly, disfigured')">Analog Film</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('anime artwork PROMPT. anime style, key visual, vibrant, studio anime, highly detailed', 'photo, deformed, black and white, realism, disfigured, low contrast')">Anime</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. candy land style, whimsical fantasy landscape art, japanese pop surrealism, colorfull digital fantasy art, made of candy and lollypops, whimsical and dreamy', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Candy Land</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('cinematic film still PROMPT. shallow depth of field, vignette, highly detailed, high budget Hollywood movie, bokeh, cinemascope, moody, epic, gorgeous, film grain, grainy', 'anime, cartoon, graphic, text, painting, crayon, graphite, abstract, glitch, deformed, mutated, ugly, disfigured')">Cinematic</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('comic PROMPT. graphic illustration, comic art, graphic novel art, vibrant, highly detailed', 'photograph, deformed, glitch, noisy, realistic, stock photo')">Comic Book</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('play-doh style PROMPT. sculpture, clay art, centered composition, Claymation', 'sloppy, messy, grainy, highly detailed, ultra textured, photo')">Craft Clay</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('concept art PROMPT. digital artwork, illustrative, painterly, matte painting, highly detailed', 'photo, photorealistic, realism, ugly')">Digital Art</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. disney animation, disney splash art, disney color palette, disney renaissance film, disney pixar movie still, disney art style, disney concept art, wonderful compositions, pixar, disney concept artists, 2d character design', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Disney</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('breathtaking PROMPT. award-winning, professional, highly detailed', 'ugly, deformed, noisy, blurry, distorted, grainy')">Enhance</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('ethereal fantasy concept art of PROMPT. magnificent, celestial, ethereal, painterly, epic, majestic, magical, fantasy art, cover art, dreamy', 'photographic, realistic, realism, 35mm film, dslr, cropped, frame, text, deformed, glitch, noise, noisy, off-center, deformed, cross-eyed, closed eyes, bad anatomy, ugly, disfigured, sloppy, duplicate, mutated, black and white')">Fantasy Art</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('isometric style PROMPT. vibrant, beautiful, crisp, detailed, ultra detailed, intricate', 'deformed, mutated, ugly, disfigured, blur, blurry, noise, noisy, realistic, photographic')">Isometric</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('line art drawing PROMPT. professional, sleek, modern, minimalist, graphic, line art, vector graphics', 'anime, photorealistic, 35mm film, deformed, glitch, blurry, noisy, off-center, deformed, cross-eyed, closed eyes, bad anatomy, ugly, disfigured, mutated, realism, realistic, impressionism, expressionism, oil, acrylic')">Line Art</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('low-poly style PROMPT. low-poly game art, polygon mesh, jagged, blocky, wireframe edges, centered composition', 'noisy, sloppy, messy, grainy, highly detailed, ultra textured, photo')">Lowpoly</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. minecraft build, style of minecraft, pixel style, 8 bit, epic, cinematic, screenshot from minecraft, detailed natural lighting, minecraft gameplay, mojang, minecraft mods, minecraft in real life, blocky like minecraft', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Minecraft</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('neonpunk style PROMPT. cyberpunk, vaporwave, neon, vibes, vibrant, stunningly beautiful, crisp, detailed, sleek, ultramodern, magenta highlights, dark purple shadows, high contrast, cinematic, ultra detailed, intricate, professional', 'painting, drawing, illustration, glitch, deformed, mutated, cross-eyed, ugly, disfigured')">Neonpunk</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('origami style PROMPT. paper art, pleated paper, folded, origami art, pleats, cut and fold, centered composition', 'noisy, sloppy, messy, grainy, highly detailed, ultra textured, photo')">Origami</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('cinematic photo PROMPT. 35mm photograph, film, bokeh, professional, 4k, highly detailed', 'drawing, painting, crayon, sketch, graphite, impressionist, noisy, blurry, soft, deformed, ugly')">Photographic</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('pixel-art PROMPT. low-res, blocky, pixel art style, 8-bit graphics', 'sloppy, messy, blurry, noisy, highly detailed, ultra textured, photo, realistic')">Pixel Art</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. psychedelic painting, psychedelic dripping colors, colorful detailed projections, android jones and chris dyer, psychedelic vibrant colors, intricate psychedelic patterns, psychedelic visuals, hallucinatory art', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Psychedelic</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('texture PROMPT. top down, close-up', 'ugly, deformed, noisy, blurry')">Texture</button>
					</div>
					<b>ESTILOS ADICIONAIS</b>

					<div style="display: flex; flex-wrap: wrap; flex-direction: row; justify-content: space-evenly; align-items: stretch;">
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. amazonian cave, landscape, jungle, waterfall, moss-covered ancient ruins, Dramatic lighting and intense colors, mesmerizing details of the environment and breathtaking atmosphere', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Amazonian</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. clay animation, as a claymation character, claymation style, animation key shot, plasticine, clay animation, stopmotion animation, aardman character design, plasticine models', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Claymation</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. sci-fi world, cybernetic civilizations, peter gric and dan mumford, brutalist dark futuristic, dystopian brutalist atmosphere, dark dystopian world, cinematic 8k, end of the world, doomsday', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Dystopian</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. elven lifestyle, photoreal, realistic, 32k quality, crafted by Elves and engraved in copper, elven fantasy land, hyper detailed', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Elven</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. fire elements, fantasy, fire, lava, striking. A majestic composition with fire elements, fire and ashes surrounding, highly detailed and realistic, cinematic lighting', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Fire<br/>Bender</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. forestpunk, vibrant, HDRI, organic motifs and pollen in the air, bold vibrant colors and textures, spectacular sparkling rays, photorealistic quality with Hasselblad', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Forestpunk</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. inside glass ball, translucent sphere, cgsociety 9, glass orb, behance, polished, beautiful digital artwork, exquisite digital art, in a short round glass vase, octane render', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Glass<br/>Ball</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. gta iv art style, gta art, gta loading screen art, gta chinatowon art style, gta 5 loading screen poster, grand theft auto 5, grand theft auto video game', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">GTA</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. horror cgi 4k, scary color art in 4k, horror movie cinematography, insidious, la llorona, still from animated horror movie, film still from horror movie, haunted, eerie, unsettling, creepy', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Haunted</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. single vector graphics icon, ios icon, smooth shape, vector', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Icon</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. in square glass case, glass cube, glowing, knolling case, ash thorp, studio background, desktopography, cgsociety 9, cgsociety, mind-bending digital art', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Knoling<br/>Case</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. creative logo, unique logo, visual identity, geometric type, graphic design, logotype design, brand identity, vector based, trendy typography, best of behance', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Logo</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. movie still from game of thrones, powerful fantasy epic, middle ages, lush green landscape, olden times, roman empire, 1400 ce, highly detailed background, cinematic lighting, 8k render, high quality, bright colours', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Medieval</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. neon art style, night time dark with neon colors, blue neon lighting, violet and aqua neon lights, blacklight neon colors, rococo cyber neon lighting', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Neon</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. polygonal art, layered paper art, paper origami, wonderful compositions, folded geometry, paper craft, made from paper', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Origami</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. layered paper art, paper modeling art, paper craft, paper art, papercraft, paper cutout, paper cut out collage artwork, paper cut art', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Papercut<br/>Style</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. product photo studio lighting, high detail product photo, product photography, commercial product photography, realistic, light, 8k, award winning product photography, professional closeup', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Product<br/>Photography</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. samurai lifesyle, miyamoto musashi, Japanese art, ancient japanese samurai, feudal japan art, feudal japan art', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Samurai</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. shamrock fantasy, fantasy, vivid colors, grapevine, celtic fantasy art, lucky clovers, dreamlike atmosphere, captivating details, soft light and vivid colors', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Shamrock<br/>Fantasy</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. intricate wiccan spectrum, stained glass art, vividly beautiful colors, beautiful stained glass window, colorful image, intricate stained glass triptych, gothic stained glass style, stained glass window', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Stained<br/>Glass</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. sticker, sticker art, symmetrical sticker design, sticker - art, sticker illustration, die - cut sticker', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Sticker</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. viking era, digital painting, pop of colour, forest, paint splatter, flowing colors, Background of lush forest and earthy tones, Artistic representation of movement and atmosphere', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Vibrant<br/>Viking</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. water elements, fantasy, water, exotic. A majestic composition with water elements, waterfall, lush moss and exotic flowers, highly detailed and realistic, dynamic lighting', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Water<br/>Bender</button>
						<button type="button" style="display: block; width: 30%; word-break: break-all;" onclick="loadPrompt('PROMPT. cute, c4d, made out of wool, volumetric wool felting, wool felting art, houdini sidefx, rendered in arnold, soft smooth lighting, soft pastel colors', 'lowres, low resolution, bad quality, ugly, deformed, noisy, blurry')">Woolitize</button>
					</div>
					<hr />
					Referência: <a style="color:var(--input-text)" target="_blank" href="https://www.reddit.com/r/StableDiffusion/comments/15afvnb/sdxl_various_styles_keywords/">SDXL Various Styles Keywords</a>`);
				}
			}),

			$el("button", {
				id: "comfy-platform-button", textContent: "Sistema", onclick: async () => {
					window.open(window.api_base + "/");
				}
			}),

			$el("button", {
				id: "comfy-about-button", textContent: "Aviso", onclick: async () => {
					app.ui.dialog.show(`<span style="color:var(--input-text)"><b>AVISO IMPORTANTE</b>

					Diversos cuidados foram tomados para dificultar a geração de imagens com temas sensíveis ou inapropriados.

					Contudo, acredita-se que a plataforma ainda não seja 100% segura devido à enorme complexidade e grandeza dos modelos de IA utilizados.

					Assim, ao utilizar esta plataforma, você se responsabiliza por todas as imagens que você gerar.

					Os modelos de IA utilizados dentro da plataforma são gratuitos, publicamente disponíveis para download, e de responsabilidade dos respectivos autores. Consulte a licença de cada modelo sobre o uso público/comercial das imagens geradas.

					A ESPM <b>não se responsabiliza</b> por qualquer tipo de imagem gerada contendo conteúdo sensível, inapropriado, censurado, enviesado, ofensivo, falso, violento, que infrinja alguma lei ou direito autoral, ou de qualquer outra natureza que possa ser inadequada para alguma faixa etária ou que seja ofensivo a qualquer pessoa.

					Todas as imagens geradas por meio da plataforma são armazenadas, juntamente com seus prompts, ficando associadas aos usuários que as geraram.

					<b>Ao utilizar a plataforma você concorda que leu e que esteja de acordo com tudo descrito aqui</b>.

					<hr />

					<b>MODELOS DISPONIBILIZADOS</b>

					artium_v20 - <a style="color: inherit;" target="_blank" href="https://civitai.com/models/216439">https://civitai.com/models/216439</a>

					dreamshaperXL_turboDpmppSDE - <a style="color: inherit;" target="_blank" href="https://civitai.com/models/112902">https://civitai.com/models/112902</a>

					juggernautXL_v7Rundiffusion - <a style="color: inherit;" target="_blank" href="https://civitai.com/models/133005">https://civitai.com/models/133005</a>

					minecraft - <a style="color: inherit;" target="_blank" href="https://civitai.com/models/210380">https://civitai.com/models/210380</a>

					omnium_v11 - <a style="color: inherit;" target="_blank" href="https://civitai.com/models/194245">https://civitai.com/models/194245</a>

					realvisxlV30Turbo_v30Bakedvae - <a style="color: inherit;" target="_blank" href="https://civitai.com/models/139562">https://civitai.com/models/139562</a>

					realvisxlV40_v40Bakedvae - <a style="color: inherit;" target="_blank" href="https://civitai.com/models/139562">https://civitai.com/models/139562</a>

					tamarinXL_v10 - <a style="color: inherit;" target="_blank" href="https://civitai.com/models/235746">https://civitai.com/models/235746</a>

					<hr />

					A geração de imagens se baseia no projeto <a style="color: inherit;" target="_blank" href="https://github.com/comfyanonymous/ComfyUI">ComfyUI</a>, licenciado sob a <a style="color: inherit;" target="_blank" href="https://github.com/comfyanonymous/ComfyUI/blob/master/LICENSE">GPL-3.0</a>.

					A edição de poses se baseia no projeto <a style="color: inherit;" target="_blank" href="https://github.com/space-nuko/ComfyUI-OpenPose-Editor">ComfyUI-OpenPose-Editor</a>.

					A plataforma é composta pelos projetos <a style="color: inherit;" target="_blank" href="https://github.com/tech-espm/ComfyUI/tree/espm">ComfyUI</a>, <a style="color: inherit;" target="_blank" href="https://github.com/tech-espm/ComfyUI-Proxy">ComfyUI-Proxy</a>, <a style="color: inherit;" target="_blank" href="https://github.com/tech-espm/ComfyUI-WSProxy">ComfyUI-WSProxy</a> e <a style="color: inherit;" target="_blank" href="https://github.com/tech-espm/ComfyUI-CLIP">ComfyUI-CLIP</a>, todos licenciados sob a <a style="color: inherit;" target="_blank" href="https://github.com/tech-espm/ComfyUI-Proxy/blob/main/LICENSE">GPL-3.0</a>.</span>`);
				}
			}),
		]);

		// @@@ ESPM
		this.menuContainer.style.paddingTop = "40px";
		const menuToggle = document.createElement("button");
		menuToggle.textContent = "Menu";
		menuToggle.type = "button";
		menuToggle.className = "comfy-btn";
		menuToggle.style.position = "absolute";
		menuToggle.style.zIndex = "1000";
		menuToggle.style.right = "10px";
		menuToggle.style.top = "10px";
		menuToggle.style.margin = "0";
		menuToggle.onclick = () => {
			this.menuContainer.style.display = ((this.menuContainer.style.display === "none") ? "" : "none");
		};
		document.body.appendChild(menuToggle);
		this.menuContainer.children[this.menuContainer.children.length - 4].style.flex = "1 1 auto";

		const devMode = this.settings.addSetting({
			id: "Comfy.DevMode",
			name: "Enable Dev mode Options",
			type: "boolean",
			defaultValue: false,

			// @@@ ESPM
			onChange: function(value) { (app.canvas && (app.canvas.show_info = value)); document.getElementById("comfy-dev-save-api-button").style.display = value ? "block" : "none"},
		});

		dragElement(this.menuContainer, this.settings);

		this.setStatus({exec_info: {queue_remaining: "X"}});
	}

	setStatus(status) {
		this.queueSize.textContent = "Queue size: " + (status ? status.exec_info.queue_remaining : "ERR");
		if (status) {
			if (
				this.lastQueueSize != 0 &&
				status.exec_info.queue_remaining == 0 &&
				this.autoQueueEnabled &&
				(this.autoQueueMode === "instant" || this.graphHasChanged) &&
				!app.lastExecutionError
			) {
				app.queuePrompt(0, this.batchCount);
				status.exec_info.queue_remaining += this.batchCount;
				this.graphHasChanged = false;
			}
			this.lastQueueSize = status.exec_info.queue_remaining;
		}
	}
}
