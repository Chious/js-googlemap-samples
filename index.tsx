/*
 * Copyright 2021 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from "react";
import { createRoot } from "react-dom/client";
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import { createCustomEqual } from "fast-equals";
import { isLatLngLiteral } from "@googlemaps/typescript-guards";

const render = (status: Status) => {
  return <h1>{status}</h1>;
};

const App: React.VFC = () => {
  const [clicks, setClicks] = React.useState<google.maps.LatLng[]>([]);
  const [zoom, setZoom] = React.useState(12); // initial zoom
  const [center, setCenter] = React.useState<google.maps.LatLngLiteral>({
    lat: 25.0464225,
    lng: 121.5148332,
  });

  const onClick = (e: google.maps.MapMouseEvent) => {
    // avoid directly mutating state
    setClicks([e.latLng!]);
  };

  const onIdle = (m: google.maps.Map) => {
    console.log("onIdle");
    setZoom(m.getZoom()!);
    setCenter(m.getCenter()!.toJSON());
  };

  const form = (
    <div
      style={{
        padding: "1rem",
        flexBasis: "250px",
        height: "100%",
        overflow: "auto",
      }}
    >
      <label htmlFor="zoom">Zoom</label>
      <input
        type="number"
        id="zoom"
        name="zoom"
        value={zoom}
        onChange={(event) => setZoom(Number(event.target.value))}
      />
      <br />
      <label htmlFor="lat">Latitude</label>
      <input
        type="number"
        id="lat"
        name="lat"
        value={center.lat}
        onChange={(event) =>
          setCenter({ ...center, lat: Number(event.target.value) })
        }
      />
      <br />
      <label htmlFor="lng">Longitude</label>
      <input
        type="number"
        id="lng"
        name="lng"
        value={center.lng}
        onChange={(event) =>
          setCenter({ ...center, lng: Number(event.target.value) })
        }
      />
      <h3>{clicks.length === 0 ? "Click on map to add markers" : "Clicks"}</h3>
      {clicks.map((latLng, i) => (
        <pre key={i}>{JSON.stringify(latLng.toJSON(), null, 2)}</pre>
      ))}
      <button onClick={() => setClicks([])}>Clear</button>
      <button>Direction</button>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Wrapper
        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY!}
        render={render}
      >
        <Map
          center={center}
          onClick={onClick}
          onIdle={onIdle}
          zoom={zoom}
          style={{ flexGrow: "1", height: "100%" }}
        >
          {clicks.map((latLng, i) => (
            <Marker key={i} position={latLng} />
          ))}
        </Map>
      </Wrapper>
      {/* Basic form for controlling center and zoom of map. */}
      {form}
    </div>
  );
};
interface MapProps extends google.maps.MapOptions {
  style: { [key: string]: string };
  onClick?: (e: google.maps.MapMouseEvent) => void;
  onIdle?: (map: google.maps.Map) => void;
  disableDefaultUI: boolean;
  children?: React.ReactNode;
}

const Map: React.FC<MapProps> = ({
  onClick,
  onIdle,
  children,
  style,
  disableDefaultUI = true,
  ...options
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [map, setMap] = React.useState<google.maps.Map>();

  //Routing Service
  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer();

  const calculateAndDisplayRoute = () => {
    const request: DirectionsRequest = {
      origin: { lat: 25.0464225, lng: 121.5148332 }, //Taipei Train Station
      destination: { lat: 24.9442716, lng: 121.3700608 }, //Tapiei University
      waypoints: [
        { location: { lat: 25.0421884, lng: 121.5057246 }, stopover: true }, // Ximen MRT Station
        { location: { lat: 25.0150934, lng: 121.4605249 }, stopover: true }, //Banqiao Station
      ],
      provideRouteAlternatives: false,
      optimizeWaypoints: true,
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.IMPERIAL,
    };

    directionsService.route(request, function (result, status) {
      if (status == "OK") {
        console.log("Direction Service:", result);

        directionsRenderer.setDirections(result);
      } else {
        console.log("something wrong: ", status);
      }
    });
  };

  React.useEffect(() => {
    if (map) {
      directionsRenderer.setMap(map);
      calculateAndDisplayRoute();
    }
  }, [map]);

  React.useEffect(() => {
    if (ref.current && !map) {
      setMap(
        new window.google.maps.Map(ref.current, {
          disableDefaultUI: disableDefaultUI,
        })
      );
    }
  }, [ref, map]);

  // because React does not do deep comparisons, a custom hook is used
  // see discussion in https://github.com/googlemaps/js-samples/issues/946
  useDeepCompareEffectForMaps(() => {
    if (map) {
      map.setOptions(options);
    }
  }, [map, options]);

  React.useEffect(() => {
    if (map) {
      ["click", "idle"].forEach((eventName) =>
        google.maps.event.clearListeners(map, eventName)
      );

      if (onClick) {
        map.addListener("click", onClick);
      }

      if (onIdle) {
        map.addListener("idle", () => onIdle(map));
      }
    }
  }, [map, onClick, onIdle]);

  return (
    <>
      <div ref={ref} style={style} />
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // set the map prop on the child component
          // @ts-ignore
          return React.cloneElement(child, { map });
        }
      })}
    </>
  );
};

const Marker: React.FC<google.maps.MarkerOptions> = (options) => {
  const [marker, setMarker] = React.useState<google.maps.Marker>();

  React.useEffect(() => {
    if (!marker) {
      setMarker(new google.maps.Marker());
    }

    // remove marker from map on unmount
    return () => {
      if (marker) {
        marker.setMap(null);
      }
    };
  }, [marker]);

  React.useEffect(() => {
    if (marker) {
      marker.setOptions(options);
    }
  }, [marker, options]);

  return null;
};

const deepCompareEqualsForMaps = createCustomEqual(
  // @ts-ignore
  (deepEqual) => (a: any, b: any) => {
    if (
      isLatLngLiteral(a) ||
      a instanceof google.maps.LatLng ||
      isLatLngLiteral(b) ||
      b instanceof google.maps.LatLng
    ) {
      return new google.maps.LatLng(a).equals(new google.maps.LatLng(b));
    }

    // TODO extend to other types

    // use fast-equals for other objects
    return deepEqual(a, b);
  }
);

function useDeepCompareMemoize(value: any) {
  const ref = React.useRef();

  if (!deepCompareEqualsForMaps(value, ref.current)) {
    ref.current = value;
  }

  return ref.current;
}

function useDeepCompareEffectForMaps(
  callback: React.EffectCallback,
  dependencies: any[]
) {
  React.useEffect(callback, dependencies.map(useDeepCompareMemoize));
}

window.addEventListener("DOMContentLoaded", () => {
  const root = createRoot(document.getElementById("root")!);
  root.render(<App />);
});

//Google Routing service

type DirectionsRequest = {
  origin: { lat: number; lng: number } | string | google.maps.Place;
  destination:
    | { lat: number; lng: number }
    | string
    | google.maps.Place
    | google.maps.LatLng;
  travelMode: google.maps.TravelMode;
  transitOptions?: {
    arrivalTime?: Date;
    departureTime?: Date;
    modes?: google.maps.TransitMode[];
    routingPreference?: google.maps.TransitRoutePreference;
  };
  drivingOptions?: {
    departureTime: Date;
    trafficModel: google.maps.TrafficModel;
  };
  unitSystem?: google.maps.UnitSystem.METRIC | google.maps.UnitSystem.IMPERIAL;
  waypoints?: { location: { lat: number; lng: number }; stopover: boolean }[];
  optimizeWaypoints?: boolean;
  provideRouteAlternatives?: boolean;
  avoidFerries?: boolean;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
  region?: string;
};

/*
const example: DirectionsRequest = {
  origin: "台北車站",
  destination: "桃園機場",
  waypoints: [
    {
      location: "板橋車站",
      stopover: false,
    },
    {
      location: "臺北大學",
      stopover: true,
    },
  ],
  provideRouteAlternatives: false,
  travelMode: google.maps.TravelMode.DRIVING,
  drivingOptions: {
    departureTime: new Date(),
    trafficModel: google.maps.TrafficModel.PESSIMISTIC,
  },
  unitSystem: google.maps.UnitSystem.IMPERIAL,
};
*/

export {};
