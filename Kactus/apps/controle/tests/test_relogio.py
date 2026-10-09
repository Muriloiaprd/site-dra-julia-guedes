"""Relógio no USB: acha os treinos novos, importa uma vez só e avisa."""

from pathlib import Path

from kactus_controle.relogio import ArquivoRelogio, VigiaRelogio, arquivos_em_unidades, ler_lista_mtp, texto_resultado


def test_mtp_list_accepts_single_object_and_hidden_extension() -> None:
    um = ler_lista_mtp('{"dispositivo":"Forerunner 265","nome":"2026-10-08-07-12-33","tamanho":51234}')
    assert um == [ArquivoRelogio("mtp", "Forerunner 265", "2026-10-08-07-12-33")]
    varios = ler_lista_mtp('[{"dispositivo":"FR","nome":"A1.FIT"},{"dispositivo":"FR","nome":"notas.txt"}]')
    assert [a.nome for a in varios] == ["A1.FIT"]
    assert ler_lista_mtp("") == [] and ler_lista_mtp("lixo") == []


def test_drive_letter_watch(tmp_path, monkeypatch) -> None:
    pasta = tmp_path / "GARMIN" / "Activity"
    pasta.mkdir(parents=True)
    (pasta / "B1.FIT").write_bytes(b"fit")
    (pasta / "leia.txt").write_text("x")
    real = Path

    def fake_path(p: str):
        return real(str(p).replace("Z:/", str(tmp_path) + "/")) if str(p).startswith("Z:/") else real(p)

    monkeypatch.setattr("kactus_controle.relogio.Path", fake_path)
    achados = arquivos_em_unidades("Z")
    assert [(a.origem, a.dispositivo, a.nome) for a in achados] == [("unidade", "Z:", "B1.FIT")]


def _vigia(tmp_path, achados, resultado, avisos, importados):
    def copiar(arquivos, destino: Path):
        destino.mkdir(parents=True, exist_ok=True)
        out = []
        for a in arquivos:
            p = destino / (a.nome if a.nome.lower().endswith(".fit") else a.nome + ".fit")
            p.write_bytes(b"fit")
            out.append(p)
        return out

    def importar(arquivos):
        importados.append([p.name for p in arquivos])
        return resultado

    return VigiaRelogio(
        ativo=lambda: True,
        ao_terminar=lambda texto, res: avisos.append(texto),
        achar=lambda: achados,
        copiar=copiar,
        importar=importar,
        vistos_arquivo=tmp_path / "vistos.json",
        chegada=tmp_path / "chegada",
    )


def test_imports_new_files_once_and_remembers(tmp_path) -> None:
    achados = [ArquivoRelogio("mtp", "FR", "A1"), ArquivoRelogio("mtp", "FR", "A2.FIT")]
    avisos, importados = [], []
    res = {"importadas": 2, "duplicadas": 0, "erros": [], "atividades": ["x", "y"]}
    v = _vigia(tmp_path, achados, res, avisos, importados)

    assert v.passo() == res
    assert importados == [["A1.fit", "A2.FIT"]]
    assert avisos == ["2 treinos novos do relógio no Kactus"]
    assert v.passo() is None  # já visto: não importa de novo
    assert importados == [["A1.fit", "A2.FIT"]]
    # lembra entre execuções do Controle
    assert _vigia(tmp_path, achados, res, [], []).vistos == {"FR|a1", "FR|a2"}
    assert not (tmp_path / "chegada").exists() or not any((tmp_path / "chegada").iterdir())


def test_failure_warns_and_retries_later(tmp_path) -> None:
    avisos, importados = [], []
    v = _vigia(tmp_path, [ArquivoRelogio("mtp", "FR", "A1")], {}, avisos, importados)

    def quebra(_arquivos):
        raise RuntimeError("banco fora do ar")

    v._importar = quebra
    assert v.passo() is None
    assert avisos == ["Não consegui importar do relógio: banco fora do ar"]
    assert v.vistos == set()  # tenta de novo na próxima


def test_force_reimports_everything(tmp_path) -> None:
    avisos, importados = [], []
    res = {"importadas": 0, "duplicadas": 1, "erros": [], "atividades": []}
    v = _vigia(tmp_path, [ArquivoRelogio("unidade", "E:", "A1.FIT")], res, avisos, importados)
    v.passo()
    v.passo(forcar=True)
    assert len(importados) == 2 and avisos[-1] == "0 treinos novos do relógio no Kactus · 1 já estava lá"


def test_result_text() -> None:
    assert texto_resultado({"importadas": 1, "duplicadas": 2, "erros": [{"arquivo": "a", "erro": "x"}]}) == (
        "1 treino novo do relógio no Kactus · 2 já estavam lá · 1 com erro"
    )
