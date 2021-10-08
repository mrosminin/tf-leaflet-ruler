// на основе https://github.com/gokertanrisever/leaflet-ruler
// Добавлен сброс по ПКМ, вычисление площади, формат тултипов, форматирование расстояния по разрядам

L.Control.Ruler = L.Control.extend({
  options: {
    position: "topright",
    measureArea: true,
    circleMarker: {
      color: "red",
      radius: 2
    },
    lineStyle: {
      color: "red",
      dashArray: "1,6"
    },
    polyStyle: {
      stroke: false,
      fillColor: "red",
      fillOpacity: 0.05
    },
    lengthUnit: {
      display: "м",
      decimal: 0,
      factor: 1000,
      label: "Расстояние:"
    },
    areaUnit: {
      display: "м&#178;",
      decimal: 0,
      factor: 1,
      label: "Площадь:"
    },
    angleUnit: {
      display: "&deg;",
      decimal: 2,
      factor: null,
      label: "Азимут:"
    }
  },
  onAdd: function(map) {
    this._map = map
    this._container = L.DomUtil.create("div", "leaflet-control-ruler")
    this._container.classList.add("leaflet-control-ruler__btn")
    this._container.title = "Измерения расстояния и площади"
    L.DomEvent.disableClickPropagation(this._container)
    L.DomEvent.on(this._container, "click", this._toggleMeasure, this)
    this._choice = false
    this._defaultCursor = this._map._container.style.cursor
    this._allLayers = L.layerGroup()
    return this._container
  },
  onRemove: function() {
    L.DomEvent.off(this._container, "click", this._toggleMeasure, this)
  },
  _toggleMeasure: function() {
    this._choice = !this._choice
    this._clickedLatLong = null
    this._clickedPoints = []
    this._totalLength = 0
    if (this._choice) {
      this._map.doubleClickZoom.disable()
      L.DomEvent.on(this._map._container, "keydown", this._escape, this)
      L.DomEvent.on(this._map._container, "dblclick", this._closePath, this)
      L.DomEvent.on(this._map._container, "contextmenu", this._closePath, this)
      this._container.classList.add("active")
      this._clickCount = 0
      this._tempLine = L.featureGroup().addTo(this._allLayers)
      this._tempPoint = L.featureGroup().addTo(this._allLayers)
      this._pointLayer = L.featureGroup().addTo(this._allLayers)
      this._polylineLayer = L.featureGroup().addTo(this._allLayers)
      this._allLayers.addTo(this._map)
      this._map._container.style.cursor = "crosshair"
      this._map.on("click", this._clicked, this)
      this._map.on("mousemove", this._moving, this)
    } else {
      this._map.doubleClickZoom.enable()
      L.DomEvent.off(this._map._container, "keydown", this._escape, this)
      L.DomEvent.off(this._map._container, "dblclick", this._closePath, this)
      L.DomEvent.off(this._map._container, "contextmenu", this._closePath, this)
      this._container.classList.remove("active")
      this._map.removeLayer(this._allLayers)
      this._allLayers = L.layerGroup()
      this._map._container.style.cursor = this._defaultCursor
      this._map.off("click", this._clicked, this)
      this._map.off("mousemove", this._moving, this)
    }
  },
  _clicked: function(e) {
    if (!this._clickCount) {
      this._map.scrollWheelZoom.disable()
      this._map.zoomControl.disable()
    }
    this._clickedLatLong = e.latlng
    this._clickedPoints.push(this._clickedLatLong)
    L.circleMarker(this._clickedLatLong, this.options.circleMarker).addTo(this._pointLayer)
    if (this._clickCount > 0 && !e.latlng.equals(this._clickedPoints[this._clickedPoints.length - 2])) {
      if (this._movingLatLong) {
        L.polyline([this._clickedPoints[this._clickCount - 1], this._movingLatLong], this.options.lineStyle).addTo(this._polylineLayer)
      }
      let text
      this._totalLength += this._result.Distance
      text = `<b>${this._totalLength.toLocaleString("ru-RU", { maximumFractionDigits: this.options.lengthUnit.decimal })}</b>`
      L.circleMarker(this._clickedLatLong, this.options.circleMarker).bindTooltip(text, { permanent: true, direction: "top", className: "leaflet-ruler__result-tooltip" }).addTo(this._pointLayer).openTooltip()
    }
    this._clickCount++
  },
  _moving: function(e) {
    if (this._clickedLatLong) {
      L.DomEvent.off(this._container, "click", this._toggleMeasure, this)
      this._movingLatLong = e.latlng
      if (this._tempLine) {
        this._map.removeLayer(this._tempLine)
        this._map.removeLayer(this._tempPoint)
      }
      let text
      this._addedLength = 0
      this._tempLine = L.featureGroup()
      this._tempPoint = L.featureGroup()
      this._tempLine.addTo(this._map)
      this._tempPoint.addTo(this._map)
      this._calculateBearingAndDistance()
      this._addedLength = this._result.Distance + this._totalLength
      L.polyline([this._clickedLatLong, this._movingLatLong], this.options.lineStyle).addTo(this._tempLine)
      if (this._clickCount > 1) {
        text = `<b>${this.options.angleUnit.label}</b>&nbsp;${this._result.Bearing.toFixed(this.options.angleUnit.decimal)}${this.options.angleUnit.display}<br><b>${this.options.lengthUnit.label}</b>&nbsp;${this._addedLength.toLocaleString("ru-RU", { maximumFractionDigits: this.options.lengthUnit.decimal })}${this.options.lengthUnit.display}&nbsp;(+${this._result.Distance.toLocaleString("ru-RU", { maximumFractionDigits: this.options.lengthUnit.decimal })})`
      } else {
        text = `<b>${this.options.angleUnit.label}</b>&nbsp;${this._result.Bearing.toFixed(this.options.angleUnit.decimal)}${this.options.angleUnit.display}<br><b>${this.options.lengthUnit.label}</b>&nbsp;${this._result.Distance.toLocaleString("ru-RU", { maximumFractionDigits: this.options.lengthUnit.decimal })}${this.options.lengthUnit.display}`
      }
      L.circleMarker(this._movingLatLong, this.options.circleMarker).bindTooltip(text, { sticky: true, direction: "top", className: "leaflet-ruler__moving-tooltip" }).addTo(this._tempPoint).openTooltip()
    }
  },
  _escape: function(e) {
    if (e.keyCode === 27) {
      if (this._clickCount > 0) {
        this._closePath()
      } else {
        this._choice = true
        this._toggleMeasure()
      }
    }
  },
  _calculateBearingAndDistance: function() {
    let f1 = this._clickedLatLong.lat; let l1 = this._clickedLatLong.lng; let f2 = this._movingLatLong.lat; let l2 = this._movingLatLong.lng
    let toRadian = Math.PI / 180
    // haversine formula
    // bearing
    let y = Math.sin((l2 - l1) * toRadian) * Math.cos(f2 * toRadian)
    let x = Math.cos(f1 * toRadian) * Math.sin(f2 * toRadian) - Math.sin(f1 * toRadian) * Math.cos(f2 * toRadian) * Math.cos((l2 - l1) * toRadian)
    let brng = Math.atan2(y, x) * ((this.options.angleUnit.factor ? this.options.angleUnit.factor / 2 : 180) / Math.PI)
    brng += brng < 0 ? (this.options.angleUnit.factor ? this.options.angleUnit.factor : 360) : 0
    // distance
    let R = this.options.lengthUnit.factor ? 6371 * this.options.lengthUnit.factor : 6371 // kilometres
    let deltaF = (f2 - f1) * toRadian
    let deltaL = (l2 - l1) * toRadian
    let a = Math.sin(deltaF / 2) * Math.sin(deltaF / 2) + Math.cos(f1 * toRadian) * Math.cos(f2 * toRadian) * Math.sin(deltaL / 2) * Math.sin(deltaL / 2)
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    let distance = R * c
    this._result = {
      Bearing: brng,
      Distance: distance
    }
  },
  _closePath: function(e) {
    this._map.removeLayer(this._tempLine)
    this._map.removeLayer(this._tempPoint)
    if (this._clickCount <= 1) {
      this._map.removeLayer(this._pointLayer)
    }
    this._map.scrollWheelZoom.enable()
    this._map.zoomControl.enable()
    if (this.options.measureArea && this._clickCount > 2) {
      let poly = L.polygon(this._clickedPoints, this.options.polyStyle)
      let area = this._calcArea(poly.getLatLngs()[0]) * this.options.areaUnit.factor
      let text = `<b>${this.options.areaUnit.label}</b>&nbsp;${area.toLocaleString("ru-RU", { maximumFractionDigits: this.options.areaUnit.decimal })} ${this.options.areaUnit.display}`
      this._polyLayer = L.featureGroup().addTo(this._allLayers)
      poly.bindTooltip(text, { permanent: true, direction: "top", className: "leaflet-ruler__result-area-tooltip" }).addTo(this._polyLayer).openTooltip()
    }
    this._choice = false
    L.DomEvent.on(this._container, "click", this._toggleMeasure, this)
    this._toggleMeasure()
    e.preventDefault()
  },
  _calcArea: function(latLngs) {
    let pointsNum = latLngs.length
    let area = 0
    let d2r = Math.PI / 180
    let p1; let p2
    if (pointsNum > 2) {
      for (let i = 0; i < pointsNum; i++) {
        p1 = latLngs[i]
        p2 = latLngs[(i + 1) % pointsNum]
        area += ((p2.lng - p1.lng) * d2r) * (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r))
      }
      area = area * 6378137.0 * 6378137.0 / 2.0
    }
    return Math.abs(area)
  }
})
L.control.ruler = function(options) {
  return new L.Control.Ruler(options)
}
