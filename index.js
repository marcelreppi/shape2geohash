const { polygon: turfPolygon } = require("@turf/helpers")
const { default: turfIntersect } = require("@turf/intersect")
const { default: turfBboxPolygon } = require("@turf/bbox-polygon")
const { default: turfBbox } = require("@turf/bbox")
const { default: turfCentroid } = require("@turf/centroid")
const { default: turfEnvelope } = require("@turf/envelope")
const ngeohash = require("ngeohash")
const Stream = require("stream")
const async = require("async")
const through2 = require("through2")

// coordinates should look like this:
// [[lat, long], [lat, long], ...]
function poly2geohash(coordinates, precision = 5, inner = false) {
  // Convert coordinates into polygon object
  const originalPolygon = turfPolygon(coordinates)
  const geohashList = []

  const seenGeohashes = []

  // Take centroid of polygon and turn it into geohash
  const centroid = turfCentroid(originalPolygon)
  const centroidHash = ngeohash.encode(
    ...centroid.geometry.coordinates,
    precision
  )
  // Put it in geohashQueue
  const geohashQueue = [centroidHash]

  // While queue is not empty do the following
  while (geohashQueue.length !== 0) {
    // Take next geohash and turn it into polygon object
    const currentGeohash = geohashQueue.pop()
    seenGeohashes.push(currentGeohash)

    const polygon = turfBboxPolygon(ngeohash.decode_bbox(currentGeohash))

    // Check if it intersects with original polygon
    const intersection = turfIntersect(originalPolygon, polygon)

    // If yes -> add it to the list of outer geohashes
    // If no -> continue with next geohash
    if (intersection && !geohashList.includes(currentGeohash)) {
      geohashList.push(currentGeohash)
    } else {
      continue
    }

    // Get all neighbors of current geohash
    // If they haven't been checked yet add them to the queue
    ngeohash.neighbors(currentGeohash).forEach(n => {
      if (!seenGeohashes.includes(n)) {
        geohashQueue.push(n)
      }
    })
  }

  return geohashList
}

function switchBbox(bbox) {
  const [y1, x1, y2, x2] = bbox
  return [x1, y1, x2, y2]
}

function isMulti(geoJSON) {
  return Array.isArray(geoJSON.geometry.coordinates[0][0][0])
}

function logGeoJSON(geojson) {
  console.log(JSON.stringify(geojson))
}

function poly2geohashBox(coordinates, precision = 5) {
  function getNeighbors(geohashObj) {
    const { geohash, dir } = geohashObj
    const neighbors = []
    switch (dir) {
      case "s":
        neighbors.push({
          geohash: ngeohash.neighbor(geohash, [-1, 0]),
          dir: "s",
        })
        break
      case "e":
        neighbors.push({
          geohash: ngeohash.neighbor(geohash, [0, 1]),
          dir: "e",
        })
        break
      default:
        neighbors.push({
          geohash: ngeohash.neighbor(geohash, [-1, 0]),
          dir: "s",
        })
        neighbors.push({
          geohash: ngeohash.neighbor(geohash, [-1, 1]),
          dir: "se",
        })
        neighbors.push({
          geohash: ngeohash.neighbor(geohash, [0, 1]),
          dir: "e",
        })
    }
    return neighbors
  }

  // Convert coordinates into polygon object
  const originalPolygon = turfPolygon(coordinates)

  // logGeoJSON(originalPolygon)

  const envelopeBbox = turfBbox(turfEnvelope(originalPolygon))

  // logGeoJSON(turfEnvelope(originalPolygon))
  // console.log(envelopeBbox)

  const topLeftHash = ngeohash.encode(
    envelopeBbox[3],
    envelopeBbox[0],
    precision
  )

  const geohashList = []
  const geohashQueue = [{ geohash: topLeftHash, dir: "se" }]

  while (geohashQueue.length !== 0) {
    const geohashObj = geohashQueue.pop()
    const hashPolygon = turfBboxPolygon(
      switchBbox(ngeohash.decode_bbox(geohashObj.geohash))
    )

    // Check if it intersects with original polygon
    const intersection = turfIntersect(originalPolygon, hashPolygon)

    // logGeoJSON(intersection)

    // If yes -> add it to the list of outer geohashes
    // If no -> continue with next geohash
    if (intersection) {
      geohashList.push(geohashObj.geohash)
    }

    const [minX, minY, maxX, maxY] = hashPolygon.bbox
    if (maxX > envelopeBbox[2] || minY < envelopeBbox[1] - 1) {
      continue
    }

    // Get specific neighbors of current geohash
    const neighbors = getNeighbors(geohashObj)

    // Add them to the queue
    geohashQueue.push(...neighbors)
  }

  return geohashList
}

class GeohashStream extends Stream.Readable {
  constructor(geoJSON, precision) {
    super({ objectMode: true })
    this.precision = precision

    this.originalPolygon = turfPolygon(geoJSON)

    // [minX, minY, maxX, maxY]
    const originalEnvelopeBbox = turfBbox(turfEnvelope(this.originalPolygon))

    // [minX, minY, maxX, maxY]
    const topLeftGeohashBbox = switchBbox(
      ngeohash.decode_bbox(
        ngeohash.encode(
          originalEnvelopeBbox[3],
          originalEnvelopeBbox[0],
          precision
        )
      )
    )

    this.rowWidth = Math.abs(originalEnvelopeBbox[2] - originalEnvelopeBbox[0])
    this.geohashHeight = Math.abs(topLeftGeohashBbox[3] - topLeftGeohashBbox[1])

    this.currentPoint = [originalEnvelopeBbox[0], originalEnvelopeBbox[3]]
    this.bottomLimit = originalEnvelopeBbox[1]
  }

  processNextRow() {
    if (this.currentPoint[1] < this.bottomLimit) {
      return null
    }

    const rowPolygon = turfBboxPolygon([
      this.currentPoint[0],
      this.currentPoint[1] - this.geohashHeight,
      this.currentPoint[0] + this.rowWidth,
      this.currentPoint[1],
    ])

    // logGeoJSON(rowPolygon)

    const intersectionGeoJSON = turfIntersect(this.originalPolygon, rowPolygon)
    // logGeoJSON(intersectionGeoJSON)
    let geohashes = []
    if (intersectionGeoJSON !== null) {
      let coordinates = intersectionGeoJSON.geometry.coordinates
      if (!isMulti(intersectionGeoJSON)) {
        coordinates = [coordinates]
      }

      coordinates.forEach(polygon => {
        geohashes.push(...poly2geohashBox(polygon, this.precision))
      })
    }

    this.currentPoint[1] -= this.geohashHeight

    return geohashes
  }

  _read(size) {
    // console.log("read")
    const geohashes = this.processNextRow()
    if (geohashes !== null) {
      this.push(geohashes)
    } else {
      this.push(null)
    }
  }
}

function poly2geohashStream(geoJSON, precision = 5, callback) {
  const geohashes = []
  const stream = new GeohashStream(geoJSON, precision)
  stream.on("end", () => {
    // console.log(geohashes)
    callback(geohashes)
  })

  stream.pipe(
    through2.obj((hashes, enc, callback) => {
      geohashes.push(...hashes)
      callback()
    })
  )
}

module.exports = {
  poly2geohash,
  poly2geohashBox,
  poly2geohashStream,
}
