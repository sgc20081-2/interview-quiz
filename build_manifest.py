import os
import json

DATA_DIR = "data"
MANIFEST_PATH = os.path.join(DATA_DIR, "manifest.json")

categories_map = {}

for root, _, files in os.walk(DATA_DIR):
    for file in sorted(files):
        if file.endswith(".json") and file != "manifest.json":
            full_path = os.path.join(root, file)
            # Относительный путь для fetch() с прямыми слэшами (важно для Windows)
            rel_path = os.path.relpath(full_path, ".").replace("\\", "/")

            with open(full_path, "r", encoding="utf-8") as f:
                content = json.load(f)

            cat_name = content.get("category", "Без категории")
            sub_name = content.get("subcategory", file)

            if cat_name not in categories_map:
                categories_map[cat_name] = []

            categories_map[cat_name].append({
                "title": sub_name,
                "file": rel_path,
                "count": len(content.get("questions", []))
            })

manifest = {
    "categories": [
        {"title": cat, "subcategories": subs}
        for cat, subs in sorted(categories_map.items())
    ]
}

with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f"Манифест обновлен: {len(manifest['categories'])} кат.")