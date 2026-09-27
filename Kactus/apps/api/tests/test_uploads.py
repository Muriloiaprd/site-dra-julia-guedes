from kactus_api.config import settings
from kactus_api.services.uploads import resolve_upload_path


def test_finds_file_after_project_folder_moved(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", str(tmp_path))
    user_dir = tmp_path / "uploads" / "user-1"
    user_dir.mkdir(parents=True)
    (user_dir / "abc.fit").write_bytes(b"x")

    old = r"C:\Cloude Code\Ondilow\apps\api\data\uploads\user-1\abc.fit"
    assert resolve_upload_path(old) == tmp_path / "uploads" / "user-1" / "abc.fit"
    assert resolve_upload_path(str(user_dir / "abc.fit")) == user_dir / "abc.fit"


def test_missing_file_or_path(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", str(tmp_path))
    assert resolve_upload_path(None) is None
    assert resolve_upload_path(r"C:\x\data\uploads\user-1\nao-existe.gpx") is None
