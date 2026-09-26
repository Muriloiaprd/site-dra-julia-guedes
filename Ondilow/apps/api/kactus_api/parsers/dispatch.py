"""Detecta o formato do arquivo e delega ao parser correto."""

import gzip

from kactus_api.parsers.base import NormalizedActivity
from kactus_api.parsers.csv_parser import parse_csv
from kactus_api.parsers.fit import parse_fit
from kactus_api.parsers.gpx import parse_gpx
from kactus_api.parsers.tcx import parse_tcx


class UnsupportedFormatError(Exception):
    """Formato de arquivo nao suportado."""


def parse_file(filename: str, content: bytes) -> list[NormalizedActivity]:
    """Retorna sempre uma lista (FIT/GPX/TCX = 1 item; CSV = N)."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "gz":
        # Export em massa do Garmin Connect entrega .fit como .fit.gz.
        try:
            content = gzip.decompress(content)
        except OSError as e:
            raise UnsupportedFormatError(f"Arquivo .gz corrompido ou invalido: '{filename}'") from e
        return parse_file(filename[: -len(".gz")], content)

    if ext == "fit":
        return [parse_fit(content)]
    if ext == "gpx":
        return [parse_gpx(content)]
    if ext == "tcx":
        return [parse_tcx(content)]
    if ext == "csv":
        return parse_csv(content)

    detected = _sniff(content)
    if detected == "fit":
        return [parse_fit(content)]
    if detected == "gpx":
        return [parse_gpx(content)]
    if detected == "tcx":
        return [parse_tcx(content)]

    raise UnsupportedFormatError(f"Formato nao suportado: '{filename}'")


def _sniff(content: bytes) -> str | None:
    head = content[:512].lstrip()
    if len(content) > 12 and content[8:12] == b".FIT":
        return "fit"
    lowered = head.lower()
    if b"<gpx" in lowered:
        return "gpx"
    if b"trainingcenterdatabase" in lowered:
        return "tcx"
    return None
