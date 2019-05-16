const { polygon: turfPolygon } = require("@turf/helpers")
const { default: turfIntersect } = require("@turf/intersect")
const { default: turfbboxPolygon } = require("@turf/bbox-polygon")
const { default: turfCentroid } = require("@turf/centroid")
const ngeohash = require("ngeohash")

// coordinates should look like this:
// [[lat, long], [lat, long], ...]
function poly2geohash(coordinates, precision = 5, inner = false) {
  // Convert coordinates into polygon object
  const originalPolygon = turfPolygon([coordinates])
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

    const polygon = turfbboxPolygon(ngeohash.decode_bbox(currentGeohash))

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

module.exports = poly2geohash
