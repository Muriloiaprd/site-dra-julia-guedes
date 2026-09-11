import { Sidebar } from "@/components/Sidebar";

/** Shell autenticado: navegacao + area de conteudo responsiva. Usado por todos os layouts internos. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="od-app min-h-screen">
      <Sidebar />
      <div className="min-w-0 pb-20 md:ml-[76px] md:pb-0 lg:ml-60">{children}</div>
    </div>
  );
}
