"use client";

import { useEffect, useRef } from "react";

type MapProps = {
  onBarangayClick?: (barangayName: string) => void;
};

export default function Map({ onBarangayClick }: MapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    let map: any;

    const loadMap = async () => {
      const L = await import("leaflet");

      if (!mapRef.current) return;

      // Prevent Leaflet from initializing the same container twice
      if ((mapRef.current as any)._leaflet_id) {
        return;
      }

      // ==========================================
      // MAP
      // ==========================================

      map = L.map(mapRef.current, {
        center: [14.393, 120.852],
        zoom: 14,
        minZoom: 12,
        maxZoom: 18,
        zoomControl: true,
      });

      // ==========================================
      // OPENSTREETMAP
      // ==========================================

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }
      ).addTo(map);

      // ==========================================
      // LOAD TANZA GEOJSON
      // ==========================================

      try {
        const response = await fetch(
          "/data/tanza-barangays.geojson"
        );

        if (!response.ok) {
          throw new Error("GeoJSON could not be loaded.");
        }

        const data = await response.json();

        // ==========================================
        // BARANGAY LAYER
        // ==========================================

        let barangayLayer: any;

        barangayLayer = L.geoJSON(data, {
          style: {
            color: "#475569",
            weight: 1,
            fillColor: "#22c55e",
            fillOpacity: 0.25,
          },

          onEachFeature: (
            feature: any,
            layer: any
          ) => {

            // Get barangay name
            const barangayName =
              feature.properties?.brgy_name ||
              feature.properties?.barangay ||
              feature.properties?.Barangay ||
              feature.properties?.name ||
              feature.properties?.NAME ||
              feature.properties?.BRGY_NAME ||
              "Barangay";

            // ======================================
            // BARANGAY LABEL
            // ======================================

            layer.bindTooltip(
              barangayName,
              {
                permanent: true,
                direction: "center",
                className: "barangay-label",
                opacity: 0.9,
              }
            );

            // ======================================
            // HOVER + CLICK
            // ======================================

            layer.on({

              mouseover: (e: any) => {
                e.target.setStyle({
                  weight: 2,
                  color: "#1d4ed8",
                  fillOpacity: 0.4,
                });

                e.target.bringToFront();
              },

              mouseout: (e: any) => {
                barangayLayer.resetStyle(
                  e.target
                );
              },

              click: () => {
                console.log(
                  "Clicked barangay:",
                  barangayName
                );

                onBarangayClick?.(
                  barangayName
                );
              },

            });
          },

        }).addTo(map);

        // ==========================================
        // KEEP INITIAL VIEW
        // ==========================================

        map.setView(
          [14.393, 120.852],
          14
        );

      } catch (error) {
        console.error(
          "GeoJSON error:",
          error
        );
      }
    };

    loadMap();

    // ==========================================
    // CLEANUP
    // ==========================================

    return () => {
      if (map) {
        map.remove();
      }
    };

  }, [onBarangayClick]);

  // ==========================================
  // MAP CONTAINER
  // ==========================================

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "600px",
      }}
    />
  );
}