const fs = require("fs")
const path = require("path")
const { default: turfCentroid } = require("@turf/centroid")
const { polygon: turfPolygon } = require("@turf/helpers")

const berlin = require("./berlin")
const poly2geohash = require("../index")

const polygon = berlin.fields.geo_shape.coordinates[0]

async function testPoly2Geohash() {
  const a = new Date()
  const hashes = await poly2geohash([polygon], 6)
  const b = new Date()
  console.log("poly2geohash")
  console.log("duration:", b.getTime() - a.getTime() + "ms")
  console.log("#geohashes:", hashes.length)
  console.log()
  console.log(
    `Open ${path.resolve(
      "./test/visualization/index.html"
    )} to see the visual result`
  )

  if (hashes.length !== new Set(hashes).size) {
    console.log()
    console.log("Found duplicates")
    const uniq = hashes
      .map(name => {
        return {
          count: 1,
          name: name,
        }
      })
      .reduce((a, b) => {
        a[b.name] = (a[b.name] || 0) + b.count
        return a
      }, {})

    const duplicates = Object.keys(uniq).filter(a => uniq[a] > 1)
    console.log(duplicates)
  }

  let centroid = turfCentroid(
    turfPolygon([polygon])
  ).geometry.coordinates.reverse()

  const dataString = `
  const polygon = ${JSON.stringify(polygon)}

  const geohashes = ${JSON.stringify(hashes)}

  const mapCenter = ${JSON.stringify(centroid)}
  `

  fs.writeFileSync("./test/visualization/data.js", dataString)
}

testPoly2Geohash()
