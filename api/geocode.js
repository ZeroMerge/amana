/**
 * Vercel Serverless Function: Reverse Geocoding Proxy
 * Converts latitude & longitude to human-readable place names via Google Maps Geocoding API.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng } = req.query || {};

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Missing lat or lng parameter' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      place_name: `Location (${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)})`,
      formatted_address: `Coordinates: ${lat}, ${lng}`
    });
  }

  try {
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const geoRes = await fetch(geoUrl);
    const data = await geoRes.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const topResult = data.results[0];
      return res.status(200).json({
        place_name: topResult.formatted_address,
        formatted_address: topResult.formatted_address,
        place_id: topResult.place_id
      });
    }

    return res.status(200).json({
      place_name: `Coordinates (${lat}, ${lng})`,
      formatted_address: `Lat ${lat}, Lng ${lng}`
    });
  } catch (err) {
    console.error('Geocoding error:', err);
    return res.status(200).json({
      place_name: `Coordinates (${lat}, ${lng})`,
      formatted_address: `Lat ${lat}, Lng ${lng}`
    });
  }
}
