#!/usr/bin/env python3
"""Собирает чистый датасет из сырых ответов API 2ГИС (data/raw) и
генерирует данные отзывов для сайта (site/js/reviews.js).

Запуск:  python3 tools/build_data.py
"""
import csv
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data"
SITE_JS = ROOT / "site" / "js"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# ID отзывов 2ГИС, которые показываем на сайте (все тексты — в data/reviews.csv)
SITE_REVIEW_IDS = [
    "232322451",  # Алеся Сейсенгалиева — «донерная на высшем уровне…»
    "253796896",  # Бибигайша Абдуллина — доставка за 35 минут
    "176424756",  # Eskalievaa 04 — вежливые кассиры
    "125967070",  # Бекзат Елубай — частый гость
    "253327298",  # Максат Абдуллаев — обслуживание, быстрая готовка
    "253464471",  # Sayagul Nurlybekova — 7 посещений
    "253573201",  # Sergey SH — мотопутешественники, чисто
    "88570510",   # кирилл костин — куриный донер в батоне
    "253322633",  # Асель Малдыбаева — «Номер 1»
    "253869775",  # Зоя Кайратовна — развёрнутый отзыв
    "121596599",  # Райля Абдуллаева — вкусно и хорошие цены
    "135206599",  # Belara — «жеп көруге кеңес беремін»
    "253318607",  # Айымгуль Самбетова — донеры, бургеры
    "203933816",  # ZENO — «сочный мощный»
    "126138871",  # Кенже Бейсхан — быстро и аппетитно
    "129143612",  # Mansur — лучшие донеры в Хромтау
]

FIRM_ID = "70000001083426430"
SOURCE_URL = "https://2gis.kz/aktobe/firm/" + FIRM_ID
SHORT_URL = "https://go.2gis.com/PraD3"


def load(name):
    return json.loads((RAW / name).read_text(encoding="utf-8"))


def clean_review(r, confirmed):
    tf = (r.get("trust_factors") or {})
    visits = None
    for f in tf.get("factors") or []:
        if f.get("type") == "location_visit":
            visits = f.get("visits_count")
    photos = []
    for m in r.get("media") or []:
        p = (m.get("photo") or {}).get("preview_urls") or {}
        if p.get("url"):
            photos.append(p["url"])
    user = r.get("user") or {}
    return {
        "id": r["id"],
        "date": r["date_created"][:10],
        "date_edited": (r.get("date_edited") or "")[:10] or None,
        "rating": r["rating"],
        "text": (r.get("text") or "").strip(),
        "author": (user.get("name") or "").strip(),
        "author_reviews_count": user.get("reviews_count"),
        "likes": r.get("likes_count") or 0,
        "comments": r.get("comments_count") or 0,
        "confirmed": confirmed,          # попал в основную ленту 2ГИС
        "visits": visits,                # подтверждённые посещения автора
        "trust_caption": ((tf.get("trust_info") or {}).get("caption")),
        "official_answer": ((r.get("official_answer") or {}).get("text")),
        "photos": photos,
    }


def main():
    profile = load("profile.json")
    rated = load("reviews_rated_0.json")["reviews"] + load("reviews_rated_50.json")["reviews"]
    unrated = load("reviews_unrated_0.json")["reviews"]
    reviews = [clean_review(r, True) for r in rated] + [clean_review(r, False) for r in unrated]
    reviews.sort(key=lambda r: r["date"], reverse=True)

    # --- фото: альбомы + авторы
    albums = {}
    for alb in ["food_and_drinks", "price_list_image", "interior", "outside"]:
        for it in load(f"photos_{alb}.json").get("items", []):
            albums.setdefault(it["id"], []).append(alb)
    photos = []
    for i, it in enumerate(load("photos_all.json")["items"], 1):
        alb = (albums.get(it["id"]) or ["other"])[0]
        photos.append({
            "n": i,
            "id": it["id"],
            "album": alb,
            "file": f"photos/original/{i:02d}_{alb}_{it['id']}.jpg",
            "url": it["photo"]["url"],
            "width": it["photo"]["width"],
            "height": it["photo"]["height"],
            "author": (it.get("owner") or {}).get("name"),
            "source": (it.get("copyright") or {}).get("value"),
            "date": it.get("creation_time", "")[:10],
        })

    # --- фото, прикреплённые к отзывам
    rdir = OUT / "photos" / "reviews"
    rdir.mkdir(parents=True, exist_ok=True)
    for r in reviews:
        local = []
        for j, url in enumerate(r["photos"], 1):
            fn = rdir / f"review_{r['id']}_{j}.jpg"
            if not fn.exists():
                subprocess.run(["curl", "-s", "-A", UA, "-H", "Referer: https://2gis.kz/",
                                "-o", str(fn), url], check=False)
            if fn.exists() and fn.stat().st_size > 0:
                local.append(str(fn.relative_to(OUT)))
        r["photo_files"] = local

    d = profile
    contacts = [c for g in d["contact_groups"] for c in g["contacts"]]
    phone = next(c for c in contacts if c["type"] == "phone")
    summary = {
        "rating": d["reviews"]["general_rating"],
        "ratings_count": d["reviews"]["general_review_count_with_stars"],
        "reviews_count": d["reviews"]["general_review_count"],
        "confirmed_reviews": len(rated),
        "unconfirmed_reviews": len(unrated),
        "distribution_confirmed": {str(s): sum(1 for r in reviews if r["confirmed"] and r["rating"] == s)
                                   for s in range(5, 0, -1)},
        "topics": [f["value"] for f in load("facts.json").get("facts", [])],
    }

    dataset = {
        "source": {"url": SOURCE_URL, "short_url": SHORT_URL, "firm_id": FIRM_ID,
                   "fetched_at": "2026-09-19", "profile_updated_at": d["dates"]["updated_at"]},
        "name": d["name_ex"]["primary"],
        "type": d["name_ex"]["extension"],
        "rubrics": [r["name"] for r in d["rubrics"]],
        "address": {
            "street": d["address_name"],
            "city": next(a["name"] for a in d["adm_div"] if a["type"] == "city"),
            "region": next(a["name"] for a in d["adm_div"] if a["type"] == "region"),
            "country": next(a["name"] for a in d["adm_div"] if a["type"] == "country"),
            "lat": d["point"]["lat"], "lon": d["point"]["lon"],
            "nearest_stop": (d["links"].get("nearest_stations") or [{}])[0].get("name"),
        },
        "contacts": {
            "phone": phone["value"], "phone_display": phone["text"], "phone_comment": phone.get("comment"),
            "whatsapp": "https://wa.me/" + phone["value"].lstrip("+"),
            "instagram": "istanbul_cafe_hromtau",   # с фото меню-борда
        },
        "schedule": {day: f"{v['working_hours'][0]['from']}–{v['working_hours'][0]['to']}"
                     for day, v in d["schedule"].items()},
        "timezone_offset_min": d["timezone_offset"],
        "attributes": {g["name"]: [a["name"] for a in g["attributes"]] for g in d["attribute_groups"]},
        "rating_summary": summary,
        "menu_from_board_photo": json.loads((OUT / "menu.json").read_text(encoding="utf-8")),
        "photos": photos,
        "reviews": reviews,
    }
    (OUT / "istanbul_2gis.json").write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")

    with open(OUT / "reviews.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["id", "дата", "оценка", "автор", "текст", "лайки", "подтверждён", "посещений", "фото"])
        for r in reviews:
            w.writerow([r["id"], r["date"], r["rating"], r["author"], r["text"].replace("\n", " "),
                        r["likes"], "да" if r["confirmed"] else "нет", r["visits"] or "", len(r["photos"])])

    # --- отзывы для сайта: вручную отобранные из основной ленты 2ГИС (порядок = порядок показа)
    by_id = {r["id"]: r for r in reviews}
    picked = [by_id[i] for i in SITE_REVIEW_IDS if i in by_id]
    site_reviews = [{"author": r["author"], "date": r["date"], "rating": r["rating"],
                     "text": re.sub(r"\n{2,}", "\n", r["text"]), "likes": r["likes"],
                     "visits": r["visits"]} for r in picked]
    SITE_JS.mkdir(parents=True, exist_ok=True)
    (SITE_JS / "reviews.js").write_text(
        "// Сгенерировано tools/build_data.py из отзывов 2ГИС — не править руками.\n"
        "window.ISTANBUL_REVIEWS = " + json.dumps({"summary": summary, "items": site_reviews},
                                                   ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8")

    print("reviews:", len(reviews), "| for site:", len(site_reviews), "| photos:", len(photos),
          "| review photos:", sum(len(r["photo_files"]) for r in reviews))
    print("distribution (confirmed):", summary["distribution_confirmed"])


if __name__ == "__main__":
    main()
