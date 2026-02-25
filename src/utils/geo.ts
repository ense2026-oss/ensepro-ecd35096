import { useState, useEffect, useCallback } from "react";

// ===== Haversine Distance =====
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ===== Location type (mirrors LocationsSettings) =====
export interface OfficeLocation {
  id: number;
  name: string;
  lat: string;
  lng: string;
  radius: number;
  active: boolean;
}

// ===== Find nearest location =====
export interface NearestResult {
  location: OfficeLocation;
  distance: number; // meters
  withinRadius: boolean;
}

export function findNearestLocation(
  userLat: number,
  userLng: number,
  locations: OfficeLocation[]
): NearestResult | null {
  const activeLocations = locations.filter((l) => l.active);
  if (activeLocations.length === 0) return null;

  let nearest: NearestResult | null = null;

  for (const loc of activeLocations) {
    const distance = haversineDistance(
      userLat,
      userLng,
      parseFloat(loc.lat),
      parseFloat(loc.lng)
    );
    if (!nearest || distance < nearest.distance) {
      nearest = {
        location: loc,
        distance,
        withinRadius: distance <= loc.radius,
      };
    }
  }

  return nearest;
}

// ===== useGeolocation hook =====
export interface GeoState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({
    lat: null,
    lng: null,
    accuracy: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((s) => ({
        ...s,
        loading: false,
        error: "เบราว์เซอร์ไม่รองรับ Geolocation",
      }));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          loading: false,
          error: null,
        });
      },
      (err) => {
        setState((s) => ({
          ...s,
          loading: false,
          error:
            err.code === 1
              ? "กรุณาอนุญาตการเข้าถึงตำแหน่ง (Location Permission)"
              : "ไม่สามารถดึงตำแหน่งได้",
        }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return state;
}
