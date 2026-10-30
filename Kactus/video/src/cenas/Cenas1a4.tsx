import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {entre, mola, piscar, respirar, tremer} from '../anim';
import {tempoDaCena} from '../cenaTempo';
import {Beto, misturarPoses} from '../personagens/Beto';
import {COR, FONTE, FONTE_MAO, TRACO} from '../tema';
import {BalaoAnimado, Camera, naCurva, Salta} from '../ui/Animados';
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

// Nuvenzinha de poeira que se espalha e some a partir do quadro `de`.
const Poeira: React.FC<{x: number; y: number; de: number}> = ({x, y, de}) => {
	const frame = useCurrentFrame();
	const t = entre(frame, de, de + 16, 0, 1);
	if (t <= 0 || t >= 1) return null;
	return (
		<g opacity={1 - t}>
			{[-1, -0.4, 0.4, 1].map((d, i) => (
				<circle key={i} cx={x + d * 160 * t} cy={y - 30 * t - (i % 2) * 20} r={24 + 30 * t} fill={COR.branco} {...TRACO} strokeWidth={4} />
			))}
		</g>
	);
};

// Cena 1 — Beto despenca no banco depois do treino, se acha um queniano e depois olha o relógio sem saber o que fazer.
export const Cena01: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {falas: f, palavra} = tempoDaCena(1);

	const queda = mola(frame, fps, 4, 120);
	const betoY = interpolate(queda, [0, 1], [-520, 720]);
	const queniano = palavra(0, 'queniano');
	const vitoria = entre(frame, queniano - 8, queniano + 2, 0, 1);
	const olhaRelogio = entre(frame, f[0].fim + 4, f[1].i + 6, 0, 1);
	const pose = misturarPoses(misturarPoses('parado', 'susto', vitoria), 'relogio', olhaRelogio);

	// gota de suor caindo em câmera lenta até o relógio
	const tGota = entre(frame, f[1].i + 8, f[1].fim, 0, 1);
	const gota = [1060 + (1000 - 1060) * tGota, 380 + (548 - 380) * tGota * tGota];
	const respingo = entre(frame, f[1].fim, f[1].fim + 10, 0, 1);

	return (
		<Papel
			limpo={
				<BalaoAnimado de={f[1].i} ate={f[1].fim + 12} x={330} y={160} w={440} linhas={['Tá... e agora?']} px={760} py={330} tamanho={46} />
			}
		>
			<Cozinha />
			<rect x={600} y={380} width={720} height={330} rx={60} fill={COR.estofado} {...TRACO} />
			<rect x={560} y={600} width={800} height={190} rx={40} fill={COR.estofadoEscuro} {...TRACO} />
			<Beto
				x={960}
				y={betoY}
				escala={1.2}
				sentado
				pose={pose}
				relogio
				suor
				respiro={respirar(frame * 2.4, 6)}
				boca={olhaRelogio > 0.5 ? 'preocupada' : 'sorriso'}
				olhar={olhaRelogio > 0.5 ? [-8, 10] : [0, 0]}
				sobrancelha={olhaRelogio > 0.5 ? 'triste' : vitoria > 0.5 ? 'alta' : undefined}
				piscar={piscar(frame, 1)}
			/>
			<Poeira x={960} y={700} de={14} />
			{tGota > 0 && respingo < 1 ? (
				respingo <= 0 ? (
					<path d={`M ${gota[0]} ${gota[1]} q -14 24 0 32 q 14 -8 0 -32 Z`} fill={COR.azul} stroke={COR.tinta} strokeWidth={3} />
				) : (
					<g opacity={1 - respingo} stroke={COR.azul} strokeWidth={5} strokeLinecap="round">
						<path d={`M 990 560 l ${-30 * respingo} ${-20 * respingo}`} />
						<path d={`M 1010 560 l ${30 * respingo} ${-20 * respingo}`} />
						<path d={`M 1000 555 l 0 ${-30 * respingo}`} />
					</g>
				)
			) : null}
			{/* mesa */}
			<polygon points="500,640 1420,640 1480,705 440,705" fill={COR.madeira} {...TRACO} />
			<rect x={440} y={705} width={1040} height={32} fill={COR.madeiraEscura} {...TRACO} />
			<rect x={930} y={737} width={60} height={250} fill={COR.madeiraEscura} {...TRACO} />
			<ellipse cx={960} cy={990} rx={150} ry={26} fill={COR.madeiraEscura} {...TRACO} />
			<rect x={600} y={560} width={46} height={100} rx={14} fill="#9AD8FF" {...TRACO} strokeWidth={4} />
			<rect x={610} y={540} width={26} height={24} rx={6} fill={COR.azul} {...TRACO} strokeWidth={4} />
			<path d="M 1240 650 q 60 20 110 -30 q -40 60 -110 50 Z" fill={COR.amarelo} {...TRACO} strokeWidth={4} />
			<Salta de={palavra(0, 'quilômetros')} x={1220} y={575}>
				<text x={1150} y={590} fontFamily={FONTE_MAO} fontSize={48} fill={COR.tinta} transform="rotate(-6 1150 590)">
					10,0 km!
				</text>
			</Salta>
		</Papel>
	);
};

// Objeto que salta na sua palavra e depois fica tremendo de raiva.
const Briguento: React.FC<{de: number; x: number; y: number; children: React.ReactNode}> = ({de, x, y, children}) => {
	const frame = useCurrentFrame();
	const [dx, dy] = frame > de + 10 ? tremer(frame, 3) : [0, 0];
	return (
		<g transform={`translate(${dx} ${dy})`}>
			<Salta de={de} x={x} y={y}>
				{children}
			</Salta>
		</g>
	);
};

// Cena 2 — relógio, caderno, planilha e print aparecem um a um e brigam; a planilha pega fogo.
export const Cena02: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {falas: f, palavra} = tempoDaCena(2);
	const qRel = palavra(0, 'relógio');
	const qCad = palavra(0, 'caderno');
	const qPla = palavra(0, 'planilha');
	const qPri = palavra(0, 'print');
	const desespero = entre(frame, palavra(0, 'parar') - 6, palavra(0, 'parar') + 4, 0, 1);
	const olhar: [number, number] =
		frame >= qPri ? [10, 8] : frame >= qPla ? [10, -8] : frame >= qCad ? [-10, 8] : frame >= qRel ? [-10, -8] : [0, 0];
	const [tx, ty] = frame >= f[1].i ? tremer(frame, 3) : [0, 0];
	const raios = frame > qPri + 8 && Math.floor(frame / 5) % 3 !== 0;
	const fogo = mola(frame, fps, f[1].i + 4);

	return (
		<Papel>
			<Cozinha />
			<g transform={`translate(${tx} ${ty})`}>
				<Beto
					x={960}
					y={640}
					escala={0.95}
					pose={misturarPoses('parado', 'desespero', desespero)}
					boca={desespero > 0.5 ? 'dor' : 'preocupada'}
					sobrancelha="triste"
					olhar={desespero > 0.5 ? [0, -6] : olhar}
					piscar={piscar(frame, 2)}
					respiro={respirar(frame, 3)}
				/>
			</g>
			<Briguento de={qRel} x={420} y={330}>
				<g transform="rotate(-10 420 330)">
					<rect x={385} y={180} width={70} height={300} rx={26} fill={COR.tinta} />
					<circle cx={420} cy={330} r={95} fill="#333" {...TRACO} />
					<circle cx={420} cy={330} r={72} fill={COR.neon} {...TRACO} strokeWidth={4} />
					<OlhosObjeto x={420} y={318} r={18} bravo olhar={[8, 4]} />
					<path d="M 398 365 q 22 -14 44 0" fill="none" {...TRACO} />
				</g>
			</Briguento>
			<Briguento de={qCad} x={425} y={790}>
				<g transform="rotate(8 420 760)">
					<rect x={300} y={640} width={250} height={300} rx={10} fill="#FFE9A8" {...TRACO} />
					{[690, 730, 770, 810, 850, 890].map((yy) => (
						<path key={yy} d={`M 330 ${yy} L 520 ${yy}`} stroke={COR.azul} strokeWidth={3} />
					))}
					<OlhosObjeto x={425} y={720} r={20} bravo olhar={[6, -4]} />
					<ellipse cx={425} cy={800} rx={30} ry={14 + Math.abs(Math.sin(frame / 3)) * 10} fill={COR.tinta} />
				</g>
			</Briguento>
			<Briguento de={qPla} x={1495} y={330}>
				<g transform="rotate(6 1480 330)">
					{fogo > 0.01 ? (
						<g transform={`translate(1495 160) scale(${fogo} ${fogo * (1 + Math.sin(frame / 2) * 0.12)}) translate(-1495 -160)`}>
							<path d="M 1400 150 q 30 -70 60 -10 q 20 -80 60 0 q 40 -60 50 30 Z" fill="#FF8A2B" {...TRACO} strokeWidth={4} />
							<path d="M 1430 160 q 25 -40 45 -5 q 20 -50 45 5 Z" fill={COR.amarelo} />
						</g>
					) : null}
					<rect x={1350} y={160} width={290} height={340} fill={COR.branco} {...TRACO} />
					{[220, 280, 340, 400, 460].map((yy) => (
						<path key={yy} d={`M 1350 ${yy} L 1640 ${yy}`} stroke="#5BBF6A" strokeWidth={3} />
					))}
					{[1447, 1543].map((xx) => (
						<path key={xx} d={`M ${xx} 160 L ${xx} 500`} stroke="#5BBF6A" strokeWidth={3} />
					))}
					<OlhosObjeto x={1495} y={300} r={20} bravo olhar={[-6, 4]} />
					<ellipse cx={1495} cy={380} rx={26} ry={10 + Math.abs(Math.sin(frame / 2.6)) * 10} fill={COR.tinta} />
				</g>
			</Briguento>
			<Briguento de={qPri} x={1505} y={770}>
				<g transform="rotate(-8 1500 760)">
					<rect x={1410} y={600} width={190} height={340} rx={28} fill="#2E2E2E" {...TRACO} />
					<rect x={1424} y={616} width={162} height={308} rx={18} fill="#DDD" />
					<text x={1505} y={900} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={26} fill={COR.tinta}>
						print_032.png
					</text>
					<OlhosObjeto x={1505} y={720} r={20} bravo olhar={[-6, -4]} />
					<path d="M 1480 800 q 25 -16 50 0" fill="none" {...TRACO} />
				</g>
			</Briguento>
			{raios ? (
				<g>
					<path d="M 600 380 l 40 -20 l -10 30 l 50 -16" fill="none" {...TRACO} stroke={COR.vermelho} strokeWidth={7} />
					<path d="M 1250 420 l 40 -20 l -10 30 l 50 -16" fill="none" {...TRACO} stroke={COR.vermelho} strokeWidth={7} />
					<path d="M 600 820 l 40 -20 l -10 30 l 50 -16" fill="none" {...TRACO} stroke={COR.vermelho} strokeWidth={7} />
					<path d="M 1250 800 l 40 -20 l -10 30 l 50 -16" fill="none" {...TRACO} stroke={COR.vermelho} strokeWidth={7} />
				</g>
			) : null}
		</Papel>
	);
};

// Cena 3 — zoom no cantinho da tela: o cursor clica no cacto perto do relógio, ele acende, o Kactus abre
// no PC e no iPhone. O Beto chega correndo, abraça o cacto... e se espeta.
export const Cena03: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {falas: f, palavra} = tempoDaCena(3);
	const qClique = palavra(0, 'clique');
	const qLiga = palavra(0, 'liga');
	const qCel = palavra(0, 'celular');
	const qAmo = palavra(1, 'amo');
	const qAi = palavra(1, 'Ai');

	// câmera: começa colada no ícone e abre para mostrar o monitor inteiro
	const abre = entre(frame, qClique + 10, qLiga + 6, 0, 1);
	const camX = 1300 + (960 - 1300) * abre;
	const camY = 700 + (540 - 700) * abre;
	const zoom = 2.6 + (1 - 2.6) * abre;

	// cursor do mouse indo até o ícone e clicando
	const tCursor = entre(frame, 4, qClique - 2, 0, 1);
	const cursor = [1120 + (1322 - 1120) * tCursor, 560 + (748 - 560) * tCursor];
	const apertando = frame >= qClique && frame < qClique + 5;
	const onda = entre(frame, qClique, qClique + 14, 0, 1);
	const ligado = frame >= qClique + 3;
	const brilho = ligado ? 0.25 + Math.sin(frame / 5) * 0.12 : 0;

	// Beto entra correndo, abraça e se espeta
	const chegada = entre(frame, f[1].i - 14, f[1].i, 0, 1);
	const espetou = frame >= qAi;
	const recuo = espetou ? mola(frame, fps, qAi, 200) * 90 : 0;
	const [tx, ty] = espetou && frame < qAi + 14 ? tremer(frame, 6) : [0, 0];
	const iphone = mola(frame, fps, qCel - 4);

	return (
		<Papel
			limpo={
				<BalaoAnimado de={qAi} ate={f[1].fim + 18} x={1500} y={150} w={240} linhas={['AI!']} px={1560} py={330} tamanho={70} grito cor={COR.amarelo} />
			}
		>
			<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
			<Camera x={camX} y={camY} zoom={zoom}>
				<Monitor x={330} y={130} w={1150} h={640}>
					<rect width={1150} height={640} fill="#101820" />
					<Salta de={qLiga} x={575} y={290}>
						<rect x={250} y={90} width={650} height={400} rx={14} fill={COR.tela} stroke={COR.telaBorda} strokeWidth={3} />
						<LogoKactus x={325} y={230} w={500} />
						<text x={575} y={420} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={30} fill={COR.textoTelaFraco}>
							localhost:3003
						</text>
					</Salta>
					<rect x={0} y={580} width={1150} height={60} fill="#1D1D1D" />
					{ligado ? <circle cx={985} cy={610} r={42} fill={COR.neon} opacity={brilho} /> : null}
					<circle cx={985} cy={610} r={20} fill={ligado ? COR.neon : '#555'} />
					<LogoKactus x={973} y={597} w={24} simbolo />
					<text x={1080} y={621} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={28} fill={COR.textoTela}>
						07:42
					</text>
					<Salta de={qLiga} x={925} y={560}>
						<rect x={760} y={500} width={330} height={60} rx={12} fill="#2A2A2A" />
						<text x={925} y={540} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={24} fill={COR.neon}>
							Kactus Controle · Ligado
						</text>
					</Salta>
				</Monitor>
				{onda > 0 && onda < 1 ? (
					<circle cx={1315} cy={740} r={20 + onda * 60} fill="none" stroke={COR.neon} strokeWidth={6} opacity={1 - onda} />
				) : null}
				{frame < qLiga + 20 ? (
					<g transform={`translate(${cursor[0]} ${cursor[1]}) scale(${apertando ? 0.8 : 1})`}>
						<path d="M 0 0 L 0 46 L 12 34 L 22 56 L 30 52 L 20 31 L 36 31 Z" fill={COR.branco} stroke={COR.tinta} strokeWidth={3} strokeLinejoin="round" />
					</g>
				) : null}
			</Camera>
			<g transform={`translate(${-340 + iphone * 340} 0)`}>
				<Celular x={110} y={520} w={200} h={400} rot={-8}>
					<rect width={200} height={400} fill={COR.tela} />
					<LogoKactus x={50} y={130} w={100} simbolo />
					<text x={100} y={330} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={22} fill={COR.textoTelaFraco}>
						no iPhone também
					</text>
				</Celular>
			</g>
			{chegada > 0 ? (
				<g transform={`translate(${tx} ${ty})`}>
					<Beto
						x={2140 + (1620 - 2140) * chegada + recuo}
						y={800}
						escala={0.9}
						espelhar
						pose={espetou ? 'susto' : chegada < 1 ? 'parado' : 'abraco'}
						andar={chegada < 1 ? frame * 0.7 : undefined}
						boca={espetou ? 'dor' : 'sorriso'}
						olhar={[-8, 0]}
						sobrancelha={espetou ? 'triste' : 'alta'}
						piscar={piscar(frame, 3)}
					/>
				</g>
			) : null}
			{frame >= qAmo && !espetou ? (
				<g transform={`translate(1380 300) scale(${1 + Math.sin(frame / 3) * 0.12}) translate(-1380 -300)`}>
					<path d="M 1380 300 c -20 -30 -60 0 0 40 c 60 -40 20 -70 0 -40 Z" fill={COR.vermelho} {...TRACO} strokeWidth={4} />
				</g>
			) : null}
		</Papel>
	);
};

const BolinhaFit: React.FC<{rot?: number}> = ({rot = 0}) => (
	<g transform={`rotate(${rot})`}>
		<circle r={42} fill={COR.branco} {...TRACO} />
		<path d="M -30 -10 l 20 8 l 12 -20 l 14 22 l 18 -6 M -24 18 l 18 -6 l 16 14 l 14 -10" fill="none" {...TRACO} strokeWidth={3} />
		<text y={10} textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={22} fill={COR.tinta} opacity={0.75}>
			.fit
		</text>
	</g>
);

// Plaquinha que sai voando de dentro do monitor até o seu lugar.
const PlaquinhaVoa: React.FC<React.ComponentProps<typeof Plaquinha> & {de: number}> = ({de, x, y, ...resto}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const m = mola(frame, fps, de, 150);
	if (m < 0.01) return null;
	const px = 1330 + (x - 1330) * m;
	const py = 500 + (y - 500) * m;
	return (
		<g transform={`translate(${px} ${py}) scale(${0.3 + 0.7 * Math.min(1, m)}) translate(${-px} ${-py})`}>
			<Plaquinha x={px} y={py} {...resto} />
		</g>
	);
};

// Cena 4 — Beto amassa o arquivo, arremessa de três pontos no Importar e o app cospe os números.
export const Cena04: React.FC = () => {
	const frame = useCurrentFrame();
	const {falas: f, palavra} = tempoDaCena(4);
	const qArquivo = palavra(0, 'arquivo');
	const qJogo = palavra(0, 'jogo');
	const pouso = qJogo + 26;
	const preparo = entre(frame, qJogo - 10, qJogo, 0, 1);
	const comemora = entre(frame, pouso, pouso + 8, 0, 1);
	const aponta = entre(frame, f[1].i - 4, f[1].i + 6, 0, 1);
	const pose = misturarPoses(misturarPoses(misturarPoses('parado', 'arremesso', preparo), 'susto', comemora), 'apontar', aponta);

	const voo = entre(frame, qJogo, pouso, 0, 1);
	const bola = naCurva([466, 395], [900, -80], [1330, 520], voo);
	const rastro: string[] = [];
	for (let t = 0; t <= voo; t += 0.04) {
		const [x, y] = naCurva([466, 395], [900, -80], [1330, 520], t);
		rastro.push(`${x},${y}`);
	}
	const flash = frame >= pouso ? entre(frame, pouso, pouso + 14, 1, 0) : 0;
	const progresso = entre(frame, pouso + 4, f[1].i + 12, 0, 1);
	const texto = frame < pouso ? 'Solte o arquivo aqui' : progresso < 1 ? 'Calculando...' : 'Pronto! ✓';

	return (
		<Papel
			limpo={
				<BalaoAnimado de={palavra(0, 'Três')} ate={f[0].fim + 14} x={110} y={110} w={460} linhas={['Três pontos!']} px={330} py={300} tamanho={46} />
			}
		>
			<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
			<Monitor x={880} y={250} w={900} h={500}>
				<text x={40} y={70} fontFamily={FONTE} fontWeight={700} fontSize={30} fill={COR.textoTelaFraco}>
					Perfil › Importar
				</text>
				<rect x={40} y={110} width={820} height={340} rx={24} fill="#0F1A12" stroke={COR.neon} strokeWidth={5} strokeDasharray="22 16" />
				{flash > 0 ? <rect x={40} y={110} width={820} height={340} rx={24} fill={COR.neon} opacity={flash * 0.6} /> : null}
				<text x={450} y={270} textAnchor="middle" fontFamily={FONTE} fontWeight={900} fontSize={44} fill={progresso >= 1 ? COR.neon : COR.textoTela}>
					{texto}
				</text>
				{frame < pouso ? (
					<text x={450} y={330} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={30} fill={COR.textoTelaFraco}>
						.fit · .gpx · .tcx · .csv
					</text>
				) : (
					<>
						<rect x={200} y={315} width={500} height={22} rx={11} fill="#333" />
						<rect x={200} y={315} width={500 * progresso} height={22} rx={11} fill={COR.neon} />
					</>
				)}
			</Monitor>
			{voo > 0 && voo < 1 ? (
				<>
					<polyline points={rastro.join(' ')} fill="none" stroke={COR.tinta} strokeWidth={5} strokeDasharray="4 18" strokeLinecap="round" />
					<g transform={`translate(${bola[0]} ${bola[1]})`}>
						<BolinhaFit rot={voo * 540} />
					</g>
				</>
			) : null}
			<Beto
				x={380}
				y={760}
				pose={pose}
				boca={comemora > 0.5 ? 'sorriso' : 'neutra'}
				olhar={frame >= qJogo && frame < pouso + 10 ? [10, -10] : [6, 0]}
				sobrancelha="alta"
				piscar={piscar(frame, 1)}
				respiro={respirar(frame, 3)}
			>
				{frame >= qArquivo && frame < qJogo ? (
					<g transform={`scale(${mola(frame, 30, qArquivo) * 0.7})`}>
						<BolinhaFit />
					</g>
				) : null}
			</Beto>
			<PlaquinhaVoa de={palavra(1, 'ritmo')} x={1000} y={160} texto="Ritmo 5:12/km" rot={-8} tamanho={34} />
			<PlaquinhaVoa de={palavra(1, 'carga')} x={1770} y={230} texto="Carga 78" rot={10} tamanho={34} cor={COR.rosa} />
			<PlaquinhaVoa de={palavra(1, 'recordes')} x={640} y={250} texto="RECORDE! 5 km" rot={-4} tamanho={40} cor={COR.lima} />
			<PlaquinhaVoa de={palavra(1, 'movimento')} x={1450} y={110} texto="Em movimento 52:10" rot={5} tamanho={34} cor={COR.estofado} />
			<PlaquinhaVoa de={palavra(1, 'pastel')} x={1480} y={830} texto="sem a parada no pastel" rot={-3} tamanho={34} cor={COR.amarelo} />
		</Papel>
	);
};
