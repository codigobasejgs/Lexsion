// Pessoas exibidas como responsável/autor/atribuído. Demonstração: perfis fictícios. Operação: equipe REAL do escritório (org_team).
// `let` exportado = ligação viva: telas que importaram `people` veem a equipe real depois de setPeople().
import { users } from "@/mocks/fixtures";
import type { User } from "@/domain/types";

export let people: User[] = users;
export function setPeople(list: User[] | null) {
  people = list ?? users;
}
