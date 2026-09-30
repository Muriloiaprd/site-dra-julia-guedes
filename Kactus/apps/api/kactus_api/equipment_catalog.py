"""Catalogo de equipamentos recomendados, por esporte, categoria e faixa de preco.

Montado em set/2026 a partir de reviews (RunRepeat, The Run Testers, iRunFar,
BikeRadar, Cyclingnews) e de lojas brasileiras. Os precos sao faixas
aproximadas em R$ e mudam com promocao: a tela sempre manda conferir na loja.
Atualizar = editar esta lista e CATALOG_UPDATED_AT (nao ha banco envolvido)."""

from dataclasses import asdict, dataclass

CATALOG_UPDATED_AT = "2026-09"

TIERS = ("entrada", "intermediario", "topo")


@dataclass(frozen=True, slots=True)
class CatalogItem:
    sport: str  # run | bike | swim
    category: str
    tier: str  # entrada | intermediario | topo
    brand: str
    model: str
    why: str
    price_brl: str
    equipment_type: str  # tipo do cadastro de equipamento: shoe, watch, bike, swimsuit, wetsuit, hr_strap, other


SPORTS = {"run": "Corrida", "bike": "Ciclismo", "swim": "Natação"}

CATEGORIES: dict[str, list[tuple[str, str]]] = {
    "run": [
        ("tenis_dia_a_dia", "Tênis para o dia a dia"),
        ("tenis_rapido", "Tênis para treino rápido"),
        ("tenis_prova", "Tênis de prova (placa de carbono)"),
        ("tenis_trilha", "Tênis de trilha"),
        ("relogio", "Relógio GPS"),
        ("cinta", "Cinta cardíaca"),
    ],
    "bike": [
        ("capacete", "Capacete"),
        ("ciclocomputador", "Ciclocomputador"),
        ("sensor", "Sensor de cadência / potência"),
    ],
    "swim": [
        ("oculos", "Óculos"),
        ("roupa_natacao", "Roupa de treino"),
        ("wetsuit", "Wetsuit (águas abertas)"),
    ],
}

CATALOG: list[CatalogItem] = [
    # ── corrida: tenis para o dia a dia ──
    CatalogItem("run", "tenis_dia_a_dia", "entrada", "Olympikus", "Corre 4", "Nacional versátil: aguenta do 5 km à meia maratona.", "R$ 400–500", "shoe"),
    CatalogItem("run", "tenis_dia_a_dia", "intermediario", "ASICS", "Novablast 5", "Macio e responsivo: serve para rodagem e para um ritmo mais forte.", "R$ 800–1.100", "shoe"),
    CatalogItem("run", "tenis_dia_a_dia", "topo", "New Balance", "Fresh Foam X 1080v15", "Muito amortecimento sem ficar pesado; ótimo para longão.", "R$ 1.100–1.400", "shoe"),
    # ── corrida: treino rapido ──
    CatalogItem("run", "tenis_rapido", "entrada", "Olympikus", "Corre Turbo", "Leve e rápido pelo preço de um tênis de rodagem.", "R$ 650–750", "shoe"),
    CatalogItem("run", "tenis_rapido", "intermediario", "Adidas", "Adizero Evo SL", "Espuma de tênis de prova sem placa: intervalado, tempo run e prova.", "R$ 900–1.200", "shoe"),
    CatalogItem("run", "tenis_rapido", "topo", "ASICS", "Megablast", "Rápido e confortável ao mesmo tempo; vai de tiro a longão.", "R$ 1.500–1.900", "shoe"),
    # ── corrida: prova ──
    CatalogItem("run", "tenis_prova", "entrada", "Kiprun", "Kipstorm Tempo", "Placa de nylon e espuma de prova pela metade do preço dos carbonos.", "R$ 700–900", "shoe"),
    CatalogItem("run", "tenis_prova", "intermediario", "Puma", "Fast-R Nitro Elite 3", "Placa de carbono longa, muito eficiente em ritmo de prova.", "R$ 1.600–2.000", "shoe"),
    CatalogItem("run", "tenis_prova", "topo", "ASICS", "Metaspeed Sky Tokyo", "Referência atual em prova de qualquer distância.", "R$ 2.000–2.500", "shoe"),
    # ── corrida: trilha ──
    CatalogItem("run", "tenis_trilha", "entrada", "ASICS", "Gel-Venture 10", "Solado com cravo para terra batida, sem gastar muito.", "R$ 400–550", "shoe"),
    CatalogItem("run", "tenis_trilha", "intermediario", "Salomon", "Sense Ride 5", "Aderência boa em terreno misto, confortável em treino longo.", "R$ 800–1.000", "shoe"),
    CatalogItem("run", "tenis_trilha", "topo", "Hoka", "Speedgoat 6", "Amortecimento alto e cravo agressivo para montanha.", "R$ 1.100–1.400", "shoe"),
    # ── corrida: relogio ──
    CatalogItem("run", "relogio", "entrada", "Garmin", "Forerunner 165", "Tudo o que precisa para treinar, fácil de usar.", "R$ 1.800–2.300", "watch"),
    CatalogItem("run", "relogio", "intermediario", "Garmin", "Forerunner 265", "O melhor equilíbrio de GPS, bateria e recursos de treino.", "R$ 3.100–3.900", "watch"),
    CatalogItem("run", "relogio", "topo", "Garmin", "Forerunner 970", "O mais completo para corrida, com mapa e lanterna.", "R$ 5.000–6.000", "watch"),
    # ── corrida: cinta ──
    CatalogItem("run", "cinta", "entrada", "Coospo", "H808S", "FC do peito (mais precisa que o pulso) por pouco.", "R$ 150–250", "hr_strap"),
    CatalogItem("run", "cinta", "intermediario", "Polar", "H10", "Referência de precisão, conecta em relógio e celular.", "R$ 500–700", "hr_strap"),
    CatalogItem("run", "cinta", "topo", "Garmin", "HRM 600", "Precisão e dinâmica de corrida direto no Garmin.", "R$ 900–1.200", "hr_strap"),
    # ── ciclismo ──
    CatalogItem("bike", "capacete", "entrada", "Specialized", "Align II MIPS", "Proteção MIPS com bom preço.", "R$ 450–600", "other"),
    CatalogItem("bike", "capacete", "intermediario", "Giro", "Syntax MIPS", "Leve e bem ventilado para treino longo.", "R$ 900–1.200", "other"),
    CatalogItem("bike", "capacete", "topo", "Kask", "Protone Icon", "Aerodinâmico e ventilado, de competição.", "R$ 2.200–2.800", "other"),
    CatalogItem("bike", "ciclocomputador", "entrada", "Magene", "C606", "Tela grande e navegação por um preço baixo.", "R$ 800–1.100", "other"),
    CatalogItem("bike", "ciclocomputador", "intermediario", "Garmin", "Edge Explore 2", "Mapa e rotas de Garmin, tela touch grande.", "R$ 2.000–2.600", "other"),
    CatalogItem("bike", "ciclocomputador", "topo", "Garmin", "Edge 1050", "O mais completo, para treino estruturado e rotas.", "R$ 4.500–5.500", "other"),
    CatalogItem("bike", "sensor", "entrada", "Magene", "S3+", "Cadência ou velocidade, ANT+ e Bluetooth.", "R$ 120–200", "other"),
    CatalogItem("bike", "sensor", "intermediario", "Garmin", "Cadence Sensor 2", "Instala em segundos e conversa com qualquer aparelho.", "R$ 350–450", "other"),
    CatalogItem("bike", "sensor", "topo", "Favero", "Assioma Duo", "Medidor de potência no pedal: o melhor dado para treinar bike.", "R$ 4.500–5.500", "other"),
    # ── natacao ──
    CatalogItem("swim", "oculos", "entrada", "Speedo", "Hydropure", "Veda bem e não embaça fácil.", "R$ 120–180", "other"),
    CatalogItem("swim", "oculos", "intermediario", "Arena", "Cobra Ultra Swipe", "Lente antiembaçante que se renova ao passar o dedo.", "R$ 300–400", "other"),
    CatalogItem("swim", "oculos", "topo", "Form", "Smart Swim 2", "Mostra tempo, distância e FC dentro da lente.", "R$ 1.800–2.300", "other"),
    CatalogItem("swim", "roupa_natacao", "entrada", "Speedo", "Endurance+", "Tecido que resiste ao cloro por muito tempo.", "R$ 150–250", "swimsuit"),
    CatalogItem("swim", "roupa_natacao", "intermediario", "Arena", "Powerskin ST Next", "De competição, com compressão leve.", "R$ 600–900", "swimsuit"),
    CatalogItem("swim", "roupa_natacao", "topo", "Speedo", "Fastskin LZR Pure Intent", "Traje de prova de alto nível.", "R$ 2.000–2.800", "swimsuit"),
    CatalogItem("swim", "wetsuit", "entrada", "Zone3", "Advance", "Aquece e ajuda a boiar sem custar caro.", "R$ 1.800–2.500", "wetsuit"),
    CatalogItem("swim", "wetsuit", "intermediario", "Orca", "Athlex Flow", "Flexível nos ombros, bom para triathlon.", "R$ 3.000–4.000", "wetsuit"),
    CatalogItem("swim", "wetsuit", "topo", "Orca", "Alpha", "Muito leve e flexível; de competição.", "R$ 5.000–6.500", "wetsuit"),
]


def catalog_for(sport: str) -> list[dict]:
    """Categorias do esporte, cada uma com os itens na ordem entrada -> topo."""
    out = []
    for cat_id, label in CATEGORIES[sport]:
        items = sorted(
            (asdict(i) for i in CATALOG if i.sport == sport and i.category == cat_id),
            key=lambda i: TIERS.index(i["tier"]),
        )
        out.append({"id": cat_id, "label": label, "itens": items})
    return out
