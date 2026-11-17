import math, random
from collections import Counter
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

FEATURES = ["Deadline", "Konsumsi Kopi", "Jadwal Besok", "Penggunaan Gawai"]
ROWS = [
    ["Besok", "Banyak", "Pagi", "Sedang", "Ya"],
    ["Besok", "Sedikit", "Pagi", "Jarang", "Ya"],
    ["Besok", "Tidak", "Siang", "Sedang", "Ya"],
    ["Besok", "Banyak", "Libur", "Sering", "Ya"],
    ["Minggu Ini", "Banyak", "Siang", "Sering", "Ya"],
    ["Minggu Ini", "Sedikit", "Pagi", "Jarang", "Tidak"],
    ["Minggu Ini", "Tidak", "Pagi", "Sedang", "Tidak"],
    ["Minggu Ini", "Banyak", "Libur", "Sedang", "Ya"],
    ["Tidak Ada", "Tidak", "Pagi", "Jarang", "Tidak"],
    ["Tidak Ada", "Sedikit", "Siang", "Sedang", "Tidak"],
    ["Tidak Ada", "Banyak", "Libur", "Sering", "Ya"],
    ["Tidak Ada", "Tidak", "Libur", "Sering", "Ya"],
    ["Tidak Ada", "Sedikit", "Pagi", "Sering", "Tidak"],
    ["Minggu Ini", "Sedikit", "Siang", "Sering", "Ya"],
]
TARGET = ["Minggu Ini", "Sedikit", "Pagi", "Sering"]
MANUAL = [
    {"ids": [5, 1, 12, 9, 8, 14, 6, 7, 1, 3, 3, 13, 7, 14],
     "cands": "Konsumsi Kopi, Penggunaan Gawai\nDeadline, Konsumsi Kopi\nKonsumsi Kopi, Jadwal Besok\nDeadline, Konsumsi Kopi\nKonsumsi Kopi, Jadwal Besok"},
    {"ids": [3, 3, 8, 4, 11, 5, 8, 13, 8, 7, 2, 14, 1, 10],
     "cands": "Deadline, Penggunaan Gawai\nJadwal Besok, Penggunaan Gawai\nJadwal Besok, Penggunaan Gawai"},
    {"ids": [9, 3, 3, 7, 9, 11, 9, 12, 3, 5, 2, 6, 3, 13],
     "cands": "Jadwal Besok, Penggunaan Gawai\nKonsumsi Kopi, Penggunaan Gawai\nDeadline, Penggunaan Gawai"},
]


def H(p, q):
    t = p + q
    if t == 0:
        return 0.0
    return -sum(c / t * math.log2(c / t) for c in (p, q) if c)


def analyse(rows, f, pos, base):
    n = len(rows)
    groups = {}
    for r in rows:
        groups.setdefault(r["x"][f], []).append(r["y"])
    vals, rem, si = [], 0.0, 0.0
    for v, ys in groups.items():
        p = sum(y == pos for y in ys)
        q = len(ys) - p
        e, w = H(p, q), len(ys) / n
        rem += w * e
        si -= w * math.log2(w)
        vals.append({"v": v, "n": len(ys), "p": p, "q": q, "e": e,
                     "si": -w * math.log2(w)})
    gain = base - rem
    return {"name": f, "values": vals, "gain": gain, "si": si,
            "gr": gain / si if si > 1e-12 else 0.0}


def build(rows, avail, ctx, path):
    labs = [r["y"] for r in rows]
    maj = Counter(labs).most_common(1)[0][0]
    if len(set(labs)) == 1 or not avail:
        return {"leaf": maj, "n": len(rows)}
    pos = ctx["pos"]
    p = sum(y == pos for y in labs)
    q = len(rows) - p
    base = H(p, q)
    if ctx["mode"] == "auto":
        cand = ctx["rng"].sample(avail, min(ctx["m"], len(avail)))
        cand = [f for f in ctx["features"] if f in cand]
    else:
        c = ctx["cands"]
        i = len(ctx["steps"])
        want = c[i] if i < len(c) else []
        cand = [f for f in want if f in avail] or avail[:ctx["m"]]
    if not cand:
        return {"leaf": maj, "n": len(rows)}
    res = [analyse(rows, f, pos, base) for f in cand]
    best = res[0]
    for a in res[1:]:
        if a["gr"] > best["gr"] + 1e-9:
            best = a
    if best["gain"] <= 1e-12:
        return {"leaf": maj, "n": len(rows)}
    ctx["steps"].append({
        "i": len(ctx["steps"]) + 1, "path": path or "Akar", "n": len(rows),
        "rows": [{"id": r["id"], "x": r["x"], "y": r["y"]} for r in rows],
        "avail": list(avail), "cand": cand, "p": p, "q": q, "base": base,
        "feats": res, "best": best["name"]})
    node = {"feature": best["name"], "children": {}, "majority": maj}
    rest = [f for f in avail if f != best["name"]]
    for v in sorted({r["x"][best["name"]] for r in rows}):
        sub = [r for r in rows if r["x"][best["name"]] == v]
        node["children"][v] = build(
            sub, rest, ctx, (path + " → " if path else "") + f"{best['name']} = {v}")
    return node


def predict(node, x):
    trail = []
    while "leaf" not in node:
        v = x.get(node["feature"])
        trail.append(f"{node['feature']} = {v}")
        if v not in node["children"]:
            return node["majority"], trail
        node = node["children"][v]
    return node["leaf"], trail


@app.route("/")
def index():
    return render_template("index.html", features=FEATURES, rows=ROWS,
                           target=TARGET, manual=MANUAL)


@app.route("/api/build", methods=["POST"])
def api_build():
    d = request.get_json(force=True)
    feats, data, target = d["features"], d["rows"], d["target"]
    m = max(1, int(d.get("m", 2)))
    if len(feats) < 1 or len(data) < 2:
        return jsonify(error="Minimal 1 fitur dan 2 baris data."), 400
    rows = [{"id": i + 1, "x": dict(zip(feats, r[:-1])), "y": r[-1]}
            for i, r in enumerate(data)]
    classes = sorted({r["y"] for r in rows})
    if len(classes) != 2:
        return jsonify(error="Dataset harus tepat dua kelas."), 400
    pos = "Ya" if "Ya" in classes else classes[0]
    tx = dict(zip(feats, target))
    seed = d.get("seed")
    rng = random.Random(int(seed)) if str(seed or "").strip() else random.Random()
    out, votes = [], Counter()
    for t, cfg in enumerate(d["trees"], 1):
        if cfg["mode"] == "manual":
            try:
                ids = [int(s) for s in str(cfg["ids"]).replace(";", ",").split(",") if s.strip()]
            except ValueError:
                return jsonify(error=f"Pohon {t}: ID baris harus angka."), 400
            if len(ids) != len(rows) or any(i < 1 or i > len(rows) for i in ids):
                return jsonify(error=f"Pohon {t}: masukkan tepat {len(rows)} ID baris (1-{len(rows)})."), 400
        else:
            ids = [rng.choice(rows)["id"] for _ in rows]
        boot = [rows[i - 1] for i in ids]
        ctx = {"mode": cfg["mode"], "m": m, "rng": rng, "pos": pos, "steps": [],
               "features": feats,
               "cands": [[s.strip() for s in ln.split(",") if s.strip()]
                         for ln in str(cfg.get("cands", "")).splitlines()]}
        tree = build(boot, list(feats), ctx, "")
        label, trail = predict(tree, tx)
        votes[label] += 1
        out.append({"ids": ids, "oob": [r["id"] for r in rows if r["id"] not in ids],
                    "steps": ctx["steps"], "tree": tree, "pred": label, "trail": trail})
    final = votes.most_common(1)[0][0]
    return jsonify(trees=out, votes=votes, final=final, pos=pos, classes=classes)


if __name__ == "__main__":
    app.run(debug=True)
