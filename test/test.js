/* eslint-disable no-console */
const fs = require("fs")
const path = require("path")
const { default: turfCentroid } = require("@turf/centroid")
const { polygon: turfPolygon } = require("@turf/helpers")

const berlin = require("./berlin")
const shape2geohash = require("../index")

const polygon = berlin.fields.geo_shape.coordinates[0]

const maps = []

function checkForDuplicates(geohashes) {
  const geohashesAsSet = new Set(geohashes)
  if (geohashes.length !== geohashesAsSet.size) {
    console.log()
    console.log("Found duplicates")
    const unique = []
    const duplicates = []
    geohashes.forEach(gh => {
      if (unique.includes(gh)) {
        duplicates.push(gh)
      } else {
        unique.push(gh)
      }
    })
    console.log(duplicates)
    console.log()
  }
}

let centroid = turfCentroid(turfPolygon([polygon])).geometry.coordinates
let a, b, geohashes
async function testShape2Geohash() {
  a = new Date()
  geohashes = await shape2geohash([polygon])
  b = new Date()
  console.log("shape2geohash (intersect)")
  console.log("duration:", b.getTime() - a.getTime() + "ms")
  console.log("#geohashes:", geohashes.length)
  checkForDuplicates(geohashes)
  console.log("-------------------------------------------\n")

  maps.push({
    polygon,
    geohashes,
    centroid,
    description: "hashMode: intersect",
  })

  a = new Date()
  geohashes = await shape2geohash([polygon], { hashMode: "envelope" })
  b = new Date()
  console.log("shape2geohash (envelope)")
  console.log("duration:", b.getTime() - a.getTime() + "ms")
  console.log("#geohashes:", geohashes.length)
  console.log()
  checkForDuplicates(geohashes)
  console.log("-------------------------------------------\n")

  maps.push({
    polygon,
    geohashes,
    centroid,
    description: "hashMode: envelope",
  })

  a = new Date()
  geohashes = await shape2geohash([polygon], {
    hashMode: "insideOnly",
    precision: 5,
  })
  b = new Date()
  console.log("shape2geohash (insideOnly)")
  console.log("duration:", b.getTime() - a.getTime() + "ms")
  console.log("#geohashes:", geohashes.length)
  console.log()
  checkForDuplicates(geohashes)
  console.log("-------------------------------------------\n")

  maps.push({
    polygon,
    geohashes,
    centroid,
    description: "hashMode: insideOnly",
  })

  a = new Date()
  geohashes = await shape2geohash([polygon], { hashMode: "border" })
  b = new Date()
  console.log("shape2geohash (border)")
  console.log("duration:", b.getTime() - a.getTime() + "ms")
  console.log("#geohashes:", geohashes.length)
  console.log()
  checkForDuplicates(geohashes)
  console.log("-------------------------------------------\n")

  maps.push({
    polygon,
    geohashes,
    centroid,
    description: "hashMode: border",
  })

  a = new Date()
  geohashes = await shape2geohash([
    [13.226165771484375, 52.56049054341193],
    [13.546142578125, 52.44596613327885],
    [13.53515625, 52.532931647583325],
  ])
  b = new Date()
  console.log("shape2geohash (line)")
  console.log("duration:", b.getTime() - a.getTime() + "ms")
  console.log("#geohashes:", geohashes.length)
  console.log()
  checkForDuplicates(geohashes)
  console.log("-------------------------------------------\n")

  maps.push({
    polygon,
    geohashes,
    centroid,
    description: "line",
  })

  console.log(
    `Open ${path.resolve(
      "./test/visualization/index.html"
    )} to see the visual result`
  )

  const dataString = `
  const maps = ${JSON.stringify(maps, null, 2)}
  `

  fs.writeFileSync("./test/visualization/data.js", dataString)
}

testShape2Geohash()
