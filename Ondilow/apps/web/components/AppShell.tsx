import { Sidebar } from "@/components/Sidebar";

/** Shell autenticado: navegacao + area de conteudo responsiva. Usado por todos os layouts internos. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="od-app min-h-screen">
      <a href="#conteudo" className="od-skip-link">Pular para o conteúdo</a>
      <Sidebar />
      {/* Cada pagina ja renderiza seu proprio <main> (PageContainer); este wrapper e so o alvo do skip-link. */}
      <div id="conteudo" tabIndex={-1} className="min-w-0 pb-20 outline-none md:ml-[76px] md:pb-0 lg:ml-60">{children}</div>
    </div>
  );
}
