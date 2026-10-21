import { redirect } from "next/navigation";

/** Importar virou uma seção do Perfil; o endereço antigo continua valendo. */
export default function ImportPage() {
  redirect("/profile?aba=importar");
}
