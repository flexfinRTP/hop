import os
root = r"C:\Appdev\etho26\apps\web\public\brand"
for dirpath, _, files in os.walk(root):
    for n in files:
        if not n.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".svg")):
            continue
        fp = os.path.join(dirpath, n)
        with open(fp, "rb") as f:
            head = f.read(16)
        kind = "?"
        if head.startswith(b"\x89PNG"):
            kind = "PNG"
        elif head.startswith(b"\xff\xd8"):
            kind = "JPEG"
        elif head.startswith(b"RIFF") and b"WEBP" in head:
            kind = "WEBP"
        elif head.startswith(b"<svg") or head.startswith(b"<?xml") or b"<svg" in head[:16].lower():
            kind = "SVG"
        rel = os.path.relpath(fp, root)
        if n.lower().endswith(".png") and kind != "PNG":
            print(f"MISMATCH {rel:50} {kind} {head[:8].hex()}")
        elif n.lower().endswith((".jpg", ".jpeg")) and kind != "JPEG":
            print(f"MISMATCH {rel:50} {kind} {head[:8].hex()}")
