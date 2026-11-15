"use client";

import { useEffect, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type {
  GeoJSON as LeafletGeoJSON,
  Layer,
  Map as LeafletMap,
  Path,
  PathOptions,
  Polygon,
  Popup as LeafletPopup,
} from "leaflet";
import {
  getBarangayReports,
  getBarangayStatus,
  getStatusSummary,
  type Report,
  type Status,
} from "../data/mock-data";
import { useIncidents } from "../data/use-incidents";

type MapProps = {
  onBarangayClick?: (barangayName: string) => void;
  onPopupClose?: () => void;
  focusBarangay?: string | null;
  selectedBarangay?: string | null;
  visibleBarangays?: string[];
};

type BarangayProperties = Record<string, unknown>;
type BarangayFeature = Feature<Geometry, BarangayProperties>;

type FeatureLayerEntry = {
  name: string;
  layer: Layer;
};

type FocusableMapElement = Element & { focus: () => void };

const statusColor: Record<Status, string> = {
  Active: "#ef4444",
  Monitoring: "#facc15",
  Normal: "#22c55e",
};

// Same status colors as the admin Submissions page (red / amber / emerald).
const popupTone: Record<
  Status,
  { border: string; bg: string; text: string; dot: string }
> = {
  Active: {
    border: "#fecaca",
    bg: "#fef2f2",
    text: "#991b1b",
    dot: "#dc2626",
  },
  Monitoring: {
    border: "#fde68a",
    bg: "#fffbeb",
    text: "#92400e",
    dot: "#f59e0b",
  },
  Normal: {
    border: "#a7f3d0",
    bg: "#ecfdf5",
    text: "#065f46",
    dot: "#059669",
  },
};

// Popup styling, matching the Submissions modal: gradient header, white
// body, square corners, #4438A8 border. Injected from the component so no
// other CSS file needs to change. Uses new "bm-" class names so it will not
// clash with the old .barangay-popup-* rules (you can delete those).
const POPUP_CSS = `
.leaflet-tooltip.barangay-label {
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  color: #0f172a;
  text-shadow:
    -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff,
    0 0 3px #fff;
  pointer-events: none;
}
.leaflet-tooltip.barangay-label::before {
  display: none !important;
}
.leaflet-popup.barangay-map-popup .leaflet-popup-content-wrapper {
  padding: 0 !important;
  border-radius: 0 !important;
  border: 1px solid #4438A8 !important;
  background: #ffffff !important;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25) !important;
  font-family: inherit;
  overflow: hidden;
}
.leaflet-popup.barangay-map-popup .leaflet-popup-content {
  margin: 0 !important;
  line-height: 1.4 !important;
  font-size: 14px !important;
}
.leaflet-popup.barangay-map-popup .leaflet-popup-content p {
  margin: 0 !important;
}
.leaflet-popup.barangay-map-popup .leaflet-popup-tip {
  background: #ffffff !important;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2) !important;
}

.bm-popup {
  display: block;
  color: #0f172a;
  background: #ffffff;
}
.bm-popup-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(to right, #241C70, #342992, #5366C8);
  border-bottom: 1px solid #4438A8;
}
.bm-popup-eyebrow {
  margin: 0 !important;
  font-size: 12px;
  font-weight: 700;
  color: #e0e7ff;
}
.bm-popup-title {
  margin: 2px 0 0 !important;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
  color: #ffffff;
}
.bm-popup .bm-popup-close {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: -4px -6px 0 0;
  padding: 0;
  border: 0;
  border-radius: 6px !important;
  background: transparent;
  color: #e0e7ff;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.bm-popup .bm-popup-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}
.bm-popup .bm-popup-close:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.6);
  outline-offset: 1px;
}
.bm-popup-body {
  display: grid;
  gap: 14px;
  padding: 16px;
}
.bm-popup-label {
  margin: 0 0 6px !important;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}
.bm-popup-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 112px;
  padding: 6px 12px;
  border: 1px solid;
  font-size: 13px;
  font-weight: 600;
}
.bm-popup-dot {
  display: inline-block;
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
}
.bm-popup-summary {
  font-size: 14px;
  line-height: 1.6;
  color: #334155;
}
.bm-popup-section {
  padding-top: 14px;
  border-top: 1px solid #e2e8f0;
}
.bm-popup-list {
  display: grid;
  gap: 8px;
  max-height: 132px;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}
.bm-popup-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}
.bm-popup-item .bm-popup-dot {
  margin-top: 5px;
}
.bm-popup-item-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: #0f172a;
}
.bm-popup-item-detail {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}

/* Mobile: a more compact popup so it fits inside the shorter map. */
@media (max-width: 639px) {
  .bm-popup-header { padding: 10px 12px; }
  .bm-popup-title { font-size: 16px; }
  .bm-popup-body { gap: 10px; padding: 12px; }
  .bm-popup-summary { font-size: 13px; line-height: 1.45; }
  .bm-popup-section { padding-top: 10px; }
  .bm-popup-list { max-height: 84px; }
  .bm-popup-item { padding: 8px 10px; }
}
`;

const normalizeName = (value: string) =>
  value.replace(/^brgy\.?\s*/i, "").trim().toLocaleLowerCase();

function getBarangayName(feature: BarangayFeature) {
  const properties = feature.properties ?? {};
  const name =
    properties.brgy_name ??
    properties.barangay ??
    properties.Barangay ??
    properties.name ??
    properties.NAME ??
    properties.BRGY_NAME;

  return typeof name === "string" && name.trim() ? name.trim() : "Barangay";
}

function getFeatureStyle(
  feature: BarangayFeature | undefined,
  visibleBarangays: string[] | undefined,
): PathOptions {
  const name = feature ? getBarangayName(feature) : "";
  const status = getBarangayStatus(name);
  const isMatch = visibleBarangays?.some(
    (item) => normalizeName(item) === normalizeName(name),
  );

  return {
    color: visibleBarangays && isMatch ? "#1d4ed8" : "#475569",
    weight: visibleBarangays && isMatch ? 1.8 : 1,
    fillColor: statusColor[status],
    fillOpacity: status === "Normal" ? 0.18 : 0.32,
    opacity: 0.85,
  };
}

function createPopupContent(
  barangayName: string,
  status: Status,
  incidents: Report[],
  onClose: () => void,
) {
  const tone = popupTone[status];

  const content = document.createElement("div");
  content.className = "bm-popup";
  content.setAttribute("role", "group");
  content.setAttribute(
    "aria-label",
    `Service information for Brgy. ${barangayName}`,
  );

  // HEADER (gradient, same as the Submissions modal)
  const header = document.createElement("div");
  header.className = "bm-popup-header";

  const heading = document.createElement("div");

  const eyebrow = document.createElement("p");
  eyebrow.className = "bm-popup-eyebrow";
  eyebrow.textContent = "Service status";

  const title = document.createElement("h2");
  title.className = "bm-popup-title";
  title.textContent = `Brgy. ${barangayName}`;

  heading.append(eyebrow, title);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "bm-popup-close";
  closeButton.setAttribute("aria-label", "Close barangay card");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);

  header.append(heading, closeButton);
  content.appendChild(header);

  // BODY
  const body = document.createElement("div");
  body.className = "bm-popup-body";

  const statusBlock = document.createElement("div");

  const statusLabel = document.createElement("p");
  statusLabel.className = "bm-popup-label";
  statusLabel.textContent = "Status";

  const pill = document.createElement("span");
  pill.className = "bm-popup-pill";
  pill.style.cssText = `border-color:${tone.border};background:${tone.bg};color:${tone.text};`;

  const pillDot = document.createElement("span");
  pillDot.className = "bm-popup-dot";
  pillDot.style.background = tone.dot;
  pillDot.setAttribute("aria-hidden", "true");

  pill.append(pillDot, document.createTextNode(status));
  statusBlock.append(statusLabel, pill);
  body.appendChild(statusBlock);

  const summary = document.createElement("p");
  summary.className = "bm-popup-summary";
  summary.textContent = getStatusSummary(status);
  body.appendChild(summary);

  if (incidents.length > 0) {
    const section = document.createElement("div");
    section.className = "bm-popup-section";

    const listLabel = document.createElement("p");
    listLabel.className = "bm-popup-label";
    listLabel.textContent =
      incidents.length === 1 ? "Report" : `Reports (${incidents.length})`;

    const list = document.createElement("ul");
    list.className = "bm-popup-list";

    incidents.forEach((incident) => {
      const item = document.createElement("li");
      item.className = "bm-popup-item";

      const dot = document.createElement("span");
      dot.className = "bm-popup-dot";
      dot.style.background = popupTone[incident.status].dot;
      dot.setAttribute("aria-hidden", "true");

      const text = document.createElement("span");

      const name = document.createElement("span");
      name.className = "bm-popup-item-title";
      name.textContent = incident.title;

      const detail = document.createElement("span");
      detail.className = "bm-popup-item-detail";
      detail.textContent = `${incident.status} · ${
        incident.progress === 2
          ? "Responding"
          : incident.progress === 3
            ? "Resolved"
            : "Reported"
      }`;

      text.append(name, detail);
      item.append(dot, text);
      list.appendChild(item);
    });

    section.append(listLabel, list);
    body.appendChild(section);
  }

  content.appendChild(body);

  return content;
}

export default function BarangayMap({
  onBarangayClick,
  onPopupClose,
  focusBarangay,
  selectedBarangay,
  visibleBarangays,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const popupRef = useRef<LeafletPopup | null>(null);
  const layerRef = useRef<LeafletGeoJSON | null>(null);
  const featureLayersRef = useRef(new Map<string, FeatureLayerEntry>());
  const visibleBarangaysRef = useRef(visibleBarangays);
  const clickHandlerRef = useRef(onBarangayClick);
  const closeHandlerRef = useRef(onPopupClose);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const popupAnnouncementRef = useRef<HTMLSpanElement | null>(null);
  // Re-renders this component whenever the live incident data changes.
  const { reports } = useIncidents();

  useEffect(() => {
    visibleBarangaysRef.current = visibleBarangays;
    clickHandlerRef.current = onBarangayClick;
    closeHandlerRef.current = onPopupClose;
  }, [onBarangayClick, onPopupClose, visibleBarangays]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const featureLayers = featureLayersRef.current;

    let cancelled = false;
    let map: LeafletMap | null = null;
    let leaflet: typeof import("leaflet") | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame = 0;
    let tanzaBounds: ReturnType<LeafletGeoJSON["getBounds"]> | null = null;
    const fitPadding: [number, number] = [20, 20];

    const updateMinimumZoom = () => {
      if (
        !map ||
        !leaflet ||
        !tanzaBounds ||
        map.getSize().x <= 0 ||
        map.getSize().y <= 0
      ) {
        return;
      }

      const fitZoom = map.getBoundsZoom(
        tanzaBounds,
        false,
        leaflet.point(fitPadding[0], fitPadding[1]),
      );
      // How far past "Tanza fills the map" the user can zoom out.
      // 0 = not at all. Try 0.5 or 1 if you want more room.
      const EXTRA_ZOOM_OUT = 0;
      const minimumZoom = Math.max(0, fitZoom - EXTRA_ZOOM_OUT);
      map.setMinZoom(minimumZoom);

      const centerPoint = map.project(tanzaBounds.getCenter(), minimumZoom);
      const halfSize = map.getSize().divideBy(2);
      const minimumViewBounds = leaflet.latLngBounds(
        map.unproject(centerPoint.subtract(halfSize), minimumZoom),
        map.unproject(centerPoint.add(halfSize), minimumZoom),
      );
      // Extra room around the view so popups near the edge can still pan in.
      map.setMaxBounds(minimumViewBounds.pad(0.35));
    };

    // Hides barangay labels that would overlap a bigger barangay's label,
    // so names never stack on top of each other. Re-runs on zoom/pan/resize.
    let labelFrame = 0;
    const updateLabels = () => {
      cancelAnimationFrame(labelFrame);
      labelFrame = requestAnimationFrame(() => {
        const items = [...featureLayers.values()]
          .map(({ layer }) => {
            const element = layer.getTooltip()?.getElement();
            const bounds =
              "getBounds" in layer ? (layer as Polygon).getBounds() : null;
            const area = bounds
              ? (bounds.getNorth() - bounds.getSouth()) *
                (bounds.getEast() - bounds.getWest())
              : 0;
            return { element, area };
          })
          .filter(
            (item): item is { element: HTMLElement; area: number } =>
              Boolean(item.element),
          )
          .sort((a, b) => b.area - a.area);

        const placed: DOMRect[] = [];

        items.forEach(({ element }) => {
          element.style.visibility = "visible";
          const rect = element.getBoundingClientRect();

          const overlaps = placed.some(
            (other) =>
              rect.left < other.right + 4 &&
              rect.right + 4 > other.left &&
              rect.top < other.bottom + 2 &&
              rect.bottom + 2 > other.top,
          );

          if (overlaps) {
            element.style.visibility = "hidden";
          } else {
            placed.push(rect);
          }
        });
      });
    };

    const invalidateSize = () => {
      if (!map) return;

      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        map?.invalidateSize({ animate: false });
        updateMinimumZoom();
        updateLabels();
      });
    };

    const loadMap = async () => {
      try {
        const L = await import("leaflet");

        if (cancelled || !containerRef.current) return;

        leaflet = L;
        leafletRef.current = L;

        map = L.map(containerRef.current, {
          center: [14.393, 120.852],
          zoom: 14,
          minZoom: 0,
          maxZoom: 18,
          zoomSnap: 0.25,
          zoomControl: false,
          scrollWheelZoom: true,
          maxBoundsViscosity: 1,
        });

        mapRef.current = map;

        L.control.zoom({ position: "topleft" }).addTo(map);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        const response = await fetch("/data/tanza-barangays.geojson");

        if (!response.ok) {
          throw new Error("Barangay boundaries could not be loaded.");
        }

        const data =
          (await response.json()) as FeatureCollection<
            Geometry,
            BarangayProperties
          >;

        if (cancelled) return;

        const layer = L.geoJSON(data, {
          style: (feature) =>
            getFeatureStyle(
              feature as BarangayFeature,
              visibleBarangaysRef.current,
            ),

          onEachFeature: (feature, featureLayer) => {
            const name = getBarangayName(feature as BarangayFeature);
            const status = getBarangayStatus(name);

            featureLayersRef.current.set(normalizeName(name), {
              name,
              layer: featureLayer,
            });

            featureLayer.bindTooltip(name, {
              permanent: true,
              direction: "center",
              className: "barangay-label",
              opacity: 0.95,
            });

            featureLayer.on("add", () => {
              const pathElement = (featureLayer as Path).getElement() as
                | FocusableMapElement
                | undefined;
              if (!pathElement) return;

              pathElement.setAttribute("tabindex", "0");
              pathElement.setAttribute("role", "button");
              pathElement.setAttribute(
                "aria-label",
                `Brgy. ${name}. ${status}. ${getStatusSummary(status)} Activate to view service status.`,
              );

              const handleKeyDown: EventListener = (event) => {
                const keyboardEvent = event as KeyboardEvent;
                if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ")
                  return;
                keyboardEvent.preventDefault();
                keyboardEvent.stopPropagation();
                clickHandlerRef.current?.(name);
              };

              pathElement.addEventListener("keydown", handleKeyDown);
              featureLayer.once("remove", () =>
                pathElement.removeEventListener("keydown", handleKeyDown),
              );
            });

            featureLayer.on({
              mouseover: (event) => {
                const path = event.target as Path;
                path.setStyle({
                  weight: 2,
                  color: "#1d4ed8",
                  fillOpacity: 0.48,
                });
                path.bringToFront();
              },

              mouseout: (event) =>
                layerRef.current?.resetStyle(event.target),

              click: () => clickHandlerRef.current?.(name),
            });
          },
        }).addTo(map);

        layerRef.current = layer;
        setMapReady(true);

        tanzaBounds = layer.getBounds();
        map.invalidateSize({ animate: false });
        updateMinimumZoom();
        // Start fitted to Tanza (not one zoom level further out).
        map.fitBounds(tanzaBounds, { padding: fitPadding, animate: false });
        map.on("zoomend moveend", updateLabels);
        updateLabels();

        resizeObserver = new ResizeObserver(invalidateSize);
        resizeObserver.observe(container);

        if (container.parentElement) {
          resizeObserver.observe(container.parentElement);
        }

        window.addEventListener("resize", invalidateSize);
        document.addEventListener("visibilitychange", invalidateSize);
        invalidateSize();
        window.setTimeout(invalidateSize, 180);
        setMapError(null);
      } catch (error) {
        if (!cancelled) {
          console.error("GeoJSON map error:", error);
          setMapError(
            "Map boundaries are unavailable right now. You can still review the incident list, or refresh the page to try again.",
          );
        }
      }
    };

    void loadMap();

    return () => {
      cancelled = true;
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(labelFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", invalidateSize);
      document.removeEventListener("visibilitychange", invalidateSize);
      featureLayers.clear();
      popupRef.current = null;
      layerRef.current = null;
      mapRef.current = null;
      leafletRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    layerRef.current?.setStyle((feature) => {
      const properties = (feature?.properties ?? {}) as BarangayProperties;

      return getFeatureStyle(
        { properties } as BarangayFeature,
        visibleBarangays,
      );
    });

    // Keep screen-reader labels in step with the latest status.
    featureLayersRef.current.forEach(({ name, layer }) => {
      const element = (layer as Path).getElement?.();
      if (!element) return;
      const status = getBarangayStatus(name);
      element.setAttribute(
        "aria-label",
        `Brgy. ${name}. ${status}. ${getStatusSummary(status)} Activate to view service status.`,
      );
    });
  }, [mapReady, visibleBarangays, reports]);

  useEffect(() => {
    if (!focusBarangay || !mapRef.current) return;

    const normalized = normalizeName(focusBarangay);
    const entry =
      featureLayersRef.current.get(normalized) ??
      [...featureLayersRef.current.values()].find(({ name }) =>
        normalizeName(name).startsWith(`${normalized} `),
      );

    if (!entry || !("getBounds" in entry.layer)) return;

    const bounds = (entry.layer as Polygon).getBounds();

    // The popup opens above the barangay, so leave room at the top of the
    // map for it. This pushes the barangay lower and keeps the popup in view.
    // On phones the map is shorter and the popup is compact, so the top
    // padding is based on the space left under the popup instead of a
    // percentage of the map height.
    const mapHeight = mapRef.current.getSize().y;
    const isMobile = window.innerWidth < 640;
    const topPadding = isMobile
      ? Math.max(120, Math.min(320, mapHeight - 140))
      : Math.min(360, Math.round(mapHeight * 0.6));

    mapRef.current.fitBounds(bounds, {
      paddingTopLeft: [48, topPadding],
      paddingBottomRight: [48, 48],
      maxZoom: 16,
      animate: true,
    });
  }, [focusBarangay, mapReady]);

  useEffect(() => {
    if (!selectedBarangay) {
      if (popupAnnouncementRef.current)
        popupAnnouncementRef.current.textContent = "";
      return;
    }

    const status = getBarangayStatus(selectedBarangay);

    if (popupAnnouncementRef.current) {
      popupAnnouncementRef.current.textContent = `Map card opened for Brgy. ${selectedBarangay}. ${status}. ${getStatusSummary(status)}`;
    }
  }, [selectedBarangay]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;

    if (!map || !L || !selectedBarangay) {
      if (map && popupRef.current) {
        map.closePopup(popupRef.current);
      }

      popupRef.current = null;
      return;
    }

    const normalized = normalizeName(selectedBarangay);
    const entry =
      featureLayersRef.current.get(normalized) ??
      [...featureLayersRef.current.values()].find(({ name }) =>
        normalizeName(name).startsWith(`${normalized} `),
      );

    if (!entry || !("getBounds" in entry.layer)) return;

    const popup = L.popup({
      className: "barangay-map-popup",
      minWidth: Math.min(260, window.innerWidth - 56),
      maxWidth: Math.min(320, window.innerWidth - 56),
      closeButton: false,
      autoPan: true,
      autoPanPadding: window.innerWidth < 640 ? [16, 16] : [48, 48],
      closeOnClick: false,
      offset: [0, -7],
    })
      .setLatLng((entry.layer as Polygon).getBounds().getCenter())
      .setContent(
        createPopupContent(
          entry.name,
          getBarangayStatus(entry.name),
          getBarangayReports(entry.name),
          () => {
            map.closePopup(popup);
            closeHandlerRef.current?.();
            window.requestAnimationFrame(() => {
              const pathElement = (entry.layer as Path).getElement() as
                | FocusableMapElement
                | undefined;
              pathElement?.focus();
            });
          },
        ),
      );

    popupRef.current = popup;
    popup.openOn(map);

    return () => {
      if (popupRef.current === popup) {
        map.closePopup(popup);
        popupRef.current = null;
      }
    };
  }, [mapReady, selectedBarangay, reports]);

  return (
    <>
      <style>{POPUP_CSS}</style>
      <div ref={containerRef} className="leaflet-map" />
      <span
        ref={popupAnnouncementRef}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      ></span>
      {!mapReady && !mapError && (
        <div className="map-loading" role="status" aria-live="polite">
          Loading Tanza barangay boundaries…
        </div>
      )}
      {mapError && (
        <div className="map-error" role="alert">
          {mapError}
        </div>
      )}
    </>
  );
}