import React, {createContext, useContext} from 'react';

// Quem está falando agora e quanto a boca abre. O Filme fornece; Beto e Duni leem sozinhos,
// então qualquer cena ganha boca sincronizada sem mexer nela.
export type FalaAtual = {quem: string | null; abertura: number};
const Contexto = createContext<FalaAtual>({quem: null, abertura: 0});

export const FalaProvider: React.FC<{valor: FalaAtual; children: React.ReactNode}> = ({valor, children}) => (
	<Contexto.Provider value={valor}>{children}</Contexto.Provider>
);

// Abertura da boca do personagem `quem`, ou undefined se não é ele quem fala.
export function useBoca(quem: string): number | undefined {
	const atual = useContext(Contexto);
	return atual.quem === quem ? atual.abertura : undefined;
}
