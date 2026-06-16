# Japansk Promenad 🚶‍♀️🌸

En snygg, mobilvänlig hemsida för att spåra japanska promenader i en kalendervy.
Robin & Elisabeth bockar av sina promenader per dag — datan läses från och skrivs
till samma Google Sheet.

> **Uppgiften:** Japansk promenad 4 gr/v. Gå raskt i 3 minuter – så att du blir
> andfådd men fortfarande kan prata i korta meningar. Gå sedan lugnt i 3 minuter
> och hämta andan. Upprepa fem gånger. Då har du fyllt 30 minuter.

## Hur det hänger ihop

GitHub Pages kan bara visa statiska filer — den kan inte själv skriva till Google
Sheets. Lösningen är ett litet **Google Apps Script** som körs i ditt ark och fungerar
som ett pyttelitet API:

```
[ GitHub Pages-sida ] ⇄ fetch ⇄ [ Google Apps Script web-app ] ⇄ [ Google Sheet ]
```

Sidan funkar även utan API i **demo-läge** (data sparas bara lokalt i din webbläsare).

---

## Steg 1 – Sätt upp Apps Script (läsa + skriva till arket)

1. Öppna ditt Google Sheet:
   <https://docs.google.com/spreadsheets/d/1GSglbQa22lnSv22YzCSitSnK-XD6NR19E0ptbwvclzk/edit>
2. Kontrollera strukturen:
   - Rad 1: `Datum` | `Robin` | `Elisabeth`
   - Rad 2, kolumn A: uppgiftsbeskrivningen
   - Promenadposter hamnar från rad 3 och nedåt (skriptet sköter detta automatiskt).
   - Notera fliknamnet (t.ex. `Blad1`). Om det inte heter `Blad1`, ändra
     `SHEET_NAME` högst upp i [`apps-script/Code.gs`](apps-script/Code.gs).
3. I arket: **Tillägg → Apps Script**.
4. Radera eventuell exempelkod, klistra in hela innehållet från
   [`apps-script/Code.gs`](apps-script/Code.gs), och spara (💾).
5. **Distribuera → Ny distribution**.
   - Typ: **Webbapp**
   - Kör som: **Jag** (dig själv)
   - Vem har åtkomst: **Alla** *(krävs för att sidan ska kunna anropa den)*
   - Klicka **Distribuera**, godkänn behörigheterna.
6. Kopiera **webbapp-URL:en** (slutar på `/exec`).

## Steg 2 – Koppla sidan till API:t

Öppna [`config.js`](config.js) och klistra in din URL:

```js
const API_URL = "https://script.google.com/macros/s/AKfycb..../exec";
```

Lämnar du den tom körs sidan i demo-läge.

## Steg 3 – Publicera på GitHub Pages

```bash
git add .
git commit -m "Japansk promenad-app"
git push
```

Sedan på GitHub: **Settings → Pages → Source: `main` / root → Save.**
Efter en stund ligger sidan på `https://<ditt-användarnamn>.github.io/japansk-promenad-rietz/`.

---

## Testa lokalt

```bash
# valfri statisk server, t.ex.:
python -m http.server 8000
# öppna sedan http://localhost:8000
```

## Filer

| Fil | Roll |
|-----|------|
| `index.html` | Sidans struktur |
| `style.css` | Design (sakura-tema, kalender, modal) |
| `app.js` | Logik: kalender, statistik, läs/skriv mot API |
| `config.js` | Din Apps Script-URL |
| `apps-script/Code.gs` | Backend-API:t som lever i Google Sheet:t |

## Anpassa

- **Lägga till en person:** lägg till en kolumn i arket, lägg till personen i
  `PEOPLE` i `Code.gs` och i `PERSON_COLORS` i `app.js`. Distribuera om skriptet.
- **Ändra veckomål:** ändra `WEEKLY_GOAL` i `app.js` (standard 4 gr/v).
