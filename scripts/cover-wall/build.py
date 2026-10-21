"""Rebuilds public/cover-wall.jpg, the faded wall behind the landing page.

Fetches each cover from Open Library, lays them out like the old CSS grid
(16x9 tiles, every other one nudged down) and draws one grayscale JPEG at
half size with render.swift. Run from the repo root on a Mac:

    python3 scripts/cover-wall/build.py
"""
import json
import pathlib
import subprocess
import tempfile
import urllib.request

COLUMNS, ROWS = 16, 9
COVERS = [
    "b/id/10618463-M.jpg",  # The Left Hand of Darkness,
    "b/id/6979680-M.jpg",  # The Dispossessed,
    "b/id/13617691-M.jpg",  # A Wizard of Earthsea,
    "b/id/26458-M.jpg",  # The Lathe of Heaven,
    "b/id/2237620-M.jpg",  # Norwegian Wood,
    "b/id/11153243-M.jpg",  # 1Q84,
    "b/id/14558822-M.jpg",  # Hard-Boiled Wonderland and the End of the World,
    "b/id/8750439-M.jpg",  # How to Do Nothing,
    "b/id/13246983-M.jpg",  # Saving Time,
    "b/id/524560-M.jpg",  # Blindsight,
    "b/id/8457790-M.jpg",  # Echopraxia,
    "b/id/1443125-M.jpg",  # Starfish,
    "b/id/11465138-M.jpg",  # Sea of Tranquility,
    "b/id/9314949-M.jpg",  # The Glass Hotel,
    "b/id/525391-M.jpg",  # Jonathan Strange & Mr Norrell,
    "b/id/10466266-M.jpg",  # Parable of the Sower,
    "b/id/12384358-M.jpg",  # Parable of the Talents,
    "b/id/8745330-M.jpg",  # Kindred,
    "b/id/285158-M.jpg",  # Dawn,
    "b/id/11481354-M.jpg",  # Dune,
    "b/id/283860-M.jpg",  # Neuromancer,
    "b/id/380332-M.jpg",  # Hyperion,
    "b/id/12313764-M.jpg",  # Solaris,
    "b/id/8408974-M.jpg",  # Annihilation,
    "b/id/8264706-M.jpg",  # Children of Time,
    "b/id/7355949-M.jpg",  # Ancillary Justice,
    "b/id/14612610-M.jpg",  # Foundation,
    "b/id/392508-M.jpg",  # Snow Crash,
    "b/id/11263774-M.jpg",  # The Brothers Karamazov,
    "b/id/13116014-M.jpg",  # Crime and Punishment,
    "b/id/6908257-M.jpg",  # Notes from Underground,
    "b/id/10249475-M.jpg",  # The Idiot,
    "b/id/12327215-M.jpg",  # Anna Karenina,
    "b/id/12621906-M.jpg",  # War and Peace,
    "b/id/15013644-M.jpg",  # The Master and Margarita,
    "b/id/10544254-M.jpg",  # Moby Dick,
    "b/id/252882-M.jpg",  # Middlemarch,
    "b/id/15185412-M.jpg",  # One Hundred Years of Solitude,
    "b/isbn/9780593135204-M.jpg",
    "b/isbn/9781635575637-M.jpg",
    "b/isbn/9780441172719-M.jpg",
    "b/isbn/9780316556347-M.jpg",
    "b/isbn/9780679731726-M.jpg",
    "b/isbn/9780804172448-M.jpg",
    "b/isbn/9781571313560-M.jpg",
    "b/isbn/9780143110439-M.jpg",
    "b/isbn/9780441478125-M.jpg",
    "b/isbn/9781455563920-M.jpg",
    "b/isbn/9780374533557-M.jpg",
    "b/isbn/9780547928227-M.jpg",
    "b/isbn/9780593318171-M.jpg",
    "b/isbn/9780399590504-M.jpg",
    "b/isbn/9780593321201-M.jpg",
    "b/isbn/9780393635522-M.jpg",
    "b/isbn/9781984822178-M.jpg",
    "b/isbn/9780312424404-M.jpg",
    "b/isbn/9780756404741-M.jpg",
    "b/isbn/9781400033416-M.jpg",
    "b/isbn/9780062316097-M.jpg",
    "b/isbn/9780553418026-M.jpg",
    "b/isbn/9780399588198-M.jpg",
    "b/isbn/9780735211292-M.jpg",
    "b/isbn/9780307387899-M.jpg",
    "b/isbn/9780385547345-M.jpg",
    "b/isbn/9780525559474-M.jpg",
]

here = pathlib.Path(__file__).parent
with tempfile.TemporaryDirectory() as tmp:
    work = pathlib.Path(tmp)
    (work / "covers").mkdir()
    for cover in COVERS:
        url = f"https://covers.openlibrary.org/{cover}"
        data = urllib.request.urlopen(url, timeout=60).read()
        (work / "covers" / cover.replace("/", "_")).write_bytes(data)
    # Step through the list so neighbours rarely repeat
    tiles = [COVERS[(i * 7) % len(COVERS)].replace("/", "_") for i in range(COLUMNS * ROWS)]
    (work / "layout.json").write_text(json.dumps({"cols": COLUMNS, "rows": ROWS, "tiles": tiles}))
    output = here.parent.parent / "public" / "cover-wall.jpg"
    subprocess.run(["swift", str(here / "render.swift"), str(work), str(output), "0.5"], check=True)
