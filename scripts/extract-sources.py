from pathlib import Path
import pdfplumber

SOURCES = [
    Path(r"C:\Users\aleks\Downloads\Anatomi ru-su.pdf"),
    Path(r"C:\Users\aleks\Downloads\Sjukdomar och besvär ru-su.pdf"),
    Path(r"C:\Users\aleks\Downloads\Första hjälpen ru-su.pdf"),
    Path(r"C:\Users\aleks\Downloads\Mediciner, medicinering ru-su.pdf"),
    Path(r"C:\Users\aleks\Downloads\Avdelningar ru-su.pdf"),
    Path(r"C:\Users\aleks\Downloads\Människoroppen - en översikt.pdf"),
]

out_dir = Path("tmp/pdfs")
out_dir.mkdir(parents=True, exist_ok=True)

for source in SOURCES:
    if not source.exists():
        raise FileNotFoundError(source)
    pages: list[str] = []
    with pdfplumber.open(source) as pdf:
        for index, page in enumerate(pdf.pages, 1):
            text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            pages.append(f"\n===== PAGE {index} =====\n{text}\n")
        print(f"{source.name}: {len(pdf.pages)} pages")
    target = out_dir / f"{source.stem}.txt"
    target.write_text("".join(pages), encoding="utf-8")
