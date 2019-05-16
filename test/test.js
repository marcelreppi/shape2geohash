const fs = require("fs")
const { default: turfCentroid } = require("@turf/centroid")
const { polygon: turfPolygon } = require("@turf/helpers")

const berlin = require("./berlin")
const poly2geohash = require("../index")

const polygon = berlin.fields.geo_shape.coordinates[0].map(([long, lat]) => [
  lat,
  long,
])

// const polygon = [
//   [52.5, 13.0], //[lat, long]
//   [52.5, 13.3],
//   [52.2, 13.3],
//   [52.2, 13.0],
//   [52.5, 13.0], // make sure the last coordinate is equal to the first one
// ]

const centroid = turfCentroid(turfPolygon([polygon])).geometry.coordinates

const geohashes = poly2geohash(polygon)

const dataString = `
const polygon = ${JSON.stringify(polygon)}

const geohashes = ${JSON.stringify(geohashes)}

const mapCenter = ${JSON.stringify(centroid)}
`

fs.writeFileSync("./test/visualization/data.js", dataString)
