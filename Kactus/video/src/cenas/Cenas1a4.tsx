import React from 'react';
import {Beto} from '../personagens/Beto';
import {COR, FONTE, FONTE_MAO, TRACO} from '../tema';
import {Balao} from '../ui/Balao';
import {Celular, LogoKactus, Monitor, OlhosObjeto, Plaquinha} from '../ui/Objetos';
import {Papel} from '../ui/Papel';

// Cozinha: parede, janela, chão. Reaproveitada nas cenas 1 e 2.
export const Cozinha: React.FC = () => (
	<g>
		<rect x={0} y={0} width={1920} height={800} fill={COR.parede} />
		<rect x={0} y={800} width={1920} height={280} fill="#E3D9C3" />
		<path d="M 0 800 L 1920 800" {...TRACO} />
		<rect x={1340} y={140} width={380} height={300} fill="#BFE6FF" {...TRACO} />
		<path d="M 1530 140 L 1530 440 M 1340 290 L 1720 290" {...TRACO} />
		<circle cx={1420} cy={210} r={34} fill={COR.amarelo} stroke={COR.tinta} strokeWidth={4} />
		<path d="M 200 220 L 420 220" {...TRACO} />
		<rect x={230} y={150} width={50} height={70} rx={10} fill={COR.vermelho} {...TRACO} strokeWidth={4} />
		<rect x={300} y={130} width={44} height={90} rx={10} fill={COR.amarelo} {...TRACO} strokeWidth={4} />
	</g>
);

export const Cena01: React.FC = () => (
	<Papel
		limpo={<Balao x={330} y={160} w={440} linhas={['Tá... e agora?']} px={760} py={330} tamanho={46} />}
	>
		<Cozinha />
		{/* banco estofado atrás */}
		<rect x={600} y={380} width={720} height={330} rx={60} fill={COR.estofado} {...TRACO} />
		<rect x={560} y={600} width={800} height={190} rx={40} fill={COR.estofadoEscuro} {...TRACO} />
		<Beto x={960} y={720} escala={1.2} sentado pose="relogio" relogio suor boca="preocupada" olhar={[-8, 10]} sobrancelha="triste" />
		{/* gota caindo em câmera lenta no relógio */}
		<path d="M 990 455 q -14 24 0 32 q 14 -8 0 -32 Z" fill={COR.azul} stroke={COR.tinta} strokeWidth={3} />
		<path d="M 1016 440 l 0 26 M 1030 455 l 0 18" stroke={COR.tinta} strokeWidth={3} strokeLinecap="round" />
		{/* mesa */}
		<polygon points="500,640 1420,640 1480,705 440,705" fill={COR.madeira} {...TRACO} />
		<rect x={440} y={705} width={1040} height={32} fill={COR.madeiraEscura} {...TRACO} />
		<rect x={930} y={737} width={60} height={250} fill={COR.madeiraEscura} {...TRACO} />
		<ellipse cx={960} cy={990} rx={150} ry={26} fill={COR.madeiraEscura} {...TRACO} />
		{/* garrafinha e banana na mesa */}
		<rect x={600} y={560} width={46} height={100} rx={14} fill="#9AD8FF" {...TRACO} strokeWidth={4} />
		<rect x={610} y={540} width={26} height={24} rx={6} fill={COR.azul} {...TRACO} strokeWidth={4} />
		<path d="M 1240 650 q 60 20 110 -30 q -40 60 -110 50 Z" fill={COR.amarelo} {...TRACO} strokeWidth={4} />
		<text x={1150} y={590} fontFamily={FONTE_MAO} fontSize={40} fill={COR.tinta} transform="rotate(-6 1150 590)">
			10,0 km!
		</text>
	</Papel>
);

export const Cena02: React.FC = () => (
	<Papel>
		<Cozinha />
		<Beto x={960} y={640} escala={0.95} pose="desespero" boca="dor" sobrancelha="triste" olhar={[0, -6]} />
		{/* relógio bravo */}
		<g transform="rotate(-10 420 330)">
			<rect x={385} y={180} width={70} height={300} rx={26} fill={COR.tinta} />
			<circle cx={420} cy={330} r={95} fill="#333" {...TRACO} />
			<circle cx={420} cy={330} r={72} fill={COR.neon} {...TRACO} strokeWidth={4} />
			<OlhosObjeto x={420} y={318} r={18} bravo />
			<path d="M 398 365 q 22 -14 44 0" fill="none" {...TRACO} />
		</g>
		{/* caderno */}
		<g transform="rotate(8 420 760)">
			<rect x={300} y={640} width={250} height={300} rx={10} fill="#FFE9A8" {...TRACO} />
			{[690, 730, 770, 810, 850, 890].map((yy) => (
				<path key={yy} d={`M 330 ${yy} L 520 ${yy}`} stroke={COR.azul} strokeWidth={3} />
			))}
			<OlhosObjeto x={425} y={720} r={20} bravo olhar={[6, 0]} />
			<ellipse cx={425} cy={800} rx={30} ry={20} fill={COR.tinta} />
		</g>
		{/* planilha pegando fogo */}
		<g transform="rotate(6 1480 330)">
			<path d="M 1400 150 q 30 -70 60 -10 q 20 -80 60 0 q 40 -60 50 30 Z" fill="#FF8A2B" {...TRACO} strokeWidth={4} />
			<path d="M 1430 160 q 25 -40 45 -5 q 20 -50 45 5 Z" fill={COR.amarelo} />
			<rect x={1350} y={160} width={290} height={340} fill={COR.branco} {...TRACO} />
			{[220, 280, 340, 400, 460].map((yy) => (
				<path key={yy} d={`M 1350 ${yy} L 1640 ${yy}`} stroke="#5BBF6A" strokeWidth={3} />
			))}
			{[1447, 1543].map((xx) => (
				<path key={xx} d={`M ${xx} 160 L ${xx} 500`} stroke="#5BBF6A" strokeWidth={3} />
			))}
			<OlhosObjeto x={1495} y={300} r={20} bravo olhar={[-6, 0]} />
			<ellipse cx={1495} cy={380} rx={26} ry={18} fill={COR.tinta} />
		</g>
		{/* celular com o print */}
		<g transform="rotate(-8 1500 760)">
			<rect x={1410} y={600} width={190} height={340} rx={28} fill="#2E2E2E" {...TRACO} />
			<rect x={1424} y={616} width={162} height={308} rx={18} fill="#DDD" />
			<text x={1505} y={900} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={26} fill={COR.tinta}>
				print_032.png
			</text>
			<OlhosObjeto x={1505} y={720} r={20} bravo olhar={[-6, 0]} />
			<path d="M 1480 800 q 25 -16 50 0" fill="none" {...TRACO} />
		</g>
		{/* raios da briga */}
		<path d="M 600 380 l 40 -20 l -10 30 l 50 -16" fill="none" {...TRACO} stroke={COR.vermelho} strokeWidth={7} />
		<path d="M 1250 420 l 40 -20 l -10 30 l 50 -16" fill="none" {...TRACO} stroke={COR.vermelho} strokeWidth={7} />
		<path d="M 600 820 l 40 -20 l -10 30 l 50 -16" fill="none" {...TRACO} stroke={COR.vermelho} strokeWidth={7} />
		<path d="M 1250 800 l 40 -20 l -10 30 l 50 -16" fill="none" {...TRACO} stroke={COR.vermelho} strokeWidth={7} />
	</Papel>
);

export const Cena03: React.FC = () => (
	<Papel
		limpo={<Balao x={1500} y={150} w={240} linhas={['AI!']} px={1560} py={330} tamanho={70} grito cor={COR.amarelo} />}
	>
		<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
		<Monitor x={330} y={130} w={1150} h={640}>
			<rect width={1150} height={640} fill="#101820" />
			{/* janela do Kactus aberta */}
			<rect x={250} y={90} width={650} height={400} rx={14} fill={COR.tela} stroke={COR.telaBorda} strokeWidth={3} />
			<LogoKactus x={325} y={230} w={500} />
			<text x={575} y={420} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={30} fill={COR.textoTelaFraco}>
				localhost:3003
			</text>
			{/* barra de tarefas com o ícone perto do relógio */}
			<rect x={0} y={580} width={1150} height={60} fill="#1D1D1D" />
			<circle cx={985} cy={610} r={42} fill={COR.neon} opacity={0.25} />
			<circle cx={985} cy={610} r={20} fill={COR.neon} />
			<LogoKactus x={973} y={597} w={24} simbolo />
			<text x={1080} y={621} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={28} fill={COR.textoTela}>
				07:42
			</text>
			<rect x={760} y={500} width={330} height={60} rx={12} fill="#2A2A2A" />
			<text x={925} y={540} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={24} fill={COR.neon}>
				Kactus Controle · Ligado
			</text>
		</Monitor>
		{/* iPhone também abre */}
		<Celular x={110} y={520} w={200} h={400} rot={-8}>
			<rect width={200} height={400} fill={COR.tela} />
			<LogoKactus x={50} y={130} w={100} simbolo />
			<text x={100} y={330} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={22} fill={COR.textoTelaFraco}>
				no iPhone também
			</text>
		</Celular>
		<Beto x={1620} y={800} escala={0.9} pose="abraco" espelhar boca="dor" olhar={[-8, 0]} sobrancelha="triste" />
		{/* coraçõezinhos do abraço */}
		<path d="M 1380 300 c -20 -30 -60 0 0 40 c 60 -40 20 -70 0 -40 Z" fill={COR.vermelho} {...TRACO} strokeWidth={4} />
	</Papel>
);

export const Cena04: React.FC = () => (
	<Papel limpo={<Balao x={110} y={110} w={460} linhas={['Três pontos!']} px={330} py={300} tamanho={46} />}>
		<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
		<Monitor x={880} y={250} w={900} h={500}>
			<text x={40} y={70} fontFamily={FONTE} fontWeight={700} fontSize={30} fill={COR.textoTelaFraco}>
				Perfil › Importar
			</text>
			<rect x={40} y={110} width={820} height={340} rx={24} fill="#0F1A12" stroke={COR.neon} strokeWidth={5} strokeDasharray="22 16" />
			<text x={450} y={270} textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={44} fill={COR.textoTela}>
				Solte o arquivo aqui
			</text>
			<text x={450} y={330} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={30} fill={COR.textoTelaFraco}>
				.fit · .gpx · .tcx · .csv
			</text>
		</Monitor>
		{/* trajetória da bolinha de papel */}
		<path d="M 470 380 Q 860 -20 1250 330" fill="none" stroke={COR.tinta} strokeWidth={5} strokeDasharray="4 18" strokeLinecap="round" />
		<g transform="translate(743 192)">
			<circle r={42} fill={COR.branco} {...TRACO} />
			<path d="M -30 -10 l 20 8 l 12 -20 l 14 22 l 18 -6 M -24 18 l 18 -6 l 16 14 l 14 -10" fill="none" {...TRACO} strokeWidth={3} />
			<text y={70} textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={30} fill={COR.tinta}>
				.fit
			</text>
		</g>
		<Beto x={380} y={760} pose="arremesso" boca="sorriso" olhar={[10, -10]} sobrancelha="alta" />
		{/* plaquinhas cuspidas pelo app */}
		<Plaquinha x={1000} y={160} texto="Ritmo 5:12/km" rot={-8} tamanho={34} />
		<Plaquinha x={1450} y={110} texto="Em movimento 52:10" rot={5} tamanho={34} cor={COR.estofado} />
		<Plaquinha x={1770} y={230} texto="Carga 78" rot={10} tamanho={34} cor={COR.rosa} />
		<Plaquinha x={650} y={800} texto="RECORDE! 5 km" sub="sem contar o pastel" rot={-4} tamanho={40} cor={COR.lima} />
	</Papel>
);
