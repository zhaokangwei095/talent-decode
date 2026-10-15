"""
按页面实际用字子集化标题衬线字体。

中文 Web 字体全量约 2MB/字重，而本页用到的汉字只有几百个。
这里从源码中提取全部会出现的字符，裁出最小字体，产物放 assets/fonts/。

用法：python tools/subset-font.py
需要：pip install fonttools brotli
"""
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "fonts"

SOURCES = [
    ROOT / "index.html",
    ROOT / "assets" / "css" / "design.css",
    ROOT / "assets" / "js" / "app.js",
    ROOT / "assets" / "js" / "render.js",
    ROOT / "assets" / "js" / "engine.js",
    ROOT / "data" / "talent-data.js",
    ROOT / "data" / "talent-data-extra.js",
]

# 字重 -> jsDelivr 上的全量 woff2
FONTS = {
    400: "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.0.0/files/noto-serif-sc-chinese-simplified-400-normal.woff2",
    700: "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.0.0/files/noto-serif-sc-chinese-simplified-700-normal.woff2",
}


def collect_chars() -> set:
    """把源码里所有可能渲染出来的字符收齐，宁可多不可少。"""
    chars = set()
    for path in SOURCES:
        chars |= set(path.read_text(encoding="utf-8"))

    # 数值、标点、拉丁字母：运行时才产生的也要留足
    chars |= set("0123456789")
    chars |= set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
    chars |= set(" .,:;!?/\\|-_+*=()[]{}<>'\"`~@#$%^&")
    chars |= set("、。，；：？！“”‘’（）《》〈〉【】—…·「」『』％＃＆＊＋－＝／")
    chars |= set("§①②③④⑤★☆✓✘＋－⟷→←↑↓〇")
    return chars


def main() -> int:
    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError:
        print("缺少依赖：pip install fonttools brotli", file=sys.stderr)
        return 1

    chars = collect_chars()
    text = "".join(sorted(chars))
    print(f"收录字符 {len(chars)} 个")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp_dir = OUT_DIR / "_raw"
    tmp_dir.mkdir(exist_ok=True)

    for weight, url in FONTS.items():
        raw = tmp_dir / f"noto-serif-sc-{weight}.woff2"
        if not raw.exists():
            print(f"下载 {weight} …")
            with urllib.request.urlopen(url, timeout=120) as resp:
                raw.write_bytes(resp.read())
        print(f"  原始大小 {raw.stat().st_size / 1024:.0f} KB")

        out = OUT_DIR / f"noto-serif-sc-{weight}-subset.woff2"
        args = [
            str(raw),
            f"--text={text}",
            "--flavor=woff2",
            "--layout-features=*",
            "--no-hinting",
            "--desubroutinize",
            f"--output-file={out}",
        ]
        subset.main(args)
        print(f"  子集大小 {out.stat().st_size / 1024:.0f} KB -> {out.relative_to(ROOT)}")

    # 清掉中间产物
    for f in tmp_dir.glob("*"):
        f.unlink()
    tmp_dir.rmdir()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
