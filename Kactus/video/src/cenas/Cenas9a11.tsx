import React from 'react';
import {Beto} from '../personagens/Beto';
import {Duni} from '../personagens/Duni';
import {COR, FONTE, TRACO} from '../tema';
import {Balao} from '../ui/Balao';
import {Brilho, Celular, LogoKactus, OlhosObjeto, Tenis} from '../ui/Objetos';
import {Papel} from '../ui/Papel';

export const Cena09: React.FC = () => (
	<Papel
		limpo={<Balao x={1220} y={90} w={560} linhas={['ME APOSENTA!']} px={1260} py={420} tamanho={54} grito cor={COR.amarelo} />}
	>
		<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
		{/* prateleira */}
		<rect x={520} y={600} width={1000} height={36} fill={COR.madeira} {...TRACO} />
		<path d="M 600 636 L 640 720 M 1440 636 L 1400 720" {...TRACO} strokeWidth={8} />
		<Tenis x={760} y={600} escala={0.9} />
		<Brilho x={640} y={440} r={24} />
		<Brilho x={880} y={470} r={18} />
		<Tenis x={1220} y={600} escala={1} velho espelhar />
		<OlhosObjeto x={1250} y={520} r={18} bravo olhar={[-4, 0]} />
		<ellipse cx={1200} cy={560} rx={22} ry={16} fill={COR.tinta} />
		{/* contador de km */}
		<rect x={1060} y={340} width={220} height={80} rx={16} fill={COR.tinta} />
		<text x={1170} y={396} textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={44} fill={COR.vermelho}>
			600 km
		</text>
		<Beto x={300} y={780} escala={0.85} pose="parado" boca="o" olhar={[12, -4]} sobrancelha="alta" />
	</Papel>
);

const StoryRota: React.FC<{w: number; h: number}> = ({w, h}) => (
	<g>
		<rect width={w} height={h} fill={COR.tela} />
		<path
			d={`M ${w * 0.2} ${h * 0.7} C ${w * 0.1} ${h * 0.45} ${w * 0.45} ${h * 0.5} ${w * 0.5} ${h * 0.32} S ${w * 0.85} ${h * 0.2} ${w * 0.78} ${h * 0.55} S ${w * 0.4} ${h * 0.75} ${w * 0.2} ${h * 0.7}`}
			fill="none"
			stroke={COR.neon}
			strokeWidth={Math.max(4, w * 0.03)}
			strokeLinecap="round"
		/>
		<circle cx={w * 0.2} cy={h * 0.7} r={w * 0.035} fill={COR.lima} />
	</g>
);

export const Cena10: React.FC = () => (
	<Papel
		limpo={
			<Balao
				x={1320}
				y={800}
				w={540}
				linhas={['Quem é você e o que', 'fez com o Beto?']}
				px={1440}
				py={760}
				tamanho={34}
			/>
		}
	>
		<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
		<Celular x={720} y={130} w={380} h={700} rot={-3}>
			<StoryRota w={380} h={700} />
			<text x={190} y={560} textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={60} fill={COR.textoTela}>
				10,0 km
			</text>
			<text x={190} y={610} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={30} fill={COR.textoTelaFraco}>
				52:10 · 5:12/km
			</text>
			<LogoKactus x={110} y={640} w={160} />
		</Celular>
		<Beto x={420} y={790} escala={0.95} pose="tchau" boca="sorriso" olhar={[10, -4]} />
		{/* celulares dos amigos explodindo de curtidas */}
		{[
			[1300, 140, 6],
			[1620, 300, -8],
			[1360, 470, 10],
		].map(([x, y, r], i) => (
			<g key={i}>
				<Celular x={x} y={y} w={150} h={270} rot={r}>
					<StoryRota w={150} h={270} />
				</Celular>
				{[
					[-30, -20],
					[170, 0],
					[-10, 260],
					[180, 230],
				].map(([dx, dy], j) => (
					<path
						key={j}
						transform={`translate(${x + dx} ${y + dy}) scale(${0.8 + ((i + j) % 3) * 0.2})`}
						d="M 0 0 c -20 -30 -60 0 0 40 c 60 -40 20 -70 0 -40 Z"
						fill={COR.vermelho}
						{...TRACO}
						strokeWidth={4}
					/>
				))}
			</g>
		))}
	</Papel>
);

export const Cena11: React.FC = () => (
	<Papel limpo={<Balao x={480} y={560} w={200} linhas={["Ai."]} px={720} py={650} tamanho={56} grito cor={COR.amarelo} />}>
		<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
		<rect x={610} y={50} width={700} height={190} rx={30} fill={COR.tela} {...TRACO} />
		<LogoKactus x={660} y={90} w={600} />
		{[
			['1', 'Treina', COR.estofado],
			['2', 'Importa', COR.amarelo],
			['3', 'Kactus explica,', COR.lima, 'Duni planeja'],
		].map(([n, t, cor, t2], i) => (
			<g key={n} transform={`rotate(${[-3, 2, -2][i]} ${370 + i * 590} 390)`}>
				<rect x={170 + i * 590} y={290} width={i === 2 ? 470 : 400} height={200} rx={26} fill={cor} {...TRACO} />
				<circle cx={225 + i * 590} cy={345} r={34} fill={COR.tinta} />
				<text x={225 + i * 590} y={360} textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={40} fill={COR.branco}>
					{n}
				</text>
				<text x={280 + i * 590} y={t2 ? 405 : 425} fontFamily={FONTE} fontWeight={900} fontSize={i === 2 ? 40 : 56} fill={COR.tinta}>
					{t}
				</text>
				{t2 ? (
					<text x={280 + i * 590} y={455} fontFamily={FONTE} fontWeight={900} fontSize={40} fill={COR.tinta}>
						{t2}
					</text>
				) : null}
			</g>
		))}
		<path d="M 590 390 l 60 0 m -20 -20 l 20 20 l -20 20" fill="none" {...TRACO} strokeWidth={7} />
		<path d="M 1180 390 l 60 0 m -20 -20 l 20 20 l -20 20" fill="none" {...TRACO} strokeWidth={7} />
		<Beto x={800} y={830} escala={0.6} pose="abraco" boca="dor" sobrancelha="triste" olhar={[10, 0]} />
		<Duni x={1080} y={900} escala={0.72} boca="sarcastica" olhar={[-10, 0]} bracoDireito={-6} />
	</Papel>
);
