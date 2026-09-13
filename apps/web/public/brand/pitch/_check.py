import os
p = os.path.dirname(os.path.abspath(__file__))
files = sorted(os.listdir(p))
print("count", len(files))
for n in files:
    if n.endswith(".py"):
        continue
    fp = os.path.join(p, n)
    with open(fp, "rb") as f:
        head = f.read(16)
    print(f"{n:30} {os.path.getsize(fp):8} {head[:8].hex()}")
