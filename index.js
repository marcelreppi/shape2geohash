const { polygon: turfPolygon } = require("@turf/helpers")
const { default: turfBboxPolygon } = require("@turf/bbox-polygon")
const { default: turfBbox } = require("@turf/bbox")
const { default: turfEnvelope } = require("@turf/envelope")
const { default: turfIntersect } = require("@turf/intersect")
const { default: turfBooleanOverlap } = require("@turf/boolean-overlap")
const ngeohash = require("ngeohash")
const Stream = require("stream")

function switchBbox(bbox) {
  const [y1, x1, y2, x2] = bbox
  return [x1, y1, x2, y2]
}

function isMulti(coordinates) {
  return Array.isArray(coordinates[0][0][0])
}

function logGeoJSON(geojson) {
  console.log(JSON.stringify(geojson))
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

    // [minX, minY, maxX, maxY]
    const bottomRightGeohashBbox = switchBbox(
      ngeohash.decode_bbox(
        ngeohash.encode(
          originalEnvelopeBbox[1],
          originalEnvelopeBbox[2],
          precision
        )
      )
    )

    // The extended geohash envelope covers the area from top left geohash until bottom right geohash
    // I use it instead of the original envelope because I want every row match the real geohash row
    const geohashEnvelopeBbox = [
      topLeftGeohashBbox[0],
      bottomRightGeohashBbox[1],
      bottomRightGeohashBbox[2],
      topLeftGeohashBbox[3],
    ]

    this.rowWidth = Math.abs(geohashEnvelopeBbox[2] - geohashEnvelopeBbox[0])
    this.geohashHeight = Math.abs(topLeftGeohashBbox[3] - topLeftGeohashBbox[1])

    // Current point is the top left corner of the extended geohash envelope
    // Traversing the polygon from top to bottom
    this.currentPoint = [geohashEnvelopeBbox[0], geohashEnvelopeBbox[3]]

    // Bottom border of the extended geohash envelope
    this.bottomLimit = geohashEnvelopeBbox[1]
  }

  processNextRow() {
    if (this.currentPoint[1] < this.bottomLimit) {
      // We have reached the bottom of the polygon
      return null
    }

    // Calculate the row polygon
    const rowPolygon = turfBboxPolygon([
      this.currentPoint[0],
      this.currentPoint[1] - this.geohashHeight,
      this.currentPoint[0] + this.rowWidth,
      this.currentPoint[1],
    ])

    // Calculate the intersection between the row and the original polygon
    const intersectionGeoJSON = turfIntersect(this.originalPolygon, rowPolygon)

    let geohashes = [] // Geohashes for this row
    if (intersectionGeoJSON !== null) {
      let coordinates = intersectionGeoJSON.geometry.coordinates
      coordinates = isMulti(coordinates) ? coordinates : [coordinates]

      // Check every intersection part for geohashes
      coordinates.forEach(polygon => {
        geohashes.push(...this.checkRowSegment(polygon))
      })
    }

    // Move one row lower
    this.currentPoint[1] -= this.geohashHeight

    return geohashes
  }

  checkRowSegment(coordinates) {
    // Convert coordinates into polygon object
    const originalPolygon = turfPolygon(coordinates)
    const envelopeBbox = turfBbox(turfEnvelope(originalPolygon))

    const mostLeftGeohash = ngeohash.encode(
      envelopeBbox[3],
      envelopeBbox[0],
      this.precision
    )

    const geohashList = []

    // Checking every geohash in the row from left to right
    let currentGeohash = mostLeftGeohash

    while (true) {
      const geohashPolygon = turfBboxPolygon(
        switchBbox(ngeohash.decode_bbox(currentGeohash))
      )

      // Check if geohash polygon overlaps/intersects with original polygon
      // I need to check both because of some weird bug with turf
      const overlap =
        turfBooleanOverlap(originalPolygon, geohashPolygon) ||
        turfIntersect(originalPolygon, geohashPolygon)

      // If yes -> add it to the list of geohashes
      if (overlap) {
        geohashList.push(currentGeohash)
      }

      const maxX = geohashPolygon.bbox[2]
      if (maxX > envelopeBbox[2]) {
        // If right edge of current geohash is out of bounds we are done
        currentGeohash = null
        break
      }

      // Get eastern neighbor and set him as next geohash to be checked
      currentGeohash = ngeohash.neighbor(currentGeohash, [0, 1])
    }

    return geohashList
  }

  _read(size) {
    const rowGeohashes = this.processNextRow()
    if (rowGeohashes !== null) {
      this.push(rowGeohashes) // Push data out of the stream
    } else {
      this.push(null) // End the stream
    }
  }
}

const defaultOptions = {
  precision: 6,
}

function poly2geohash(polygons, options = {}) {
  options = { ...defaultOptions, ...options } // overwrite default options
  const allPolygons = isMulti(polygons) ? polygons : [polygons] // make sure allPolygons is always an array
  const allGeohashes = []

  allPolygons.map(polygon => {
    return new Promise((resolve, reject) => {
      const geohashStream = new GeohashStream(polygon, options.precision)

      const writer = new Stream.Writable({
        objectMode: true,
        write: (rowGeohashes, enc, callback) => {
          allGeohashes.push(...rowGeohashes)
          callback()
        },
      })

      geohashStream.pipe(writer) // Kick off the stream

      geohashStream.on("end", () => {
        resolve()
      })
    })
  })

  return Promise.all(allPolygons).then(() => allGeohashes)
}

module.exports = poly2geohash
