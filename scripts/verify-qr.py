"""Decodifica os QR gerados por src/lib/qr.ts (amostras de tests/unit/qr.test.ts) com pyzbar e OpenCV.
Uso: QR_SAMPLES=<dir> pnpm exec vitest run tests/unit/qr.test.ts && python -I scripts/verify-qr.py <dir>
"""
import json
import subprocess
import sys
from pathlib import Path

import cv2

try:  # pyzbar depende de libzbar/libiconv nativos; ausentes neste Windows (registrado em docs).
    from pyzbar.pyzbar import decode
except Exception:  # noqa: BLE001
    decode = None

d = Path(sys.argv[1])
expected = json.loads((d / "expected.json").read_text(encoding="utf-8"))
ok = True
for i, text in enumerate(expected):
    svg, png = d / f"qr-{i}.svg", d / f"qr-{i}.png"
    subprocess.run(["node", "-e", f"require('sharp')(require('fs').readFileSync({json.dumps(str(svg))})).png().toFile({json.dumps(str(png))})"], check=True)
    img = cv2.imread(str(png))
    z = [r.data.decode("utf-8") for r in decode(img)] if decode else None
    cv, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    good = cv == text and (z is None or z == [text])
    ok &= good
    print(("OK  " if good else "FALHA"), i, len(text), "bytes | opencv:", cv == text, "| pyzbar:", "indisponível" if z is None else z == [text])
sys.exit(0 if ok else 1)
