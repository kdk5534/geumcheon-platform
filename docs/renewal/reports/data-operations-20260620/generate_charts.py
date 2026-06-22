from pathlib import Path
import os
import textwrap

os.environ.setdefault("MPLBACKEND", "Agg")
os.environ.setdefault("MPLCONFIGDIR", str(Path(__file__).resolve().parent / ".mplconfig"))

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns


ROOT = Path(__file__).resolve().parent
TOKENS = {
    "surface": "#FCFCFD",
    "panel": "#FFFFFF",
    "ink": "#1F2430",
    "muted": "#6F768A",
    "grid": "#E6E8F0",
    "axis": "#D7DBE7",
}
BLUE = {"base": "#A3BEFA", "dark": "#2E4780"}
ORANGE = {"base": "#F0986E", "dark": "#804126"}
NEUTRAL = {"light": "#E2E5EA", "dark": "#464C55"}
FONT = ["Malgun Gothic", "Segoe UI", "DejaVu Sans", "sans-serif"]


def theme():
    sns.set_theme(
        style="whitegrid",
        rc={
            "figure.facecolor": TOKENS["surface"],
            "savefig.facecolor": TOKENS["surface"],
            "axes.facecolor": TOKENS["panel"],
            "axes.edgecolor": TOKENS["axis"],
            "axes.labelcolor": TOKENS["ink"],
            "grid.color": TOKENS["grid"],
            "grid.linewidth": 0.8,
            "font.family": "sans-serif",
            "font.sans-serif": FONT,
        },
    )


def header(fig, ax, title, subtitle):
    ax.set_title("")
    fig.subplots_adjust(top=0.78, left=0.19, right=0.97, bottom=0.12)
    left = ax.get_position().x0
    fig.text(left, 0.965, textwrap.fill(title, 54), ha="left", va="top",
             fontsize=15, fontweight="semibold", color=TOKENS["ink"])
    fig.text(left, 0.90, textwrap.fill(subtitle, 90), ha="left", va="top",
             fontsize=9.5, color=TOKENS["muted"])
    sns.despine(ax=ax)


def collection_outcomes():
    df = pd.read_csv(ROOT / "collection_outcomes.csv")
    df = df.sort_values(["success", "failed", "skipped"]).reset_index(drop=True)
    fig, ax = plt.subplots(figsize=(10.5, 6.0))
    left = pd.Series(0, index=df.index, dtype=float)
    styles = [
        ("success", "성공", BLUE["base"], BLUE["dark"]),
        ("failed", "실패", ORANGE["base"], ORANGE["dark"]),
        ("skipped", "정책 중단", NEUTRAL["light"], NEUTRAL["dark"]),
    ]
    for col, label, fill, edge in styles:
        bars = ax.barh(df["dataset"], df[col], left=left, label=label,
                       color=fill, edgecolor=edge, linewidth=1.0)
        for bar, value in zip(bars, df[col]):
            if value:
                ax.text(bar.get_x() + bar.get_width() / 2,
                        bar.get_y() + bar.get_height() / 2,
                        f"{int(value)}", ha="center", va="center", fontsize=8,
                        color=TOKENS["ink"])
        left += df[col]
    ax.set_xlabel("수집 실행 횟수")
    ax.set_ylabel("")
    ax.xaxis.grid(True)
    ax.yaxis.grid(False)
    ax.legend(loc="lower left", bbox_to_anchor=(0, 1.01), frameon=False,
              ncol=3, borderaxespad=0)
    header(fig, ax, "반복 수집은 작동하지만 실패·정책 중단이 함께 누적됨",
           "로컬 DB의 전체 수집 로그, 2026년 6월 20일 07시 20분 기준; 실행 횟수")
    fig.savefig(ROOT / "collection_outcomes.png", dpi=180, bbox_inches="tight")
    plt.close(fig)


def address_scope():
    df = pd.read_csv(ROOT / "address_scope.csv")
    wide = df.pivot(index="dataset", columns="scope", values="rows").fillna(0)
    order = ["상가업소", "주차장(기존 원천)"]
    wide = wide.loc[order]
    pct = wide.div(wide.sum(axis=1), axis=0) * 100
    fig, ax = plt.subplots(figsize=(10.5, 4.5))
    left = pd.Series(0.0, index=pct.index)
    styles = [
        ("금천구 주소", BLUE["base"], BLUE["dark"]),
        ("기타 지역 주소", ORANGE["base"], ORANGE["dark"]),
    ]
    for col, fill, edge in styles:
        bars = ax.barh(pct.index, pct[col], left=left, label=col,
                       color=fill, edgecolor=edge, linewidth=1.0)
        for bar, value, rows in zip(bars, pct[col], wide[col]):
            ax.text(bar.get_x() + bar.get_width() / 2,
                    bar.get_y() + bar.get_height() / 2,
                    f"{value:.1f}%\n({int(rows):,}행)", ha="center", va="center",
                    fontsize=9, color=TOKENS["ink"])
        left += pct[col]
    ax.set_xlim(0, 100)
    ax.set_xlabel("주소 기준 구성비")
    ax.set_ylabel("")
    ax.xaxis.grid(True)
    ax.yaxis.grid(False)
    ax.legend(loc="lower left", bbox_to_anchor=(0, 1.01), frameon=False,
              ncol=2, borderaxespad=0)
    header(fig, ax, "저장 성공과 금천구 범위 적합성은 별개의 문제",
           "현 저장 행의 주소 문자열 기준; 주차장은 시설 수가 아닌 기존 원천의 공간 행 단위")
    fig.savefig(ROOT / "address_scope.png", dpi=180, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    theme()
    collection_outcomes()
    address_scope()
