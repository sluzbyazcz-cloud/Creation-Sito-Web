# Gym Tonic — sito web

Sito vetrina per **Gym Tonic**, palestra in C.so Re Arduino 87, Rivarolo Canavese (TO).
È un sito statico (HTML, CSS e JS), senza backend, e si può pubblicare su qualsiasi hosting statico (Netlify, Vercel, GitHub Pages, Aruba…).

## Concept

**"Officina della forma"**: la palestra è un loft industriale con condotte a vista, capriate, parquet, pareti arancioni e acciaio nero. Il sito riprende questi elementi:
fondo nero acciaio, arancione delle pareti come unico colore d'accento, titoli condensati da insegna d'officina (Big Shoulders) e testo leggibile (Manrope).

- **Protagonista della prima schermata:** un disco da bilanciere in 3D con il marchio Gym Tonic, l'oggetto più riconoscibile di una sala pesi. Interazioni:
  - trascinalo per farlo girare e inclinarlo (con inerzia);
  - un clic o un tocco gli dà una spinta, con un "colpo" elastico e il bordo arancione che si illumina;
  - una luce calda segue il cursore, e il cursore diventa una mano solo sopra il disco;
  - su telefono si inclina muovendo il dispositivo (giroscopio);
  - da tastiera: Tab per selezionarlo, Invio per la spinta, frecce per girarlo;
  - ruota con lo scroll.
  Le foto fornite sono verticali e a bassa risoluzione (765×1020), quindi non reggono un hero a tutto schermo e danno il meglio nella galleria.
- **Percorso verso l'azione principale (prenotare una visita o chiamare):**
  Hero → Spazi (galleria orizzontale) → Per chi (sto iniziando / mi alleno già / restare in forma) → Servizi (sauna, docce) → Orari con stato "aperto ora" → Abbonamenti → Recensioni → Contatti e modulo.
  Su mobile compare una barra fissa con Chiama · Indicazioni · Prenota visita.

## Sviluppo

```bash
npm install
npm run build   # compila src/ → assets/js/ (Three.js viene caricato solo quando serve)
npm run serve   # anteprima su http://localhost:5173
```

I file in `assets/js/` sono già compilati e inclusi nel repository. Il sito funziona anche senza build e anche aprendo `index.html` con un doppio clic.

| Percorso | Contenuto |
|---|---|
| `index.html` | struttura, testi, SEO, dati strutturati `ExerciseGym` |
| `assets/css/styles.css` | design system e layout |
| `src/main.js` | navigazione, animazioni (Motion), galleria, tab, orari, modulo, mappa, lightbox |
| `src/hero3d.js` | scena 3D (Three.js) |
| `src/hours.js` | orari e stato di apertura (fuso Europe/Rome) |

### 3D e prestazioni
- Three.js è in un file separato (`assets/js/hero3d.js`), caricato dopo il primo rendering della pagina.
- Su mobile e dispositivi poco potenti: meno poligoni, meno particelle, texture a 1024 px, risoluzione limitata. Se i primi frame sono lenti, la qualità si abbassa da sola.
- Con "riduci movimento" attivo il disco resta fermo. Finché il 3D non è pronto, o se il dispositivo non supporta WebGL, al suo posto si vede un disco disegnato in CSS: la prima schermata non resta mai vuota.
- Il rendering si ferma quando la prima schermata non è visibile o la scheda è in background.

### Privacy
- I font sono ospitati sul sito stesso, senza richieste a Google Fonts.
- La mappa di Google si carica solo quando il visitatore clicca "Mostra la mappa".

## Da sostituire prima della consegna

I punti mancanti sono segnati sul sito con un'etichetta arancione tratteggiata (**Segnaposto**, **Da confermare**, **Da inserire**).

| Dove | Cosa serve |
|---|---|
| Abbonamenti | nomi delle formule, prezzi e cosa includono (oppure togliere la sezione) |
| Recensioni | 2–3 recensioni reali con il consenso degli autori, oppure il widget ufficiale Google |
| Per chi | confermare se ci sono istruttori in sala o schede personalizzate, ed eventuali corsi o fasce orarie dedicate (ragazzi, over 60) |
| Servizi | confermare spogliatoi, armadietti e parcheggio |
| Contatti | indirizzo email |
| Footer | ragione sociale, P. IVA, link Instagram e Facebook |
| Note legali | pagine di privacy policy e cookie policy (obbligatorie: il modulo raccoglie dati personali) |
| `<head>` | dominio definitivo in `canonical` e `og:image` (URL assoluto) |
| Foto | le attuali sono sufficienti ma piccole: foto orizzontali ad alta risoluzione (almeno 2000 px) migliorerebbero molto la galleria. Mancano foto di sauna, spogliatoi e ingresso |
| Orari | controllare gli orari dei festivi e di agosto |

## Funzioni che richiedono un collegamento esterno

1. **Modulo "Prenota una visita"**: oggi è una demo, valida i campi e mostra un riepilogo ma non invia nulla.
   Per attivarlo basta inserire l'URL di un servizio nell'attributo `data-endpoint` del `<form>` in `index.html`: il codice invia già i dati in JSON con `POST`.
   Servizi possibili: Formspree, Basin, Getform, un webhook Make/Zapier o un backend proprio. Serve anche l'email di destinazione.
2. **Mappa**: funziona già con l'embed pubblico di Google Maps. Per una mappa personalizzata serve una API key di Google Maps.
3. **Recensioni Google automatiche**: servono la Google Places API (con API key) o un widget di terze parti.
4. **Prenotazione online con calendario o pagamento dell'abbonamento**: non incluse. Servono un gestionale per palestre o Calendly/Stripe e la scelta del cliente.
5. **Cookie banner**: serve solo se si aggiungono analytics, pixel o altri servizi che usano cookie (per esempio Iubenda o Cookiebot).
6. **WhatsApp**: il numero fornito è un fisso. Se la palestra ha un numero WhatsApp si può aggiungere un pulsante.

## Qualità

- Accessibilità: skip link, focus visibile, tab con tastiera (frecce, Home e Fine), lightbox chiudibile con Esc, errori del modulo annunciati, alt text descrittivi, contrasto AA.
- Responsive testato a 390 px e a 1440 px.
- `qodana.yaml` è pronto per l'analisi statica con JetBrains Qodana (`qodana scan`).
