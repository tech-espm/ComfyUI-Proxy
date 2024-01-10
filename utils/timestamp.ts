import DataUtil = require("./dataUtil");

export = class Timestamp {
	public static agora(): number {
		return ((new Date()).getTime() / 1000) | 0;
	}

	public static date(timestamp: number): Date {
		return new Date((timestamp | 0) * 1000);
	}

	public static horarioDeBrasiliaComoDateUTC(timestamp: number): Date {
		return new Date(((timestamp | 0) * 1000) - (180 * 60000));
	}

	public static utcTime(timestamp: number): number {
		return (timestamp | 0) * 1000;
	}

	public static utc(ano: number, mes: number, dia: number, hora?: number, minuto?: number, segundo?: number): number {
		return (Date.UTC(ano, mes - 1, dia, hora || 0, minuto || 0, segundo || 0) / 1000) | 0;
	}

	public static horarioDeBrasilia(ano: number, mes: number, dia: number, hora?: number, minuto?: number, segundo?: number): number {
		return ((Date.UTC(ano, mes - 1, dia, hora || 0, minuto || 0, segundo || 0) + (180 * 60000)) / 1000) | 0;
	}

	public static horarioDeBrasiliaStr(dataEmHorarioDeBrasiliaComOuSemHorario: string | null): number {
		let dataISO = DataUtil.converterDataISO(dataEmHorarioDeBrasiliaComOuSemHorario);
		if (!dataISO)
			return 0;

		if (dataISO.indexOf(":") < 0)
			dataISO += " 00:00:00";

		dataISO += "Z";

		return (((new Date(dataISO)).getTime() + (180 * 60000)) / 1000) | 0;
	}

	public static formatarHorarioDeBrasiliaBr(timestamp: number): string {
		const date = new Date((timestamp * 1000) - (180 * 60000)),
			mes = date.getUTCMonth() + 1,
			dia = date.getUTCDate();

		return ((dia < 10) ? ("0" + dia) : dia) + "/" + ((mes < 10) ? ("0" + mes) : mes) + "/" + date.getUTCFullYear();
	}

	public static formatarHorarioDeBrasiliaBrComHorario(timestamp: number): string {
		const date = new Date((timestamp * 1000) - (180 * 60000)),
			mes = date.getUTCMonth() + 1,
			dia = date.getUTCDate(),
			hora = date.getUTCHours(),
			minuto = date.getUTCMinutes(),
			segundo = date.getUTCSeconds();

		return ((dia < 10) ? ("0" + dia) : dia) + "/" + ((mes < 10) ? ("0" + mes) : mes) + "/" + date.getUTCFullYear() + " " + ((hora < 10) ? ("0" + hora) : hora) + ":" + ((minuto < 10) ? ("0" + minuto) : minuto) + ":" + ((segundo < 10) ? ("0" + segundo) : segundo);
	}
};
