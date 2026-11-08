"""Compare built article cells and prose with the archived WordPress source."""
from pathlib import Path
import archive_html as m
import json
import argparse

arguments = argparse.ArgumentParser()
arguments.add_argument("--output", type=Path)
args = arguments.parse_args()

ROOT = Path(__file__).resolve().parents[1]

def parse(path):
    p = m.Parser()
    p.feed(path.read_text())
    return p.root

def rows(table):
    return [[m.compact(cell.text()) for cell in row.children if isinstance(cell, m.Node) and cell.tag in {'th', 'td'}] for row in table.walk() if row.tag == 'tr']

report = {}
for key, slug in [('100tb', '100tb-cn2'), ('panstarcloud', 'panstarcloud-singapore')]:
    if not (ROOT / f'src/content/posts/{slug}.mdx').exists():
        assert not (ROOT / f'dist/reviews/{slug}/index.html').exists(), f'{slug}: removed article still built'
        report[key] = {'status': 'not-applicable', 'reason': 'Historical post removed', 'removedPageAbsent': True}
        continue
    source = parse(ROOT / f'tests/fixtures/wordpress/{key}.html')
    article = next(n for n in source.walk() if 'main-article' in n.attrs.get('class', '').split())
    content = next(n for n in article.walk() if n.attrs.get('class') == 'text')
    source_tables = [n for n in content.walk() if n.tag == 'table']
    built = parse(ROOT / f'dist/reviews/{slug}/index.html')
    rendered = next(n for n in built.walk() if n.attrs.get('class') == 'full-review')
    table_map = {n.attrs['data-source-table']: next(t for t in n.walk() if t.tag == 'table') for n in rendered.walk() if 'data-source-table' in n.attrs}
    excluded_id = f'{key}-table-' + ('4' if key == '100tb' else '3')
    assert excluded_id not in table_map, 'IP quality must not render'
    assert len(source_tables) - 1 == len(table_map), key
    cells = 0
    for i, table in enumerate(source_tables, 1):
        if f'{key}-table-{i}' == excluded_id:
            continue
        expected = rows(table)
        actual = rows(table_map[f'{key}-table-{i}'])
        assert actual == expected, f'{key} table {i} differs'
        cells += sum(len(row) for row in actual)
    prose = [m.compact(n.text()) for n in content.children if isinstance(n, m.Node) and n.tag in {'p', 'blockquote'} and m.compact(n.text())]
    normalized = ''.join(rendered.text().split())
    excluded_prose = [text for text in prose if text.startswith('Generated at ')]
    assert all(''.join(text.split()) not in normalized for text in excluded_prose), 'Generated timestamp still rendered'
    prose = [text for text in prose if not text.startswith('Generated at ')]
    missing = [text for text in prose if ''.join(text.split()) not in normalized]
    assert not missing, f'{key} missing prose: {missing}'
    report[key] = {'tables': len(table_map), 'sourceTables': len(source_tables), 'excludedTable': excluded_id, 'excludedProse': excluded_prose, 'bodyRows': sum(len(rows(t))-1 for i,t in enumerate(source_tables,1) if f'{key}-table-{i}' != excluded_id), 'cellsIncludingHeaders': cells, 'paragraphsAndQuotes': len(prose), 'exactCellMatch': True, 'allExpectedProsePresent': True}

if args.output:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
