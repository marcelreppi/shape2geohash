const fs = require("fs")

const berlin = require("./berlin")
const poly2geohash = require("../index")

const berlinPolygon = berlin.fields.geo_shape.coordinates[0].map(
  ([long, lat]) => [lat, long]
)

const geohashes = poly2geohash(berlinPolygon)

const dataString = `
const polygon = ${JSON.stringify(berlinPolygon)}

const geohashes = ${JSON.stringify(geohashes)}

const mapCenter = ${JSON.stringify(berlin.fields.geo_point_2d)}
`

fs.writeFileSync("./test/visualization/data.js", dataString)
