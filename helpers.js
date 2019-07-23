const { default: turfBbox } = require("@turf/bbox")
const { lineString: turfLine } = require("@turf/helpers")
const { default: turfLineSplit } = require("@turf/line-split")

exports.switchBbox = function(bbox) {
  const [y1, x1, y2, x2] = bbox
  return [x1, y1, x2, y2]
}

function isMulti(coordinates) {
  return Array.isArray(coordinates[0][0][0])
}

exports.isMulti = isMulti

exports.isLine = function(coordinates) {
  return !Array.isArray(coordinates[0][0])
}

exports.allRectangleEdgesWithin = function(polygon1, polygon2) {
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

exports.extractCoordinatesFromGeoJSON = function(geoJSON) {
  let result = []

  if (!geoJSON.hasOwnProperty("type")) {
    throw new Error("GeoJSON Error: GeoJSON object is missing type property")
  }

  switch (geoJSON.type) {
    case "FeatureCollection":
      geoJSON.features.forEach(f => {
        if (!f.hasOwnProperty("geometry")) {
          throw new Error("GeoJSON Error: Feature is missing geometry property")
        }

        const coordinates = this.extractCoordinatesFromGeoJSON(f.geometry)
        result = result.concat(...coordinates)
      })
      break
    case "Feature":
      if (!geoJSON.hasOwnProperty("type")) {
        throw new Error("GeoJSON Error: Feature is missing geometry property")
      }

      const coordinates = this.extractCoordinatesFromGeoJSON(geoJSON.geometry)
      coordinates.forEach(x => result.push(x))
      break
    case "Polygon":
      if (!geoJSON.hasOwnProperty("coordinates")) {
        throw new Error("GeoJSON Error: Polygon is missing coordinates property")
      }
      result.push(geoJSON.coordinates)
      break
    case "MultiPolygon":
      if (!geoJSON.hasOwnProperty("coordinates")) {
        throw new Error("GeoJSON Error: MultiPolygon is missing coordinates property")
      }

      if (!isMulti(geoJSON.coordinates)) {
        throw new Error("GeoJSON Error: MultiPolygon is actually not a MultiPolygon")
      }

      geoJSON.coordinates.forEach(p => result.push(p))
      break
    case "LineString":
      if (!geoJSON.hasOwnProperty("coordinates")) {
        throw new Error("GeoJSON Error: LineString is missing coordinates property")
      }
      result.push(geoJSON.coordinates)
      break
    case "MultiLineString":
      if (!geoJSON.hasOwnProperty("coordinates")) {
        throw new Error("GeoJSON Error: MultiLineString is missing coordinates property")
      }
      geoJSON.coordinates.forEach(l => result.push(l))
      break
  }

  return result
}
