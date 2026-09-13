from pathlib import Path

p = Path(r"C:\Appdev\etho26\apps\web\public\pitch.html")
t = p.read_text(encoding="utf-8")
parts: list[str] = []
i = 0
marker = "/brand/pitch/"
while True:
    j = t.find(marker, i)
    if j < 0:
        parts.append(t[i:])
        break
    parts.append(t[i:j])
    k = t.find('"', j)
    url = t[j:k]
    if url.endswith(".png"):
        url = url[:-4] + ".jpg"
    parts.append(url)
    i = k
out = "".join(parts)
p.write_text(out, encoding="utf-8")
urls = [u for u in out.split('"') if u.startswith("/brand/pitch/")]
print("urls", *urls, sep="\n")
