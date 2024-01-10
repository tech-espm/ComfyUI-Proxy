
export = function converterHorarioLocalISOParaDateTime2(horarioLocalISO: string): Date {
	// O pacote mssql envia para o SQL Server a data UTC do objeto Date. Então, para enviar
	// um horário no fuso local, basta criar um objeto Date fazendo de conta que o horário
	// local, na verdade, é um horário UTC.
	return new Date(horarioLocalISO + " Z");
}
