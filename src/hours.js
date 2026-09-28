// Orari ufficiali (0 = domenica). Valori in minuti dalla mezzanotte.
export const SCHEDULE = {
  0: null,
  1: [9 * 60, 22 * 60],
  2: [9 * 60, 22 * 60],
  3: [9 * 60, 22 * 60],
  4: [9 * 60, 22 * 60],
  5: [9 * 60, 22 * 60],
  6: [9 * 60, 16 * 60],
};

const DAY_NAMES = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Giorno e minuti correnti nel fuso della palestra, indipendentemente da dove si trova il visitatore. */
export function romeNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { day: WEEKDAY_INDEX[get('weekday')], minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function openStatus(now = romeNow()) {
  const { day, minutes } = now;
  const today = SCHEDULE[day];

  if (today && minutes >= today[0] && minutes < today[1]) {
    const left = today[1] - minutes;
    return {
      open: true,
      short: 'Aperto ora',
      title: 'Aperto ora',
      sub: left <= 60 ? `Chiude tra ${left} min, alle ${fmt(today[1])}` : `Chiude alle ${fmt(today[1])}`,
    };
  }
  if (today && minutes < today[0]) {
    return { open: false, short: `Apre alle ${fmt(today[0])}`, title: 'Chiuso ora', sub: `Apre oggi alle ${fmt(today[0])}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (SCHEDULE[d]) {
      const when = i === 1 ? 'domani' : DAY_NAMES[d];
      return { open: false, short: 'Chiuso ora', title: 'Chiuso ora', sub: `Riapre ${when} alle ${fmt(SCHEDULE[d][0])}` };
    }
  }
  return { open: false, short: 'Chiuso', title: 'Chiuso', sub: '' };
}
