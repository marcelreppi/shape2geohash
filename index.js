const { polygon: turfPolygon, lineString: turfLine, point: turfPoint } = require("@turf/helpers")
const { default: turfBboxPolygon } = require("@turf/bbox-polygon")
const { default: turfBbox } = require("@turf/bbox")
const { default: turfEnvelope } = require("@turf/envelope")
const { default: turfIntersect } = require("@turf/intersect")
const { default: turfBooleanOverlap } = require("@turf/boolean-overlap")
const { default: turfBooleanWithin } = require("@turf/boolean-within")
const { default: turfBooleanPointInPolygon } = require("@turf/boolean-point-in-polygon")
const { default: turfLineSplit } = require("@turf/line-split")
const { default: turfArea } = require("@turf/area")
const ngeohash = require("ngeohash")
const Stream = require("stream")

const {
  isPoint,
  isLine,
  isMulti,
  switchBbox,
  allRectangleEdgesWithin,
  extractCoordinatesFromGeoJSON,
} = require("./helpers")

const defaultOptions = {
  precision: 6,
  hashMode: "intersect",
  minIntersect: 0,
  customWriter: null,
  allowDuplicates: true,
}

async function shape2geohash(shapes, options = {}) {
  options = { ...defaultOptions, ...options } // overwrite default options

  let allShapes = null
  if (Array.isArray(shapes)) {
    // The input is either an array of polygon coordinates or a list of polygons
    allShapes = isMulti(shapes) ? shapes : [shapes] // Make sure allShapes is always an array of shapes
  } else {
    allShapes = extractCoordinatesFromGeoJSON(shapes)
  }

  let allGeohashes = []

  if (!options.allowDuplicates) {
    allGeohashes = new Set()
  }

  const addGeohashes = geohashes => {
    if (!options.allowDuplicates) {
      geohashes.forEach(gh => allGeohashes.add(gh))
      return
    }
    allGeohashes.push(...geohashes)
  }

  const allShapePromises = allShapes.map(shape => {
    return new Promise((resolve, reject) => {
      if (isPoint(shape) && options.customWriter === null) {
        // Optimization for points. No need for streams.
        addGeohashes([ngeohash.encode(...shape.reverse(), options.precision)])
        resolve()
        return
      }

      const geohashStream = new GeohashStream(shape, options)

      const writer = new Stream.Writable({
        objectMode: true,
        write: (rowGeohashes, enc, callback) => {
          addGeohashes(rowGeohashes)
          callback()
        },
      })

      if (options.customWriter) {
        geohashStream.pipe(options.customWriter)
      } else {
        geohashStream.pipe(writer) // Kick off the stream
      }

      geohashStream.on("end", () => {
        resolve()
      })
    })
  })

  return Promise.all(allShapePromises).then(() => Array.from(allGeohashes))
}

class GeohashStream extends Stream.Readable {
  constructor(shapeCoordinates, options) {
    super({ objectMode: true })

    this.options = options

    this.shapeIsPoint = isPoint(shapeCoordinates)
    if (this.shapeIsPoint) {
      this.pointCoordinates = shapeCoordinates
      return
    }

    this.originalShape = isLine(shapeCoordinates)
      ? turfLine(shapeCoordinates)
      : turfPolygon(shapeCoordinates)

    // [minX, minY, maxX, maxY]
    const originalEnvelopeBbox = turfBbox(turfEnvelope(this.originalShape))

    // [minX, minY, maxX, maxY]
    const topLeftGeohashBbox = switchBbox(
      ngeohash.decode_bbox(
        ngeohash.encode(originalEnvelopeBbox[3], originalEnvelopeBbox[0], this.options.precision)
      )
    )

    // [minX, minY, maxX, maxY]
    const bottomRightGeohashBbox = switchBbox(
      ngeohash.decode_bbox(
        ngeohash.encode(originalEnvelopeBbox[1], originalEnvelopeBbox[2], this.options.precision)
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

    // The minimum shared area between the polygon and the geohash
    this.minIntersectArea =
      this.options.minIntersect * turfArea(turfBboxPolygon(topLeftGeohashBbox))

    // Used in processRowSegment to keep track of how much area of the row
    // has been covered by the matching geohashes
    // Prevent duplicate geohashes
    this.rowProgress = -Infinity
  }

  _read(size) {
    if (this.shapeIsPoint) {
      this.push([ngeohash.encode(...this.pointCoordinates.reverse(), this.options.precision)])
      this.push(null)
      return
    }

    const rowGeohashes = this.processNextRow()
    if (rowGeohashes !== null) {
      this.push(rowGeohashes) // Push data out of the stream
    } else {
      this.push(null) // End the stream
    }
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

    const geohashes = [] // Geohashes for this row

    if (this.options.hashMode === "envelope") {
      geohashes.push(...this.processRowSegment(rowPolygon.geometry.coordinates))
    } else {
      if (this.originalShape.geometry.type === "LineString") {
        const lineSegments = turfLineSplit(this.originalShape, rowPolygon).features

        if (lineSegments.length === 0) {
          // Line is completely inside rowPolygon so just add the originalShape
          lineSegments.push(this.originalShape)
        }

        let evenPairs
        const firstPointOfFirstSegment = lineSegments[0].geometry.coordinates[0]
        if (turfBooleanPointInPolygon(firstPointOfFirstSegment, rowPolygon)) {
          evenPairs = true
        } else {
          evenPairs = false
        }
        // Filter for line segments that are inside the row polygon
        // Put an envelope around the segment and get geohashes
        lineSegments
          .filter((p, i) => (evenPairs ? i % 2 == 0 : i % 2 == 1))
          .forEach(lineSegment => {
            const lineSegmentEnvelope = turfEnvelope(lineSegment).geometry.coordinates
            geohashes.push(...this.processRowSegment(lineSegmentEnvelope))
          })
      } else {
        // Its a Polygon
        // Calculate the intersection between the row and the original polygon
        const intersectionGeoJSON = turfIntersect(this.originalShape, rowPolygon)
        if (intersectionGeoJSON !== null) {
          let coordinates = intersectionGeoJSON.geometry.coordinates
          coordinates = isMulti(coordinates) ? coordinates : [coordinates]

          // Check every intersection part for geohashes
          coordinates.forEach(polygon => {
            geohashes.push(...this.processRowSegment(polygon))
          })
        }
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
      const geohashPolygon = turfBboxPolygon(switchBbox(ngeohash.decode_bbox(currentGeohash)))

      let addGeohash = false

      if (this.originalShape.geometry.type === "LineString") {
        // We add every geohash because all segments that come in are envelopes of the relevant line segments
        addGeohash = true
      } else {
        // Its a polygon
        switch (this.options.hashMode) {
          case "intersect":
            // Only add geohash if they intersect/overlap with the original polygon
            addGeohash = turfBooleanOverlap(segmentPolygon, geohashPolygon)

            if (addGeohash && this.minIntersectArea > 0) {
              const intersect = turfIntersect(this.originalShape, geohashPolygon)
              addGeohash = turfArea(intersect) >= this.minIntersectArea
            }
            break
          case "envelope":
            addGeohash = true // add every geohash
            break
          case "insideOnly":
            // Only add geohash if it is completely within the original polygon
            addGeohash =
              turfBooleanWithin(geohashPolygon, this.originalShape) &&
              allRectangleEdgesWithin(geohashPolygon, this.originalShape)
            // Extra check to avoid turf.js bug
            // REMOVE allRectangleEdgesWithin CHECK IF POSSIBLE -> NEGATIVE PERFORMANCE IMPACT
            break
          case "border":
            // Only add geohash if they overlap
            addGeohash =
              turfBooleanOverlap(segmentPolygon, geohashPolygon) &&
              !turfBooleanWithin(geohashPolygon, this.originalShape)
            break
        }
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
}

module.exports = shape2geohash
