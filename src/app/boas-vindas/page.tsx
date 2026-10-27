import { redirect } from "next/navigation";

// Rota do prompt (/boas-vindas); o checklist vive dentro do app para ter navegação e sessão.
export default function BoasVindas() {
  redirect("/app/boas-vindas");
}
