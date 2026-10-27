/** CPF/CNPJ mascarado em listas (M06): mantém só os 4 últimos caracteres. */
export function maskDoc(doc: string): string {
  return doc.replace(/\d(?=[\d.\-/]{4})/g, "•");
}
