import { redirect } from "next/navigation";

/** Equipamentos virou a sub-aba de Atividades; o endereço antigo continua valendo. */
export default function EquipmentPage() {
  redirect("/activities?aba=equipamentos");
}
