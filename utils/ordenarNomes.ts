function comparadorNome(a: any, b: any): number {
	return (a.nome || "").localeCompare(b.nome || "");
}

export = function ordenarNomes<T>(lista: T[]): T[] {
	if (!lista || !lista.length)
		return lista;
	lista.sort(comparadorNome);
	return lista;
}
