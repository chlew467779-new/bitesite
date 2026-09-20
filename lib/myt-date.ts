const MYT_OFFSET = '+08:00';

function dateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(date);
}

export function getMytDateRange(range: string) {
  const todayKey = dateKey(new Date());
  const end = new Date(`${todayKey}T00:00:00${MYT_OFFSET}`);
  const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : range === '365d' ? 365 : 7;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  return {
    start: startKey,
    end: endKey,
    startDateTime: `${startKey}T00:00:00${MYT_OFFSET}`,
    endDateTime: `${endKey}T23:59:59.999${MYT_OFFSET}`,
  };
}

export function getMytToday() {
  return dateKey(new Date());
}
