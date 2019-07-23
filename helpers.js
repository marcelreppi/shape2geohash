const { default: turfBbox } = require("@turf/bbox")
const { lineString: turfLine } = require("@turf/helpers")
const { default: turfLineSplit } = require("@turf/line-split")

function switchBbox(bbox) {
  const [y1, x1, y2, x2] = bbox
  return [x1, y1, x2, y2]
}

function isMulti(coordinates) {
  return Array.isArray(coordinates[0][0][0])
}

function isLine(coordinates) {
  return !Array.isArray(coordinates[0][0])
}

function isPoint(coordinates) {
  return !Array.isArray(coordinates[0])
}

function allRectangleEdgesWithin(polygon1, polygon2) {
  const bbox = turfBbox(polygon1)
  const edge = turfLine([
    [bbox[0], bbox[3]], // Top edge
    [bbox[2], bbox[3]], // Top edge
    [bbox[2], bbox[3]], // Right edge
    [bbox[2], bbox[1]], // Right edge
    [bbox[2], bbox[1]], // Bottom edge
    [bbox[0], bbox[1]], // Bottom edge
    [bbox[0], bbox[1]], // Left edge
    [bbox[0], bbox[3]], // Left edge
  ])
  // Make sure the polygon does not split the line into separate segments
  return turfLineSplit(edge, polygon2).features.length === 0
}

function extractCoordinatesFromGeoJSON(geoJSON) {
  let result = []

  if (!geoJSON.hasOwnProperty("type")) {
    throw new Error("GeoJSON Error: GeoJSON object is missing type property")
  }

  const checkForCoordinates = [
    "Polygon",
    "MultiPolygon",
    "LineString",
    "MultiLineString",
    "Point",
    "MultiPoint",
  ]
  if (checkForCoordinates.includes(geoJSON.type)) {
    if (!geoJSON.hasOwnProperty("coordinates")) {
      throw new Error(`GeoJSON Error: ${geoJSON.type} is missing "coordinates" property`)
    }
  }

  switch (geoJSON.type) {
    case "FeatureCollection":
      geoJSON.features.forEach(f => {
        const coordinates = extractCoordinatesFromGeoJSON(f)
        result.push(...coordinates)
      })
      break
    case "Feature":
      if (!geoJSON.hasOwnProperty("geometry")) {
        throw new Error("GeoJSON Error: Feature is missing geometry property")
      }

      const coordinates = extractCoordinatesFromGeoJSON(geoJSON.geometry)
      result.push(...coordinates)
      break
    case "Polygon":
      result.push(geoJSON.coordinates)
      break
    case "MultiPolygon":
      if (!isMulti(geoJSON.coordinates)) {
        throw new Error("GeoJSON Error: MultiPolygon is actually not a MultiPolygon")
      }

      result.push(...geoJSON.coordinates)
      break
    case "LineString":
      result.push(geoJSON.coordinates)
      break
    case "MultiLineString":
      result.push(...geoJSON.coordinates)
      break
    case "Point":
      result.push(geoJSON.coordinates)
      break
    case "MultiPoint":
      result.push(...geoJSON.coordinates)
      break
  }

  return result
}

module.exports = {
  switchBbox,
  isPoint,
  isLine,
  isMulti,
  allRectangleEdgesWithin,
  extractCoordinatesFromGeoJSON,
}
