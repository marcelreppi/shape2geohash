// console.log("Polygon:", polygon)
// console.log("Geohashes:", geohashes)
// console.log("Map Center:", mapCenter)

function initMaps() {
  maps.forEach(mapData => {
    const mapContainer = document.createElement("div")
    mapContainer.className = "single-map-container"

    const mapElement = document.createElement("div")
    mapElement.className = "map"

    const descElement = document.createElement("div")
    descElement.className = "description"
    descElement.textContent = mapData.description

    mapContainer.appendChild(mapElement)
    mapContainer.appendChild(descElement)
    document.getElementById("maps-container").appendChild(mapContainer)

    const map = new google.maps.Map(mapElement, {
      center: { lng: mapData.centroid[0], lat: mapData.centroid[1] },
      zoom: 9.5,
    })

    function handlePolygon(coordinates) {
      let outerPath = coordinates[0]
      let innerPath = coordinates[1] || []

      outerPath = outerPath.map(([lng, lat]) => {
        return {
          lat,
          lng,
        }
      })

      innerPath = innerPath
        .map(([lng, lat]) => {
          return {
            lat,
            lng,
          }
        })
        .reverse()

      // Construct the polygon.
      const mapPolygon = new google.maps.Polygon({
        paths: [outerPath, innerPath],
        strokeColor: "#FF0000",
        strokeOpacity: 0.3,
        strokeWeight: 2,
        fillColor: "#FF0000",
        fillOpacity: 0.1,
      })
      mapPolygon.setMap(map)
    }

    // Draw all polygons
    if (mapData.shape.type === "MultiPolygon") {
      mapData.shape.coordinates.forEach(handlePolygon)
    } else {
      handlePolygon(mapData.shape.coordinates)
    }

    // Draw geohashes
    mapData.geohashes.forEach(gh => {
      const [minlat, minlon, maxlat, maxlon] = geohash.decode_bbox(gh)
      const coordinates = [
        { lat: maxlat, lng: minlon },
        { lat: maxlat, lng: maxlon },
        { lat: minlat, lng: maxlon },
        { lat: minlat, lng: minlon },
      ]
      const geohashPolygon = new google.maps.Polygon({
        paths: coordinates,
        strokeColor: "#25c3fc",
        strokeOpacity: 0.3,
        strokeWeight: 2,
        fillColor: "#25c3fc",
        fillOpacity: 0.2,
      })
      geohashPolygon.setMap(map)
    })
  })
}
