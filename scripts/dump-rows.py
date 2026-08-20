from pathlib import Path
import json, re
import pdfplumber

names = ["Anatomi ru-su.pdf", "Sjukdomar och besvär ru-su.pdf", "Första hjälpen ru-su.pdf", "Mediciner, medicinering ru-su.pdf", "Avdelningar ru-su.pdf"]
for name in names:
    source = Path(r"C:\Users\aleks\Downloads") / name
    print(f"\n## {name}")
    with pdfplumber.open(source) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            table = max(tables, key=lambda t: sum(bool(c and re.fullmatch(r"\d+\.", c.strip())) for row in t for c in row))
            print(f"PAGE {page_no}")
            for row in table:
                if any(c and re.fullmatch(r"\d+\.", c.strip()) for c in row):
                    print(json.dumps(row, ensure_ascii=False))
