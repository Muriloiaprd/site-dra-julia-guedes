import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {entre, mola, piscar, respirar, tremer} from '../anim';
import {tempoDaCena} from '../cenaTempo';
import {useBoca} from '../FalaContexto';
import {Beto, bracosAndando, misturarPoses} from '../personagens/Beto';
import {Duni} from '../personagens/Duni';
import {COR, FONTE, TRACO} from '../tema';
import {BalaoAnimado, Camera, Salta} from '../ui/Animados';
import {Brilho, Celular, LogoKactus, OlhosObjeto, Tenis} from '../ui/Objetos';
import {Papel} from '../ui/Papel';

// Cena 9 — o contador de km do tênis velho sobe até 600 e ele mesmo grita para ser aposentado.
export const Cena09: React.FC = () => {
	const frame = useCurrentFrame();
	const {falas: f, palavra} = tempoDaCena(9);
	const qKm = palavra(0, 'quilômetros');
	const q600 = palavra(1, 0);
	const km = Math.round(entre(frame, qKm, q600 + 4, 0, 600));
	const corKm = km >= 600 ? COR.vermelho : km >= 500 ? COR.amarelo : COR.neon;
	const bocaTenis = useBoca('tenis');
	const gritando = frame >= q600;
	const pulo = gritando ? -Math.abs(Math.sin((frame - q600) / 3)) * 22 : 0;
	const [tx, ty] = gritando ? tremer(frame, 3) : [0, 0];

	return (
		<Papel
			limpo={
				<BalaoAnimado de={palavra(1, 'aposenta')} ate={f[1].fim + 20} x={1220} y={90} w={560} linhas={['ME APOSENTA!']} px={1260} py={420} tamanho={54} grito cor={COR.amarelo} />
			}
		>
			<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
			<rect x={520} y={600} width={1000} height={36} fill={COR.madeira} {...TRACO} />
			<path d="M 600 636 L 640 720 M 1440 636 L 1400 720" {...TRACO} strokeWidth={8} />
			<Tenis x={760} y={600} escala={0.9} />
			<Brilho x={640} y={440} r={14 + Math.abs(Math.sin(frame / 6)) * 14} />
			<Brilho x={880} y={470} r={10 + Math.abs(Math.cos(frame / 6)) * 10} />
			<g transform={`translate(${tx} ${ty + pulo})`}>
				<Tenis x={1220} y={600} escala={1} velho espelhar />
				<OlhosObjeto x={1250} y={520} r={18} bravo={gritando} olhar={[-4, 0]} />
				<ellipse cx={1200} cy={560} rx={16 + (bocaTenis ?? 0) * 8} ry={bocaTenis !== undefined ? 4 + bocaTenis * 18 : gritando ? 16 : 6} fill={COR.tinta} />
			</g>
			<Salta de={qKm - 6} x={1170} y={380}>
				<rect x={1060} y={340} width={220} height={80} rx={16} fill={COR.tinta} />
				<text x={1170} y={396} textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={44} fill={corKm}>
					{km} km
				</text>
			</Salta>
			<Beto
				x={300}
				y={780}
				escala={0.85}
				pose={gritando ? misturarPoses('parado', 'susto', 0.6) : 'parado'}
				boca={gritando ? 'o' : 'neutra'}
				olhar={[12, -4]}
				sobrancelha={gritando ? 'alta' : undefined}
				piscar={piscar(frame, 2)}
				respiro={respirar(frame, 3)}
			/>
		</Papel>
	);
};

// Tela do Story: a rota se desenha conforme `t` vai de 0 a 1.
const StoryRota: React.FC<{w: number; h: number; t?: number}> = ({w, h, t = 1}) => (
	<g>
		<rect width={w} height={h} fill={COR.tela} />
		<path
			d={`M ${w * 0.2} ${h * 0.7} C ${w * 0.1} ${h * 0.45} ${w * 0.45} ${h * 0.5} ${w * 0.5} ${h * 0.32} S ${w * 0.85} ${h * 0.2} ${w * 0.78} ${h * 0.55} S ${w * 0.4} ${h * 0.75} ${w * 0.2} ${h * 0.7}`}
			fill="none"
			stroke={COR.neon}
			strokeWidth={Math.max(4, w * 0.03)}
			strokeLinecap="round"
			pathLength={1}
			strokeDasharray="1 1"
			strokeDashoffset={1 - t}
		/>
		<circle cx={w * 0.2} cy={h * 0.7} r={w * 0.035} fill={COR.lima} />
	</g>
);

const AMIGOS: [number, number, number][] = [
	[1300, 140, 6],
	[1620, 300, -8],
	[1360, 470, 10],
];

// Cena 10 — um toque em Compartilhar vira Story com a rota se desenhando; os celulares dos amigos
// chegam cheios de corações e um deles não reconhece o Beto.
export const Cena10: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {falas: f, palavra} = tempoDaCena(10);
	const qToque = palavra(0, 'toque');
	const qComp = palavra(0, 'Compartilhar');
	const qStory = palavra(0, 'Story');
	const qRota = palavra(0, 'rota');
	const story = frame >= qComp + 6;
	const rota = entre(frame, qComp + 6, qRota + 10, 0, 1);
	const onda = entre(frame, qComp, qComp + 12, 0, 1);
	const aponta = entre(frame, qToque - 4, qToque + 4, 0, 1) * (1 - entre(frame, qRota, qRota + 8, 0, 1));

	return (
		<Papel
			limpo={
				<BalaoAnimado de={f[1].i} ate={f[1].fim + 24} x={1320} y={800} w={540} linhas={['Quem é você e o que', 'fez com o Beto?']} px={1440} py={760} tamanho={34} />
			}
		>
			<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
			<Celular x={720} y={130} w={380} h={700} rot={-3}>
				{story ? (
					<>
						<StoryRota w={380} h={700} t={rota} />
						<Salta de={qStory} x={190} y={580}>
							<text x={190} y={560} textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={60} fill={COR.textoTela}>
								10,0 km
							</text>
							<text x={190} y={610} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={30} fill={COR.textoTelaFraco}>
								52:10 · 5:12/km
							</text>
						</Salta>
						<Salta de={palavra(0, 'vídeo')} x={190} y={657}>
							<LogoKactus x={110} y={640} w={160} />
						</Salta>
					</>
				) : (
					<>
						<rect width={380} height={700} fill={COR.tela} />
						<text x={30} y={90} fontFamily={FONTE} fontWeight={900} fontSize={34} fill={COR.textoTela}>
							Corrida
						</text>
						<text x={30} y={130} fontFamily={FONTE} fontWeight={700} fontSize={24} fill={COR.textoTelaFraco}>
							10,0 km · 52:10
						</text>
						<rect x={30} y={170} width={320} height={260} rx={18} fill={COR.telaCartao} stroke={COR.telaBorda} strokeWidth={2} />
						<rect x={40} y={560} width={300} height={74} rx={37} fill={COR.neon} />
						<text x={190} y={608} textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={30} fill={COR.tinta}>
							Compartilhar
						</text>
						{onda > 0 ? <circle cx={190} cy={597} r={20 + onda * 120} fill="none" stroke={COR.lima} strokeWidth={6} opacity={1 - onda} /> : null}
					</>
				)}
			</Celular>
			<Beto
				x={420}
				y={790}
				escala={0.95}
				pose={misturarPoses('tchau', 'apontar', aponta)}
				boca="sorriso"
				olhar={[10, -4]}
				piscar={piscar(frame, 1)}
				respiro={respirar(frame, 3)}
			/>
			{AMIGOS.map(([x, y, r], i) => {
				const chega = mola(frame, fps, qRota + 8 + i * 5, 140);
				if (chega < 0.01) return null;
				const treme = i === 2 && frame >= f[1].i && frame < f[1].fim ? tremer(frame, 4) : [0, 0];
				return (
					<g key={i} transform={`translate(${(1 - chega) * 700 + treme[0]} ${treme[1]})`}>
						<Celular x={x} y={y} w={150} h={270} rot={r}>
							<StoryRota w={150} h={270} />
						</Celular>
						{[
							[-30, -20],
							[170, 0],
							[-10, 260],
							[180, 230],
						].map(([dx, dy], j) => {
							const de = qRota + 14 + i * 5 + j * 3;
							const s = mola(frame, fps, de, 200);
							if (s < 0.01) return null;
							const sobe = Math.max(0, frame - de) * 1.2;
							return (
								<path
									key={j}
									transform={`translate(${x + dx} ${y + dy - sobe}) scale(${s * (0.8 + ((i + j) % 3) * 0.2)})`}
									d="M 0 0 c -20 -30 -60 0 0 40 c 60 -40 20 -70 0 -40 Z"
									fill={COR.vermelho}
									{...TRACO}
									strokeWidth={4}
								/>
							);
						})}
					</g>
				);
			})}
		</Papel>
	);
};

const CARTOES: [string, string, string, string?][] = [
	['1', 'Treina', COR.estofado],
	['2', 'Importa', COR.amarelo],
	['3', 'Kactus explica,', COR.lima, 'Duni planeja'],
];

// Cena 11 — os três passos entram em fila, a Duni manda correr e proíbe abraço; o Beto tenta assim
// mesmo, se espeta, e a câmera fecha na logo.
export const Cena11: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {duracao, falas: f, palavra} = tempoDaCena(11);
	const passos = [palavra(0, 'treina'), palavra(0, 'importa'), palavra(0, 'explica')];
	const qAbraco = palavra(1, 'abraço');
	const anda = entre(frame, qAbraco - 4, qAbraco + 14, 0, 1);
	const espetou = frame >= f[2].i;
	const recuo = espetou ? mola(frame, fps, f[2].i, 200) * 110 : 0;
	const [tx, ty] = espetou && frame < f[2].i + 14 ? tremer(frame, 6) : [0, 0];
	const andando = anda > 0 && anda < 1;
	const pose = espetou
		? 'susto'
		: anda >= 1
			? 'abraco'
			: andando
				? bracosAndando(frame * 0.6)
				: misturarPoses('parado', 'tchau', entre(frame, 2, 10, 0, 1) * (1 - entre(frame, f[0].fim, f[0].fim + 8, 0, 1)));
	const zoom = entre(frame, duracao - 50, duracao - 8, 1, 1.2);
	const camY = entre(frame, duracao - 50, duracao - 8, 540, 330);

	return (
		<Papel
			limpo={<BalaoAnimado de={f[2].i} ate={f[2].fim + 20} x={480} y={560} w={200} linhas={['Ai.']} px={720} py={650} tamanho={56} grito cor={COR.amarelo} />}
		>
			<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
			<Camera x={960} y={camY} zoom={zoom}>
				<Salta de={4} x={960} y={145}>
					<rect x={610} y={50} width={700} height={190} rx={30} fill={COR.tela} {...TRACO} />
					<LogoKactus x={660} y={90} w={600} />
				</Salta>
				{CARTOES.map(([n, t, cor, t2], i) => (
					<Salta key={n} de={passos[i] - 3} x={370 + i * 590} y={390}>
						<g transform={`rotate(${[-3, 2, -2][i]} ${370 + i * 590} 390)`}>
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
					</Salta>
				))}
				<Salta de={passos[1] - 6} x={620} y={390}>
					<path d="M 590 390 l 60 0 m -20 -20 l 20 20 l -20 20" fill="none" {...TRACO} strokeWidth={7} />
				</Salta>
				<Salta de={passos[2] - 6} x={1210} y={390}>
					<path d="M 1180 390 l 60 0 m -20 -20 l 20 20 l -20 20" fill="none" {...TRACO} strokeWidth={7} />
				</Salta>
				<g transform={`translate(${tx} ${ty})`}>
					<Beto
						x={700 + 205 * anda - recuo}
						y={830}
						escala={0.6}
						pose={pose}
						andar={andando ? frame * 0.6 : undefined}
						boca={espetou ? 'dor' : anda >= 1 ? 'sorriso' : 'neutra'}
						sobrancelha={espetou ? 'triste' : anda >= 1 ? 'alta' : undefined}
						olhar={[10, 0]}
						piscar={piscar(frame, 1)}
						respiro={respirar(frame, 3)}
					/>
				</g>
				<Duni
					x={1080}
					y={900}
					escala={0.72}
					boca={espetou ? 'sorriso' : 'sarcastica'}
					olhar={[-10, 0]}
					piscar={piscar(frame, 4)}
					bracoDireito={frame >= qAbraco - 6 && !espetou ? -25 : -6}
				/>
			</Camera>
		</Papel>
	);
};
