import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {entre, mola, piscar, respirar, tremer} from '../anim';
import {tempoDaCena} from '../cenaTempo';
import {Beto, Bracos, bracosAndando, misturarPoses, POSES} from '../personagens/Beto';
import {Duni} from '../personagens/Duni';
import {COR, FONTE, TRACO} from '../tema';
import {BalaoAnimado, naCurva, Salta} from '../ui/Animados';
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

// Cena 6 — o Desempenho mostra forma, risco e previsão; o Beto abre o Modo avançado, as siglas voam
// na cara dele e ele fecha a gaveta: "Hoje não".
const SIGLAS: [string, number, number, number, string][] = [
	['CTL', 1150, 360, -14, COR.azul],
	['ATL', 1280, 520, 10, COR.vermelho],
	['TSB', 1180, 680, -6, COR.amarelo],
	['ACWR', 1340, 820, 12, COR.estofado],
	['e^(-1/42)', 1060, 880, -10, COR.rosa],
];

export const Cena06: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {falas: f, palavra} = tempoDaCena(6);
	const qForma = palavra(0, 'forma');
	const qExag = palavra(0, 'exagerando');
	const qProva = palavra(0, 'prova');
	const qAvanc = palavra(1, 'avançado');
	const qTamb = palavra(1, 'também');
	const qNao = palavra(1, 5);
	const qHoje = palavra(1, 'Hoje');
	const gaveta = entre(frame, qAvanc - 4, qAvanc + 8, 0, 1) * (1 - entre(frame, qHoje, qHoje + 6, 0, 1));
	const fecha = entre(frame, qHoje, qHoje + 8, 0, 1);
	const assustado = frame >= qTamb + 4 && frame < qHoje + 6;
	const [tx, ty] = assustado ? tremer(frame, 4) : [0, 0];
	const apontando = entre(frame, f[0].i, f[0].i + 8, 0, 1) * (1 - entre(frame, qTamb, qTamb + 4, 0, 1));
	const pose = assustado ? POSES.susto : misturarPoses('parado', 'apontar', apontando);

	return (
		<Papel limpo={<BalaoAnimado de={qNao} ate={f[1].fim + 16} x={1380} y={110} w={380} linhas={['Hoje não!']} px={1520} py={330} tamanho={50} />}>
			<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
			<Monitor x={150} y={110} w={1040} h={620}>
				<text x={36} y={64} fontFamily={FONTE} fontWeight={900} fontSize={40} fill={COR.textoTela}>
					Desempenho
				</text>
				<Salta de={qForma - 3} x={191} y={195}>
					<Cartao x={36} y={100} w={310} h={190} titulo="Forma" valor="Em forma" />
					<rect x={60} y={250} width={260} height={16} rx={8} fill="#333" />
					<rect x={60} y={250} width={entre(frame, qForma, qForma + 20, 0, 190)} height={16} rx={8} fill={COR.neon} />
				</Salta>
				<Salta de={qExag - 3} x={521} y={195}>
					<Cartao x={366} y={100} w={310} h={190} titulo="Risco de lesão" valor="Baixo" cor={COR.lima} />
				</Salta>
				<Salta de={qProva - 3} x={851} y={195}>
					<Cartao x={696} y={100} w={310} h={190} titulo="Previsão 10 km" valor="51:40" cor={COR.textoTela} />
				</Salta>
				<rect x={36} y={320} width={970} height={60 + 200 * gaveta} rx={18} fill={COR.telaCartao} stroke={COR.telaBorda} strokeWidth={3} />
				<text x={64} y={362} fontFamily={FONTE} fontWeight={700} fontSize={30} fill={gaveta > 0.5 ? COR.neon : COR.textoTelaFraco}>
					Modo avançado {gaveta > 0.5 ? '▴' : '▾'}
				</text>
				<g opacity={gaveta}>
					<path d="M 64 520 Q 240 400 400 470 T 760 420 T 980 450" fill="none" stroke={COR.azul} strokeWidth={5} />
					<path d="M 64 540 Q 240 500 400 520 T 760 500 T 980 470" fill="none" stroke={COR.vermelho} strokeWidth={5} />
				</g>
			</Monitor>
			{SIGLAS.map(([t, x, y, r, c], i) => {
				const sai = mola(frame, fps, qTamb + i * 3, 150) * (1 - fecha);
				if (sai < 0.01) return null;
				const px = 600 + (x - 600) * sai;
				const py = 560 + (y - 560) * sai;
				return (
					<g key={t} transform={`translate(${px} ${py}) rotate(${r}) scale(${sai})`}>
						<text textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={64} fill={c} stroke={COR.tinta} strokeWidth={3}>
							{t}
						</text>
						<path d="M -130 -16 l -60 0 M -130 4 l -40 0" {...TRACO} strokeWidth={4} />
					</g>
				);
			})}
			<g transform={`translate(${tx} ${ty})`}>
				<Beto
					x={1580}
					y={760}
					espelhar
					pose={pose}
					boca={assustado ? 'aberta' : frame >= qHoje ? 'neutra' : 'sorriso'}
					sobrancelha={assustado ? 'alta' : frame >= qHoje ? 'brava' : undefined}
					olhar={[12, 0]}
					suor={assustado}
					piscar={piscar(frame, 2)}
					respiro={respirar(frame, 3)}
				/>
			</g>
		</Papel>
	);
};

// Balão de chat dentro do celular (coordenadas da tela do celular).
const BalaoChat: React.FC<{de: number; y: number; linhas: string[]; meu?: boolean; cor?: string}> = ({de, y, linhas, meu = false, cor}) => {
	const x = meu ? 90 : 30;
	const h = 38 + linhas.length * 36;
	return (
		<Salta de={de} x={meu ? 400 : 30} y={y + h / 2}>
			<rect x={x} y={y} width={310} height={h} rx={22} fill={meu ? COR.neon : COR.telaCartao} stroke={meu ? 'none' : COR.telaBorda} strokeWidth={2} />
			{linhas.map((l, i) => (
				<text key={i} x={x + 20} y={y + 46 + i * 36} fontFamily={FONTE} fontWeight={700} fontSize={24} fill={cor ?? (meu ? COR.tinta : COR.textoTela)}>
					{l}
				</text>
			))}
		</Salta>
	);
};

// Cena 7 — a Duni salta do celular, comenta o check-in e troca o treino de amanhã no calendário na hora.
export const Cena07: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {falas: f, palavra} = tempoDaCena(7);
	const surge = f[0].i - 14;
	const m = Math.min(1, mola(frame, fps, surge, 110));
	const [dx, dy] = naCurva([385, 640], [640, 120], [960, 860], m);
	const pouso = frame - surge - 14;
	const pulo = pouso > 0 ? Math.sin(pouso / 3) * Math.max(0, 1 - pouso / 24) : 0;
	const qTrocado = palavra(3, 'Trocado');
	const qTiro = palavra(3, 5);
	const qFesta = palavra(3, 'festa');
	const olhaBeto = frame >= f[2].i - 6;

	return (
		<Papel
			limpo={
				<BalaoAnimado
					de={palavra(3, 'Sim')}
					ate={f[3].fim + 18}
					x={1120}
					y={110}
					w={700}
					linhas={['Sim, tiro.', 'Não, não é de festa junina.']}
					px={1030}
					py={350}
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
				<BalaoChat de={f[1].i - 10} y={130} linhas={['Check-in: perna', 'pesada']} meu />
				<BalaoChat de={palavra(1, 'Normal')} y={260} linhas={['Normal, maior', 'volume do mês.']} />
				<BalaoChat de={f[2].i} y={390} linhas={['Dá pra trocar o', 'treino de amanhã?']} meu />
				<BalaoChat de={qTrocado} y={520} linhas={['Trocado! ✓']} cor={COR.lima} />
			</Celular>
			{m > 0.01 ? (
				<>
					<Duni
						x={dx}
						y={dy}
						escala={0.25 + 1.0 * m}
						pulo={pulo}
						boca="sarcastica"
						olhar={olhaBeto ? [10, 0] : [0, 0]}
						piscar={piscar(frame, 4)}
						bracoDireito={frame < f[0].i + 24 ? Math.sin(frame * 0.5) * 16 : -6}
					/>
					{frame < surge + 16 ? <Brilho x={420} y={560} r={30 * (1 - (frame - surge) / 16)} cor={COR.lima} /> : null}
				</>
			) : null}
			{/* etiqueta do calendário trocada na hora */}
			<Salta de={f[2].i + 4} x={1620} y={570}>
				<g transform="rotate(4 1620 570)">
					<rect x={1380} y={420} width={480} height={300} rx={22} fill={COR.branco} {...TRACO} />
					<text x={1410} y={475} fontFamily={FONTE} fontWeight={900} fontSize={34} fill={COR.tinta}>
						Amanhã
					</text>
					<rect x={1410} y={500} width={420} height={70} rx={14} fill={COR.cinza} {...TRACO} strokeWidth={3} />
					<text x={1430} y={548} fontFamily={FONTE} fontWeight={700} fontSize={30} fill={COR.tinta} opacity={0.6}>
						Rodagem 8 km
					</text>
					<path d={`M 1420 536 L ${1420 + 400 * entre(frame, qTrocado, qTrocado + 8, 0, 1)} 536`} stroke={COR.vermelho} strokeWidth={7} strokeLinecap="round" />
					<Salta de={qTiro} x={1620} y={635}>
						<rect x={1410} y={595} width={420} height={80} rx={14} fill={COR.lima} {...TRACO} strokeWidth={3} />
						<text x={1430} y={648} fontFamily={FONTE} fontWeight={900} fontSize={34} fill={COR.tinta}>
							Tiros 8 × 400 m
						</text>
					</Salta>
				</g>
			</Salta>
			{frame >= qTiro ? <Brilho x={1850} y={410} r={20 + Math.abs(Math.sin(frame / 5)) * 12} cor={COR.lima} /> : null}
			<Beto
				x={1230}
				y={840}
				escala={0.7}
				espelhar
				pose={frame >= f[2].i && frame < f[2].fim ? 'apontar' : 'parado'}
				boca={frame >= qFesta ? 'o' : 'neutra'}
				sobrancelha={frame >= qFesta ? 'alta' : undefined}
				olhar={[12, 0]}
				piscar={piscar(frame, 1)}
				respiro={respirar(frame, 3)}
			/>
		</Papel>
	);
};

// Calendário claro do app: 7 colunas, etiquetas por situação.
const SIT: Record<string, string> = {f: COR.neon, p: COR.cinza, x: COR.vermelho, h: COR.lima, '': 'none'};
const GRADE = [
	['f', '', 'f', '', 'f', '', 'f'],
	['f', '', 'f', 'f', '', 'f', 'f'],
	['f', '', 'f', '', 'x', '', 'h'],
	['p', '', 'p', '', 'p', '', 'p'],
];
const DEGRAUS: [string, string][] = [
	['Base', COR.estofado],
	['Construção', COR.amarelo],
	['Pico', COR.rosa],
	['Polimento', COR.azul],
];

// Cena 8 — as etiquetas do calendário pipocam por cor, a vermelha encara o Beto, e o plano vira uma escada
// que um mini Beto sobe até a linha de chegada.
export const Cena08: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {falas: f, palavra} = tempoDaCena(8);
	const qVerde = palavra(0, 'verde');
	const qCinza = palavra(0, 'cinza');
	const qVermelho = palavra(1, 'vermelho');
	const qPara = palavra(1, 'Para');
	const qPlano = palavra(2, 'plano');
	const qDegrau = palavra(2, 4);
	const qProva = palavra(2, 'prova');

	// ordem em que cada etiqueta aparece, por cor
	let verdes = 0;
	let cinzas = 0;
	const aparece = GRADE.map((linha) =>
		linha.map((s) => (s === 'f' || s === 'h' ? qVerde + verdes++ * 2 : s === 'p' ? qCinza + cinzas++ * 3 : s === 'x' ? qVermelho : 0)),
	);
	const encara = frame >= qVermelho ? 1 + Math.sin(frame / 4) * 0.06 + (frame >= palavra(1, 'olhar') ? 0.15 : 0) : 1;
	const reclama = frame >= qPara && frame < f[1].fim + 6;

	// mini Beto pulando de degrau em degrau
	const cx = (i: number) => 1345 + 150 * i;
	const topo = (i: number) => 820 - (i + 1) * 120;
	const subida = entre(frame, qDegrau, qProva, 0, 3);
	const i0 = Math.min(2, Math.floor(subida));
	const fr = subida - i0;
	const miniX = cx(i0) + (cx(i0 + 1) - cx(i0)) * fr;
	const miniY = topo(i0) + (topo(i0 + 1) - topo(i0)) * fr - Math.sin(Math.PI * fr) * 70 - 42;
	const chegou = frame >= qProva;

	return (
		<Papel>
			<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
			<Salta de={palavra(0, 'calendário') - 4} x={590} y={460}>
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
						const hoje = li === 2 && ci === 6;
						const esc = s === 'x' ? encara : 1;
						return (
							<g key={`${li}-${ci}`}>
								<rect x={x} y={y} width={120} height={120} rx={14} fill="#F4F4F4" stroke={hoje ? COR.neon : '#DDD'} strokeWidth={hoje ? 6 : 2} />
								{s ? (
									<Salta de={aparece[li][ci]} x={x + 60} y={y + 68}>
										<g transform={`translate(${x + 60} ${y + 68}) scale(${esc}) translate(${-x - 60} ${-y - 68})`}>
											<rect x={x + 10} y={y + 40} width={100} height={56} rx={12} fill={SIT[s]} {...TRACO} strokeWidth={3} />
											{s === 'x' ? <OlhosObjeto x={706} y={608} r={14} bravo olhar={[5, 0]} /> : null}
										</g>
									</Salta>
								) : null}
							</g>
						);
					}),
				)}
			</Salta>
			<Beto
				x={1170}
				y={820}
				escala={0.7}
				espelhar={reclama}
				pose={reclama ? 'apontar' : 'parado'}
				boca="preocupada"
				olhar={reclama ? [12, 2] : [-12, 2]}
				suor={frame >= qVermelho}
				sobrancelha={reclama ? 'brava' : 'triste'}
				piscar={piscar(frame, 3)}
				respiro={respirar(frame, 3)}
			/>
			{DEGRAUS.map(([nome, cor], i) => {
				const cresce = mola(frame, fps, qPlano + i * 5, 160);
				if (cresce < 0.01) return null;
				return (
					<g key={nome} transform={`translate(0 820) scale(1 ${cresce}) translate(0 -820)`}>
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
				);
			})}
			{frame >= qPlano + 15 ? (
				<g transform={`rotate(${chegou ? Math.sin(frame / 3) * 6 : 0} 1850 340)`}>
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
				</g>
			) : null}
			{frame >= qDegrau ? (
				<Beto x={miniX} y={miniY} escala={0.22} pose={chegou ? 'susto' : 'parado'} boca="sorriso" piscar={piscar(frame, 5)} />
			) : null}
			{chegou ? (
				<>
					<Brilho x={1700} y={250} r={20 + Math.abs(Math.sin(frame / 4)) * 10} />
					<Brilho x={1880} y={380} r={16 + Math.abs(Math.cos(frame / 4)) * 10} />
				</>
			) : null}
		</Papel>
	);
};
