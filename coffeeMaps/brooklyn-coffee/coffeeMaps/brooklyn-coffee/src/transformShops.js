import rawData from './assets/shops.json';

export function getShops() {
  return rawData.features
    .filter((f) => f.properties && f.properties.name)
    .map((f) => ({
      id: f.id ?? f.properties['@id'],
      name: f.properties.name,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      address: f.properties['addr:housenumber'] && f.properties['addr:street']
        ? `${f.properties['addr:housenumber']} ${f.properties['addr:street']}`
        : null,
      openingHours: f.properties['opening_hours'] || null,
    }));
}