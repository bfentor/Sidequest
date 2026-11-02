import type { LatLng } from '@sidequest/api';

export type LocationPinProps = {
  /** Where the pin is, if anywhere. */
  value: LatLng | null;
  /** Where the map looks; it moves only when this changes, not when the pin does. */
  center: LatLng | null;
  onChange: (location: LatLng) => void;
};

// All of Finland, for placing a pin from scratch.
const OVERVIEW = { lat: 64.5, lng: 26, zoom: 5 };

/** Close enough to see streets around `center`, or the overview without one. */
export function cameraFor(center: LatLng | null) {
  return center ? { ...center, zoom: 15 } : OVERVIEW;
}
