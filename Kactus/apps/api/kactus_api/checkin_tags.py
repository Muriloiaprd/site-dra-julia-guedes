"""Etiquetas prontas do check-in pos-treino: marcacoes rapidas que o atleta faz
em vez de escrever. O codigo vai pro banco (activities.checkin_tags); o rotulo
e o que a tela mostra e o que a Duni le."""

CHECKIN_TAG_GROUPS: list[tuple[str, list[tuple[str, str]]]] = [
    ("Clima", [
        ("calor", "Calor"),
        ("frio", "Frio"),
        ("chuva", "Chuva"),
        ("vento", "Vento"),
        ("umidade_alta", "Umidade alta"),
    ]),
    ("Corpo e rotina", [
        ("dormi_bem", "Dormi bem"),
        ("dormi_mal", "Dormi mal"),
        ("estresse", "Estresse"),
        ("em_jejum", "Em jejum"),
        ("bem_alimentado", "Bem alimentado"),
    ]),
    ("Treino", [
        ("como_planejado", "Como planejado"),
        ("ritmo_travou", "Ritmo travou"),
        ("terminei_forte", "Terminei forte"),
        ("parei_para_descansar", "Parei para descansar"),
        ("subidas", "Subidas"),
        ("tenis_novo", "Tênis novo"),
        ("em_grupo", "Em grupo"),
        ("esteira", "Esteira"),
    ]),
]

CHECKIN_TAGS: dict[str, str] = {code: label for _, tags in CHECKIN_TAG_GROUPS for code, label in tags}


def tag_labels(codes: list[str] | None) -> list[str] | None:
    """Rotulos na ordem do catalogo; codigo que saiu do catalogo e ignorado."""
    if not codes:
        return None
    labels = [label for code, label in CHECKIN_TAGS.items() if code in codes]
    return labels or None
