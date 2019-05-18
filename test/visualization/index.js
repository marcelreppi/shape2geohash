// console.log("Polygon:", polygon)
// console.log("Geohashes:", geohashes)
// console.log("Map Center:", mapCenter)

function initMaps() {
  const map = new google.maps.Map(document.getElementById("visual-test-map"), {
    center: { lat: mapCenter[0], lng: mapCenter[1] },
    zoom: 9.5,
  })

  const coordinates = polygon.map(([lng, lat]) => {
    return {
      lat,
      lng,
    }
  })

  // Construct the polygon.
  const mapPolygon = new google.maps.Polygon({
    paths: coordinates,
    strokeColor: "#FF0000",
    strokeOpacity: 0.3,
    strokeWeight: 2,
    fillColor: "#FF0000",
    fillOpacity: 0.1,
  })
  mapPolygon.setMap(map)

  geohashes.forEach(gh => {
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
}
