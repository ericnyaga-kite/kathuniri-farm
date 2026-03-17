// Shared Leaflet map component — shows plot pins, tapping opens detail
// Leaflet CSS must be imported in the page that uses this component

import { useEffect, useRef } from 'react'
import type { Map as LMap, Marker } from 'leaflet'

// Farm centre (Embu County, Kenya) — default if no plots have coordinates
const FARM_LAT = -0.53
const FARM_LNG = 37.45

interface PlotPin {
  id: string
  canonicalName: string
  plotType: string
  lat: number | null
  lng: number | null
}

const TYPE_COLOUR: Record<string, string> = {
  tea:     '#16a34a',
  crop:    '#d97706',
  pasture: '#65a30d',
  other:   '#6b7280',
}

function makeIcon(L: typeof import('leaflet'), type: string) {
  const colour = TYPE_COLOUR[type] ?? TYPE_COLOUR.other
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="24" height="32">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z"
        fill="${colour}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
    </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -32],
  })
}

export function FarmMap({
  plots,
  onPlotClick,
  editingPlotId,
  onLocationPicked,
}: {
  plots: PlotPin[]
  onPlotClick?: (id: string) => void
  editingPlotId?: string | null      // if set, clicking map sets coordinates for this plot
  onLocationPicked?: (lat: number, lng: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<LMap | null>(null)
  const markersRef   = useRef<Marker[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('leaflet').then(L => {
      // Fix default marker icon path for bundlers
      // @ts-expect-error _getIconUrl
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const pinned = plots.filter(p => p.lat && p.lng)
      const centre: [number, number] = pinned.length
        ? [pinned[0].lat!, pinned[0].lng!]
        : [FARM_LAT, FARM_LNG]

      const map = L.map(containerRef.current!, { zoomControl: true }).setView(centre, 15)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      }).addTo(map)

      mapRef.current = map

      // Add markers for plots that have coordinates
      pinned.forEach(p => {
        const marker = L.marker([p.lat!, p.lng!], { icon: makeIcon(L, p.plotType) })
          .addTo(map)
          .bindPopup(`<strong>${p.canonicalName}</strong>`)
        marker.on('click', () => onPlotClick?.(p.id))
        markersRef.current.push(marker)
      })

      // If editingPlotId, clicking the map emits coordinates
      if (editingPlotId) {
        map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
          onLocationPicked?.(e.latlng.lat, e.latlng.lng)
        })
        // Show crosshair cursor
        map.getContainer().style.cursor = 'crosshair'
      }

      // Fit bounds if multiple pins
      if (pinned.length > 1) {
        const bounds = L.latLngBounds(pinned.map(p => [p.lat!, p.lng!] as [number, number]))
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current = []
    }
  }, []) // only mount once

  return <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />
}
