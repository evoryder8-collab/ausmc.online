// A small offline gazetteer: lets "Check your local time" name the visitor's
// nearest major city from their coordinates without sending them anywhere.
const RAW = `London|51.51|-0.13|Europe/London
Manchester|53.48|-2.24|Europe/London
Dublin|53.35|-6.26|Europe/Dublin
Lisbon|38.72|-9.14|Europe/Lisbon
Madrid|40.42|-3.70|Europe/Madrid
Barcelona|41.39|2.17|Europe/Madrid
Paris|48.86|2.35|Europe/Paris
Lyon|45.76|4.84|Europe/Paris
Brussels|50.85|4.35|Europe/Brussels
Amsterdam|52.37|4.90|Europe/Amsterdam
Berlin|52.52|13.40|Europe/Berlin
Hamburg|53.55|9.99|Europe/Berlin
Munich|48.14|11.58|Europe/Berlin
Frankfurt|50.11|8.68|Europe/Berlin
Zurich|47.37|8.54|Europe/Zurich
Vienna|48.21|16.37|Europe/Vienna
Milan|45.46|9.19|Europe/Rome
Rome|41.90|12.50|Europe/Rome
Copenhagen|55.68|12.57|Europe/Copenhagen
Aarhus|56.16|10.20|Europe/Copenhagen
Stockholm|59.33|18.07|Europe/Stockholm
Oslo|59.91|10.75|Europe/Oslo
Helsinki|60.17|24.94|Europe/Helsinki
Warsaw|52.23|21.01|Europe/Warsaw
Prague|50.08|14.44|Europe/Prague
Budapest|47.50|19.04|Europe/Budapest
Bucharest|44.43|26.10|Europe/Bucharest
Cluj-Napoca|46.77|23.59|Europe/Bucharest
Iași|47.16|27.59|Europe/Bucharest
Timișoara|45.75|21.23|Europe/Bucharest
Constanța|44.18|28.65|Europe/Bucharest
Chișinău|47.01|28.86|Europe/Chisinau
Sofia|42.70|23.32|Europe/Sofia
Athens|37.98|23.73|Europe/Athens
Istanbul|41.01|28.98|Europe/Istanbul
Kyiv|50.45|30.52|Europe/Kyiv
New York|40.71|-74.01|America/New_York
Boston|42.36|-71.06|America/New_York
Washington|38.91|-77.04|America/New_York
Atlanta|33.75|-84.39|America/New_York
Miami|25.76|-80.19|America/New_York
Chicago|41.88|-87.63|America/Chicago
Dallas|32.78|-96.80|America/Chicago
Houston|29.76|-95.37|America/Chicago
Denver|39.74|-104.99|America/Denver
Phoenix|33.45|-112.07|America/Phoenix
Las Vegas|36.17|-115.14|America/Los_Angeles
Los Angeles|34.05|-118.24|America/Los_Angeles
San Francisco|37.77|-122.42|America/Los_Angeles
Seattle|47.61|-122.33|America/Los_Angeles
Honolulu|21.31|-157.86|Pacific/Honolulu
Toronto|43.65|-79.38|America/Toronto
Montreal|45.50|-73.57|America/Toronto
Vancouver|49.28|-123.12|America/Vancouver
Mexico City|19.43|-99.13|America/Mexico_City
São Paulo|-23.55|-46.63|America/Sao_Paulo
Buenos Aires|-34.60|-58.38|America/Argentina/Buenos_Aires
Dubai|25.20|55.27|Asia/Dubai
Tel Aviv|32.09|34.78|Asia/Jerusalem
Cairo|30.04|31.24|Africa/Cairo
Johannesburg|-26.20|28.05|Africa/Johannesburg
Nairobi|-1.29|36.82|Africa/Nairobi
Mumbai|19.08|72.88|Asia/Kolkata
Delhi|28.61|77.21|Asia/Kolkata
Bangkok|13.76|100.50|Asia/Bangkok
Singapore|1.35|103.82|Asia/Singapore
Kuala Lumpur|3.14|101.69|Asia/Kuala_Lumpur
Jakarta|-6.21|106.85|Asia/Jakarta
Bali|-8.65|115.22|Asia/Makassar
Manila|14.60|120.98|Asia/Manila
Hong Kong|22.32|114.17|Asia/Hong_Kong
Shanghai|31.23|121.47|Asia/Shanghai
Beijing|39.90|116.41|Asia/Shanghai
Taipei|25.03|121.57|Asia/Taipei
Seoul|37.57|126.98|Asia/Seoul
Tokyo|35.68|139.69|Asia/Tokyo
Osaka|34.69|135.50|Asia/Tokyo
Sapporo|43.06|141.35|Asia/Tokyo
Sydney|-33.87|151.21|Australia/Sydney
Newcastle|-32.93|151.78|Australia/Sydney
Canberra|-35.28|149.13|Australia/Sydney
Melbourne|-37.81|144.96|Australia/Melbourne
Brisbane|-27.47|153.03|Australia/Brisbane
Gold Coast|-28.02|153.40|Australia/Brisbane
Perth|-31.95|115.86|Australia/Perth
Adelaide|-34.93|138.60|Australia/Adelaide
Darwin|-12.46|130.84|Australia/Darwin
Hobart|-42.88|147.33|Australia/Hobart
Auckland|-36.85|174.76|Pacific/Auckland
Wellington|-41.29|174.78|Pacific/Auckland`;

const PLACES = RAW.split('\n').map((l) => {
  const [name, lat, lon, tz] = l.split('|');
  return { name, lat: +lat, lon: +lon, tz };
});

const km = (a, b) => {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** nearest listed city within 350 km whose clock matches `sameOffset` */
export function nearestPlace(coords, sameOffset) {
  const here = { lat: coords.latitude, lon: coords.longitude };
  let best = null;
  for (const p of PLACES) {
    const d = km(here, p);
    if (d < 350 && (!best || d < best.d) && sameOffset(p.tz)) best = { ...p, d };
  }
  return best;
}
