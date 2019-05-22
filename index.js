const { polygon: turfPolygon, lineString: turfLine } = require("@turf/helpers")
const { default: turfBboxPolygon } = require("@turf/bbox-polygon")
const { default: turfBbox } = require("@turf/bbox")
const { default: turfEnvelope } = require("@turf/envelope")
const { default: turfIntersect } = require("@turf/intersect")
const { default: turfBooleanOverlap } = require("@turf/boolean-overlap")
const { default: turfBooleanWithin } = require("@turf/boolean-within")
const { default: turfLineToPolygon } = require("@turf/line-to-polygon")
const { default: turfLineSplit } = require("@turf/line-split")
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

function isLine(coordinates) {
  return !Array.isArray(coordinates[0][0])
}

class GeohashStream extends Stream.Readable {
  constructor(shapeCoordinates, options) {
    super({ objectMode: true })

    this.options = options

    this.originalPolygon = isLine(shapeCoordinates)
      ? turfLineToPolygon(turfLine(shapeCoordinates))
      : turfPolygon(shapeCoordinates)

    // [minX, minY, maxX, maxY]
    const originalEnvelopeBbox = turfBbox(turfEnvelope(this.originalPolygon))

    // [minX, minY, maxX, maxY]
    const topLeftGeohashBbox = switchBbox(
      ngeohash.decode_bbox(
        ngeohash.encode(
          originalEnvelopeBbox[3],
          originalEnvelopeBbox[0],
          this.options.precision
        )
      )
    )

    // [minX, minY, maxX, maxY]
    const bottomRightGeohashBbox = switchBbox(
      ngeohash.decode_bbox(
        ngeohash.encode(
          originalEnvelopeBbox[1],
          originalEnvelopeBbox[2],
          this.options.precision
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

    // Used in processRowSegment to keep track of how much area of the row
    // has been covered by the matching geohashes
    // Prevent duplicate geohashes
    this.rowProgress = -Infinity
  }

  processNextRow() {
    if (this.currentPoint[1] <= this.bottomLimit) {
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

    let geohashes = [] // Geohashes for this row

    if (this.options.hashMode === "envelope") {
      geohashes.push(...this.processRowSegment(rowPolygon.geometry.coordinates))
    } else {
      // Calculate the intersection between the row and the original polygon
      const intersectionGeoJSON = turfIntersect(
        this.originalPolygon,
        rowPolygon
      )
      if (intersectionGeoJSON !== null) {
        let coordinates = intersectionGeoJSON.geometry.coordinates
        coordinates = isMulti(coordinates) ? coordinates : [coordinates]

        // Check every intersection part for geohashes
        coordinates.forEach(polygon => {
          geohashes.push(...this.processRowSegment(polygon))
        })
      }
    }

    // Move one row lower
    this.currentPoint[1] -= this.geohashHeight

    // Reset rowProgress
    this.rowProgress = -Infinity

    return geohashes
  }

  // Returns all the geohashes that are within the current row
  processRowSegment(coordinates) {
    // Convert coordinates into polygon object
    const segmentPolygon = turfPolygon(coordinates)
    const envelopeBbox = turfBbox(turfEnvelope(segmentPolygon))

    // Most left geohash in box OR the next geohash after current rowProgress
    const startingGeohash = ngeohash.encode(
      envelopeBbox[3],
      Math.max(this.rowProgress, envelopeBbox[0] + 0.00001), // Add some small long value to avoid edge cases
      this.options.precision
    )

    const geohashList = []

    // Checking every geohash in the row from left to right
    let currentGeohash = startingGeohash

    while (true) {
      const geohashPolygon = turfBboxPolygon(
        switchBbox(ngeohash.decode_bbox(currentGeohash))
      )

      let addGeohash = false
      switch (this.options.hashMode) {
        case "intersect":
          // Only add geohash if they intersect with the original polygon
          addGeohash = turfBooleanOverlap(segmentPolygon, geohashPolygon)
          break
        case "envelope":
          addGeohash = true // add every geohash
          break
        case "insideOnly":
          // Only add geohash if it is completely within the original polygon
          addGeohash = turfBooleanWithin(geohashPolygon, this.originalPolygon)
          break
        case "border":
          // Only add geohash if they overlap
          addGeohash =
            turfBooleanOverlap(segmentPolygon, geohashPolygon) &&
            !turfBooleanWithin(geohashPolygon, this.originalPolygon)

          if (this.options.lineReference !== undefined && addGeohash) {
            // If user passed in a line there is a lineReference
            // Because the input line is turned into a polygon, there is a line in the polygon that needs to be ignored
            // Check if the geohash polygon intersects with the original line (lineReference)
            const lineSegments = turfLineSplit(
              this.options.lineReference,
              geohashPolygon
            )
            // If there is no intersection, don't add the geohash
            if (lineSegments.features.length === 0) {
              addGeohash = false
            }
          }
          break
        default:
          break
      }

      // Check if geohash polygon overlaps/intersects with original polygon
      // I need to check both because of some weird bug with turf

      // If yes -> add it to the list of geohashes
      if (addGeohash) {
        geohashList.push(currentGeohash)
      }

      // Save rowProgress
      // maxX plus some small amount to avoid overlapping edges due to lat/long inaccuracies
      this.rowProgress = turfBbox(geohashPolygon)[2] + 0.00001

      const maxX = geohashPolygon.bbox[2]
      if (maxX >= envelopeBbox[2]) {
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
  hashMode: "intersect",
}

async function shape2geohash(shapes, options = {}) {
  options = { ...defaultOptions, ...options } // overwrite default options
  const allShapes = isMulti(shapes) ? shapes : [shapes] // make sure allShapes is always an array
  const allGeohashes = []

  const allShapePromises = allShapes.map(shape => {
    return new Promise((resolve, reject) => {
      const deepShapeCopy = [...shape]
      if (isLine(deepShapeCopy)) {
        options.lineReference = turfLine([...shape]) // Make deep copy and use it later to only add geohashes that are on the line
        options.hashMode = "border" // Turn on border mode
      }
      const geohashStream = new GeohashStream(deepShapeCopy, options)

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

  return Promise.all(allShapePromises).then(() => allGeohashes)
}

module.exports = shape2geohash
