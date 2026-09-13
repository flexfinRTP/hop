import os

p = r"C:\Appdev\etho26\apps\web\public\brand\pitch"
for n in os.listdir(p):
    if not n.endswith(".png"):
        continue
    src = os.path.join(p, n)
    with open(src, "rb") as f:
        h = f.read(3)
    if h != b"\xff\xd8\xff":
        print("skip", n, h)
        continue
    dst = os.path.join(p, n[:-4] + ".jpg")
    if os.path.exists(dst):
        os.remove(dst)
    os.replace(src, dst)
    print("renamed", n, "->", os.path.basename(dst))
