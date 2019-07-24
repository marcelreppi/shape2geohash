maps.forEach((mapData, i) => {
  const mapContainer = document.createElement("div")
  mapContainer.className = "single-map-container"

  const mapElement = document.createElement("div")
  mapElement.className = "map"
  mapElement.id = `map${i}`

  const descElement = document.createElement("div")
  descElement.className = "description"
  descElement.textContent = mapData.description

  mapContainer.appendChild(mapElement)
  mapContainer.appendChild(descElement)
  document.getElementById("maps-container").appendChild(mapContainer)

  const map = L.map(`map${i}`, {
    center: [mapData.centroid[1], mapData.centroid[0]],
    zoomSnap: 0.1,
    zoom: 9.7,
  })

  L.tileLayer("https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}", {
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: "mapbox.streets",
    accessToken:
      "pk.eyJ1IjoibWFyY2VscmVwcGkiLCJhIjoiY2p5aDVuMm55MDdwdzNqczFzZnI0dmhtcyJ9.nykEIDD-qR31rXlvinoM0A",
  }).addTo(map)

  L.geoJSON(mapData.shape, {
    color: "#000000",
    weight: 2,
    opacity: 0.5,
  }).addTo(map)

  // Draw geohashes
  mapData.geohashes.forEach(gh => {
    const [minlat, minlon, maxlat, maxlon] = geohash.decode_bbox(gh)
    L.polygon(
      [[maxlat, minlon], [maxlat, maxlon], [minlat, maxlon], [minlat, minlon], [maxlat, minlon]],
      { color: "#25c3fc", opacity: 0.5, weight: 1 }
    ).addTo(map)
  })
})
