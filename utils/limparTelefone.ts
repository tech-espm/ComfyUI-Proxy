const regTelefoneLimpo = /[^0-9]/g;

export = function limparTelefone(telefone: string): string {
	return (telefone ? telefone.normalize().replace(regTelefoneLimpo, "") : telefone);
}
