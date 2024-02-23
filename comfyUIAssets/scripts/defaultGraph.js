export const defaultGraph = {
	"last_node_id": 11,
	"last_link_id": 13,
	"nodes": [
		{
			"id": 3,
			"type": "KSampler",
			"pos": [1417, 267],
			"size": {
				"0": 315,
				"1": 262
			},
			"flags": {},
			"order": 6,
			"mode": 0,
			"inputs": [
				{
					"name": "model",
					"type": "MODEL",
					"link": 1
				},
				{
					"name": "positive",
					"type": "CONDITIONING",
					"link": 4
				},
				{
					"name": "negative",
					"type": "CONDITIONING",
					"link": 6
				},
				{
					"name": "latent_image",
					"type": "LATENT",
					"link": 2
				}
			],
			"outputs": [
				{
					"name": "LATENT",
					"type": "LATENT",
					"links": [7],
					"slot_index": 0
				}
			],
			"properties": {
				"Node name for S&R": "KSampler"
			},
			"widgets_values": [156680208700286, "fixed", 20, 7, "dpmpp_2m", "karras", 1]
		},
		{
			"id": 10,
			"type": "CLIPSetLastLayer",
			"pos": [451, 390],
			"size": {
				"0": 315,
				"1": 58
			},
			"flags": {},
			"order": 3,
			"mode": 0,
			"inputs": [
				{
					"name": "clip",
					"type": "CLIP",
					"link": 10
				}
			],
			"outputs": [
				{
					"name": "CLIP",
					"type": "CLIP",
					"links": [11, 12],
					"shape": 3,
					"slot_index": 0
				}
			],
			"properties": {
				"Node name for S&R": "CLIPSetLastLayer"
			},
			"widgets_values": [-1]
		},
		{
			"id": 7,
			"type": "CLIPTextEncode",
			"pos": [840, 486],
			"size": {
				"0": 425.27801513671875,
				"1": 180.6060791015625
			},
			"flags": {},
			"order": 5,
			"mode": 0,
			"inputs": [
				{
					"name": "clip",
					"type": "CLIP",
					"link": 12
				}
			],
			"outputs": [
				{
					"name": "CONDITIONING",
					"type": "CONDITIONING",
					"links": [6],
					"slot_index": 0
				}
			],
			"properties": {
				"Node name for S&R": "CLIPTextEncode"
			},
			"widgets_values": ["text, watermark", "4"]
		},
		{
			"id": 4,
			"type": "CheckpointLoaderSimple",
			"pos": [13, 539],
			"size": [383.3418761490782, 98],
			"flags": {},
			"order": 0,
			"mode": 0,
			"outputs": [
				{
					"name": "MODEL",
					"type": "MODEL",
					"links": [1],
					"slot_index": 0
				},
				{
					"name": "CLIP",
					"type": "CLIP",
					"links": [10],
					"slot_index": 1
				},
				{
					"name": "VAE",
					"type": "VAE",
					"links": [],
					"slot_index": 2
				}
			],
			"properties": {
				"Node name for S&R": "CheckpointLoaderSimple"
			},
			"widgets_values": ["juggernautXL_v7Rundiffusion.safetensors"]
		},
		{
			"id": 8,
			"type": "VAEDecode",
			"pos": [1795, 521],
			"size": {
				"0": 210,
				"1": 46
			},
			"flags": {},
			"order": 7,
			"mode": 0,
			"inputs": [
				{
					"name": "samples",
					"type": "LATENT",
					"link": 7
				},
				{
					"name": "vae",
					"type": "VAE",
					"link": 13
				}
			],
			"outputs": [
				{
					"name": "IMAGE",
					"type": "IMAGE",
					"links": [9],
					"slot_index": 0
				}
			],
			"properties": {
				"Node name for S&R": "VAEDecode"
			}
		},
		{
			"id": 5,
			"type": "EmptyLatentImage",
			"pos": [949, 778],
			"size": {
				"0": 315,
				"1": 106
			},
			"flags": {},
			"order": 1,
			"mode": 0,
			"outputs": [
				{
					"name": "LATENT",
					"type": "LATENT",
					"links": [2],
					"slot_index": 0
				}
			],
			"properties": {
				"Node name for S&R": "EmptyLatentImage"
			},
			"widgets_values": [1024, 1024, 1]
		},
		{
			"id": 11,
			"type": "VAELoader",
			"pos": [1385, 681],
			"size": {
				"0": 315,
				"1": 58
			},
			"flags": {},
			"order": 2,
			"mode": 0,
			"outputs": [
				{
					"name": "VAE",
					"type": "VAE",
					"links": [13],
					"shape": 3,
					"slot_index": 0
				}
			],
			"properties": {
				"Node name for S&R": "VAELoader"
			},
			"widgets_values": ["sdxl_vae.safetensors"]
		},
		{
			"id": 9,
			"type": "SaveImage",
			"pos": [2053, 693],
			"size": {
				"0": 210,
				"1": 58
			},
			"flags": {},
			"order": 8,
			"mode": 0,
			"inputs": [
				{
					"name": "images",
					"type": "IMAGE",
					"link": 9
				}
			],
			"properties": {},
			"widgets_values": ["ComfyUI"]
		},
		{
			"id": 6,
			"type": "CLIPTextEncode",
			"pos": [811, 145],
			"size": {
				"0": 422.84503173828125,
				"1": 164.31304931640625
			},
			"flags": {},
			"order": 4,
			"mode": 0,
			"inputs": [
				{
					"name": "clip",
					"type": "CLIP",
					"link": 11
				}
			],
			"outputs": [
				{
					"name": "CONDITIONING",
					"type": "CONDITIONING",
					"links": [4],
					"slot_index": 0
				}
			],
			"properties": {
				"Node name for S&R": "CLIPTextEncode"
			},
			"widgets_values": ["beautiful scenery nature glass bottle landscape, purple galaxy bottle", "10"]
		}
	],
	"links": [
		[1, 4, 0, 3, 0, "MODEL"],
		[2, 5, 0, 3, 3, "LATENT"],
		[4, 6, 0, 3, 1, "CONDITIONING"],
		[6, 7, 0, 3, 2, "CONDITIONING"],
		[7, 3, 0, 8, 0, "LATENT"],
		[9, 8, 0, 9, 0, "IMAGE"],
		[10, 4, 1, 10, 0, "CLIP"],
		[11, 10, 0, 6, 0, "CLIP"],
		[12, 10, 0, 7, 0, "CLIP"],
		[13, 11, 0, 8, 1, "VAE"]
	],
	"groups": [],
	"config": {},
	"extra": {},
	"version": 0.4
};
