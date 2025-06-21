// Define your polygon region (Colombo AOI)
var geometry = ee.Geometry.Polygon([
  [
    [79.81826313813808, 6.880065386118289],
    [79.89757069429042, 6.880065386118289],
    [79.89757069429042, 6.951638580953961],
    [79.81826313813808, 6.951638580953961],
    [79.81826313813808, 6.880065386118289]
  ]
]);

// Load Sentinel-2 Surface Reflectance data (S2_SR_HARMONIZED is current)
var sentinel = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(geometry)
  .filterDate("2023-01-01", "2023-12-31")
  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 10))
  .median()
  .clip(geometry);

// Center the map and show RGB image
Map.centerObject(geometry, 14);
Map.addLayer(sentinel, {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000}, "Sentinel-2 RGB");

// ----- Shadow Detection (C3 index inspired) -----

// Select bands: Green (B3), Red (B4), NIR (B8)
var imageGRN = sentinel.select(['B3', 'B4', 'B8']);
var maxValue = imageGRN.reduce(ee.Reducer.max()).rename("max");

// Combine with blue band
var imageMAX = sentinel.addBands(maxValue);

// Compute C3-like index: atan(Blue / max(G, R, NIR))
var C3 = imageMAX.expression(
  'atan(blue / maxval)', {
    'blue': imageMAX.select('B2'),  // Blue
    'maxval': imageMAX.select('max')
  }
);

// Threshold C3 to extract shadow areas
var shadowMask = C3.gte(0.85);
var C3shadow = C3.updateMask(shadowMask);

// NDWI (water masking) to refine shadow
var NDWI = sentinel.expression(
  '(G - NIR) / (G + NIR)', {
    'G': sentinel.select('B3'),
    'NIR': sentinel.select('B8')
  }
);

// Mask water (NDWI > 0.6 are likely water)
var NDWImask = NDWI.lte(0.6);
var refinedShadow = C3shadow.updateMask(NDWImask);

// Visualize shadow areas
Map.addLayer(refinedShadow, {palette: ['red']}, "Detected Shadows");

// Optional: View NDWI for inspection
// Map.addLayer(NDWI, {min: -1, max: 1, palette: ['white', 'blue']}, 'NDWI');
