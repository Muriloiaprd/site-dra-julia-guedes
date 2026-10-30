import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {entre, mola, piscar, respirar} from '../anim';
import {tempoDaCena} from '../cenaTempo';
import {Beto, Bracos, bracosAndando, misturarPoses, POSES} from '../personagens/Beto';
import {Duni} from '../personagens/Duni';
import {COR, FONTE, TRACO} from '../tema';
import {Balao} from '../ui/Balao';
import {Brilho, Cartao, Celular, Monitor, OlhosObjeto} from '../ui/Objetos';
import {Papel} from '../ui/Papel';

const Placa: React.FC<{x: number; y: number; texto: string[]; cor: string; rot: number; frame: number}> = ({x, y, texto, cor, rot, frame}) => (
	<g transform={`rotate(${rot} ${x} ${y})`}>
		<rect x={x - 12} y={y + 100} width={24} height={330} fill={COR.madeiraEscura} {...TRACO} />
		<rect x={x - 200} y={y - 110} width={400} height={220} rx={26} fill={cor} {...TRACO} />
		{Array.from({length: 10}).map((_, i) => (
			<circle
				key={i}
				cx={x - 170 + i * 37.8}
				cy={y - 88}
				r={9}
				fill={(i + Math.floor(frame / 6)) % 2 === 0 ? COR.amarelo : '#8A7A2A'}
				stroke={COR.tinta}
				strokeWidth={3}
			/>
		))}
		{texto.map((t, i) => (
			<text
				key={i}
				x={x}
				y={y + 10 + (i - (texto.length - 1) / 2) * 56 + 14}
				textAnchor="middle"
				fontFamily={FONTE}
				fontWeight={900}
				fontSize={50}
				fill={COR.tinta}
			>
				{t}
			</text>
		))}
	</g>
);

// Placa que sobe do chão do palco com mola no quadro `de`.
const PlacaSobe: React.FC<React.ComponentProps<typeof Placa> & {de: number}> = ({de, ...placa}) => {
	const {fps} = useVideoConfig();
	const m = mola(placa.frame, fps, de, 170);
	if (m < 0.01) return null;
	return (
		<g transform={`translate(0 ${(1 - m) * 700})`}>
			<Placa {...placa} />
		</g>
	);
};

// Cena 5 — programa de auditório: as cortinas abrem, o Beto apresenta e as três perguntas do painel sobem.
export const Cena05: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {palavra} = tempoDaCena(5);
	const abre = mola(frame, fps, 2, 60);
	const chegada = entre(frame, 6, 34, 0, 1);
	const qComo = palavra(1, 0);
	const qFiz = palavra(1, 3);
	const qHoje = palavra(1, 7);
	// o braço aponta para cada placa na hora dela
	const alvo = frame >= qHoje ? 2 : frame >= qFiz ? 1 : frame >= qComo ? 0 : -1;
	const apontar: Bracos = {
		l: POSES.parado.l,
		r: [
			{e: [85, -5], m: [180, -35]},
			{e: [85, -30], m: [185, -95]},
			{e: [90, -50], m: [175, -150]},
		][Math.max(0, alvo)] as Bracos['r'],
	};
	const pose = alvo < 0 ? misturarPoses('parado', 'tchau', entre(frame, 34, 42, 0, 1)) : apontar;
	const aceno = alvo < 0 && frame > 40 ? Math.sin(frame * 0.6) * 25 : 0;
	const poseFinal: Bracos = {l: pose.l, r: {e: pose.r.e, m: [pose.r.m[0] + aceno, pose.r.m[1]]}};

	return (
		<Papel>
			<rect x={0} y={0} width={1920} height={1080} fill="#2B2140" />
			{[520, 960, 1400].map((cx, i) => (
				<polygon
					key={cx}
					points={`${cx - 40},0 ${cx + 40},0 ${cx + 240},760 ${cx - 240},760`}
					fill={COR.amarelo}
					opacity={0.16}
					transform={`rotate(${Math.sin(frame / 18 + i * 2) * 10} ${cx} 0)`}
				/>
			))}
			<rect x={0} y={760} width={1920} height={320} fill="#4A3A63" />
			<path d="M 0 760 L 1920 760" {...TRACO} />
			<PlacaSobe de={qComo - 4} frame={frame} x={520} y={330} texto={['Como', 'eu tô?']} cor={COR.estofado} rot={-5} />
			<PlacaSobe de={qFiz - 4} frame={frame} x={960} y={290} texto={['O que', 'eu fiz?']} cor={COR.amarelo} rot={2} />
			<PlacaSobe de={qHoje - 4} frame={frame} x={1400} y={330} texto={['O que faço', 'hoje?']} cor={COR.rosa} rot={6} />
			{[
				[740, 130, 30],
				[1190, 110, 24],
				[1620, 190, 28],
			].map(([x, y, r], i) => (
				<Brilho key={i} x={x} y={y} r={r * (0.6 + Math.abs(Math.sin(frame / 8 + i)) * 0.5)} />
			))}
			<Beto
				x={-150 + 490 * chegada}
				y={790}
				escala={0.75}
				pose={chegada < 1 ? bracosAndando(frame * 0.5, 1 - chegada) : poseFinal}
				andar={frame * 0.5}
				andarForca={1 - entre(frame, 26, 36, 0, 1)}
				boca="sorriso"
				olhar={alvo < 0 ? [0, 0] : [10, -6]}
				sobrancelha="alta"
				piscar={piscar(frame, 2)}
				respiro={respirar(frame, 3)}
			/>
			{/* cortinas abrindo */}
			<path transform={`translate(${-760 * abre} 0)`} d="M 0 0 L 990 0 Q 940 400 1000 1080 L 0 1080 Z" fill="#C8323B" {...TRACO} />
			<path transform={`translate(${760 * abre} 0)`} d="M 1920 0 L 930 0 Q 980 400 920 1080 L 1920 1080 Z" fill="#C8323B" {...TRACO} />
		</Papel>
	);
};

export const Cena06: React.FC = () => (
	<Papel limpo={<Balao x={1380} y={110} w={380} linhas={['Hoje não!']} px={1520} py={330} tamanho={50} />}>
		<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
		<Monitor x={150} y={110} w={1040} h={620}>
			<text x={36} y={64} fontFamily={FONTE} fontWeight={900} fontSize={40} fill={COR.textoTela}>
				Desempenho
			</text>
			<Cartao x={36} y={100} w={310} h={190} titulo="Forma" valor="Em forma" />
			<Cartao x={366} y={100} w={310} h={190} titulo="Risco de lesão" valor="Baixo" cor={COR.lima} />
			<Cartao x={696} y={100} w={310} h={190} titulo="Previsão 10 km" valor="51:40" cor={COR.textoTela} />
			{/* termômetro de forma */}
			<rect x={60} y={250} width={260} height={16} rx={8} fill="#333" />
			<rect x={60} y={250} width={190} height={16} rx={8} fill={COR.neon} />
			{/* gaveta do modo avançado aberta */}
			<rect x={36} y={320} width={970} height={260} rx={18} fill={COR.telaCartao} stroke={COR.telaBorda} strokeWidth={3} />
			<text x={64} y={370} fontFamily={FONTE} fontWeight={700} fontSize={30} fill={COR.textoTelaFraco}>
				Modo avançado ▴
			</text>
			<path d="M 64 520 Q 240 400 400 470 T 760 420 T 980 450" fill="none" stroke={COR.azul} strokeWidth={5} />
			<path d="M 64 540 Q 240 500 400 520 T 760 500 T 980 470" fill="none" stroke={COR.vermelho} strokeWidth={5} />
		</Monitor>
		{/* siglas voando na cara do Beto */}
		{[
			['CTL', 1150, 360, -14, COR.azul],
			['ATL', 1280, 520, 10, COR.vermelho],
			['TSB', 1180, 680, -6, COR.amarelo],
			['ACWR', 1340, 820, 12, COR.estofado],
			['e^(-1/42)', 1060, 880, -10, COR.rosa],
		].map(([t, x, y, r, c]) => (
			<g key={t as string} transform={`rotate(${r} ${x} ${y})`}>
				<text
					x={x as number}
					y={y as number}
					textAnchor="middle"
					fontFamily={FONTE}
					fontWeight={900}
					fontSize={64}
					fill={c as string}
					stroke={COR.tinta}
					strokeWidth={3}
				>
					{t}
				</text>
				<path d={`M ${(x as number) - 130} ${(y as number) - 16} l -60 0 M ${(x as number) - 130} ${(y as number) + 4} l -40 0`} {...TRACO} strokeWidth={4} />
			</g>
		))}
		<Beto x={1580} y={760} pose="susto" boca="aberta" sobrancelha="alta" olhar={[-12, 0]} suor />
	</Papel>
);

export const Cena07: React.FC = () => (
	<Papel
		limpo={
			<Balao
				x={1120}
				y={110}
				w={700}
				linhas={['Sim, tiro.', 'Não, não é de festa junina.']}
				px={1080}
				py={340}
				tamanho={42}
				cor={COR.lima}
			/>
		}
	>
		<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
		<Celular x={170} y={140} w={430} h={800}>
			<rect width={430} height={800} fill={COR.tela} />
			<text x={215} y={80} textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={32} fill={COR.textoTela}>
				Duni
			</text>
			<rect x={30} y={130} width={330} height={110} rx={22} fill={COR.telaCartao} stroke={COR.telaBorda} strokeWidth={2} />
			<text x={52} y={175} fontFamily={FONTE} fontWeight={700} fontSize={24} fill={COR.textoTela}>
				A perna pesou? Normal,
			</text>
			<text x={52} y={210} fontFamily={FONTE} fontWeight={700} fontSize={24} fill={COR.textoTela}>
				maior volume do mês.
			</text>
			<rect x={90} y={280} width={310} height={110} rx={22} fill={COR.neon} />
			<text x={110} y={325} fontFamily={FONTE} fontWeight={700} fontSize={24} fill={COR.tinta}>
				Dá pra trocar o
			</text>
			<text x={110} y={360} fontFamily={FONTE} fontWeight={700} fontSize={24} fill={COR.tinta}>
				treino de amanhã?
			</text>
			<rect x={30} y={430} width={330} height={74} rx={22} fill={COR.telaCartao} stroke={COR.telaBorda} strokeWidth={2} />
			<text x={52} y={477} fontFamily={FONTE} fontWeight={700} fontSize={24} fill={COR.lima}>
				Trocado! ✓
			</text>
		</Celular>
		{/* Duni saindo do celular */}
		<path d="M 620 520 q 140 -40 220 60" fill="none" stroke={COR.tinta} strokeWidth={5} strokeDasharray="4 16" strokeLinecap="round" />
		<Duni x={960} y={860} escala={1.25} boca="sarcastica" olhar={[8, -4]} bracoDireito={-12} />
		<Brilho x={780} y={330} r={26} cor={COR.lima} />
		{/* etiqueta do calendário trocada */}
		<g transform="rotate(4 1500 720)">
			<rect x={1260} y={560} width={480} height={300} rx={22} fill={COR.branco} {...TRACO} />
			<text x={1290} y={615} fontFamily={FONTE} fontWeight={900} fontSize={34} fill={COR.tinta}>
				Amanhã
			</text>
			<rect x={1290} y={640} width={420} height={70} rx={14} fill={COR.cinza} {...TRACO} strokeWidth={3} />
			<text x={1310} y={688} fontFamily={FONTE} fontWeight={700} fontSize={30} fill={COR.tinta} opacity={0.6}>
				Rodagem 8 km
			</text>
			<path d="M 1300 676 L 1700 676" stroke={COR.vermelho} strokeWidth={7} strokeLinecap="round" />
			<rect x={1290} y={735} width={420} height={80} rx={14} fill={COR.lima} {...TRACO} strokeWidth={3} />
			<text x={1310} y={788} fontFamily={FONTE} fontWeight={900} fontSize={34} fill={COR.tinta}>
				Tiros 8 × 400 m
			</text>
		</g>
		<Brilho x={1760} y={560} r={28} cor={COR.lima} />
	</Papel>
);

// Calendário claro do app: 7 colunas, etiquetas por situação.
const SIT: Record<string, string> = {f: COR.neon, p: COR.cinza, x: COR.vermelho, h: COR.lima, '': 'none'};
const GRADE = [
	['f', '', 'f', '', 'f', '', 'f'],
	['f', '', 'f', 'f', '', 'f', 'f'],
	['f', '', 'f', '', 'x', '', 'h'],
	['p', '', 'p', '', 'p', '', 'p'],
];

export const Cena08: React.FC = () => (
	<Papel>
		<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
		<rect x={90} y={100} width={1000} height={720} rx={28} fill={COR.branco} {...TRACO} />
		<text x={130} y={170} fontFamily={FONTE} fontWeight={900} fontSize={44} fill={COR.tinta}>
			Calendário de treinos
		</text>
		{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
			<text key={i} x={175 + i * 134} y={230} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={28} fill="#888">
				{d}
			</text>
		))}
		{GRADE.map((linha, li) =>
			linha.map((s, ci) => {
				const x = 120 + ci * 134;
				const y = 255 + li * 135;
				return (
					<g key={`${li}-${ci}`}>
						<rect x={x} y={y} width={120} height={120} rx={14} fill="#F4F4F4" stroke={li === 2 && ci === 6 ? COR.neon : '#DDD'} strokeWidth={li === 2 && ci === 6 ? 6 : 2} />
						{s ? <rect x={x + 10} y={y + 40} width={100} height={56} rx={12} fill={SIT[s]} {...TRACO} strokeWidth={3} /> : null}
					</g>
				);
			}),
		)}
		{/* a etiqueta vermelha encara o Beto */}
		<OlhosObjeto x={706} y={608} r={14} bravo olhar={[5, 0]} />
		<Beto x={1170} y={820} escala={0.7} pose="parado" boca="preocupada" olhar={[-12, 2]} suor sobrancelha="triste" />
		{/* escada do plano do objetivo */}
		{[
			['Base', COR.estofado],
			['Construção', COR.amarelo],
			['Pico', COR.rosa],
			['Polimento', COR.azul],
		].map(([nome, cor], i) => (
			<g key={nome}>
				<rect x={1270 + i * 150} y={820 - (i + 1) * 120} width={150} height={(i + 1) * 120} fill={cor} {...TRACO} />
				<text
					x={1345 + i * 150}
					y={820 - (i + 1) * 120 + 50}
					textAnchor="middle"
					fontFamily={FONTE}
					fontWeight={900}
					fontSize={nome.length > 9 ? 22 : nome.length > 6 ? 25 : 32}
					fill={COR.tinta}
				>
					{nome}
				</text>
			</g>
		))}
		{/* linha de chegada no topo */}
		<path d="M 1850 340 L 1850 160" {...TRACO} strokeWidth={6} />
		{Array.from({length: 12}).map((_, i) => (
			<rect
				key={i}
				x={1850 - ((i % 4) + 1) * 26}
				y={160 + Math.floor(i / 4) * 26}
				width={26}
				height={26}
				fill={(i + Math.floor(i / 4)) % 2 === 0 ? COR.tinta : COR.branco}
				stroke={COR.tinta}
				strokeWidth={2}
			/>
		))}
		<text x={1690} y={140} fontFamily={FONTE} fontWeight={900} fontSize={30} fill={COR.tinta}>
			Sua prova
		</text>
	</Papel>
);
