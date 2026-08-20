from pathlib import Path
import pdfplumber

for source in Path(r"C:\Users\aleks\Downloads").glob("*.pdf"):
    if source.name not in {
        "Anatomi ru-su.pdf", "Sjukdomar och besvär ru-su.pdf",
        "Första hjälpen ru-su.pdf", "Mediciner, medicinering ru-su.pdf",
        "Avdelningar ru-su.pdf", "Människoroppen - en översikt.pdf"
    }:
        continue
    print(f"\n## {source.name}")
    with pdfplumber.open(source) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            print(f"page {i}: {len(tables)} tables")
            for table in tables:
                for row in table[:5]:
                    print(row)
