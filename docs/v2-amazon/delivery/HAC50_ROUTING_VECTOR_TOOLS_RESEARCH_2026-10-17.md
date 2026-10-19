# Road geometry, routing and vector tools — research decision

Reviewed 2026-10-17. This is a provider/tool comparison, not a claim that additional providers are installed, licensed or integrated.

## What needs improving

Four different operations should stay separate:

1. **Road search:** choose a path through a road network, including the provider's known directions and restrictions.
2. **Vector geometry:** return that path as an ordered line (encoded polyline or GeoJSON LineString).
3. **Map matching:** estimate which roads a noisy GPS trace followed. It is useful after observing a trip; it is not a substitute for planning a new trip from two city centers.
4. **Rendering:** draw the returned geometry without dropping bends, appending city-center connectors or smoothing through buildings.

Inference for CargoMesh: a map screenshot traced into SVG would preserve pixels, not establish road connectivity, one-way rules, legal access or travel time. Increasing the number of interpolated points also cannot discover a road. Use calculated road geometry directly.

## Options and fit

| Tool / product | Actual documented function | CargoMesh use / limitation |
| --- | --- | --- |
| Google Routes | `computeRoutes` returns driving estimates, alternative routes and encoded polyline/GeoJSON. `HIGH_QUALITY` requests more detail than an overview. | Keep as the active provider; current adapter already validates decoded geometry. More detail can increase response size. [Reference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes). |
| Google Roads | Snap to Roads matches a sequence of observed coordinates to likely roads; interpolation can add points. | Possible future GPS cleanup; do not run it over a guessed line to manufacture a planned road. Requires its own enabled API/key scope and billing review; not enabled in this work. [Snap to Roads](https://developers.google.com/maps/documentation/roads/snap). |
| Waze Deep Links | Open Waze/web navigation with a destination or search. | Useful future driver handoff. The documented public link interface does not return a route polyline to our backend. Do not scrape private Waze endpoints. [Deep Links](https://developers.google.com/waze/deeplinks). |
| Waze Transport SDK / Navigation Connect | Transport SDK exchanges navigation/ETA data for approved partners. Google announces its support ends **2026-11-01** and points to Navigation Connect. | Do not start a dependency on the retiring SDK. Assess Navigation Connect separately if driver app switching becomes a requirement; no access or full geometry export is assumed here. [Official announcement](https://developers.google.com/waze/intro-transport), [Navigation Connect](https://developers.google.com/maps/documentation/navigation/connect). |
| Mapbox Directions + Map Matching | Directions returns route geometry, alternatives and navigation instructions. Map Matching aligns noisy GPS traces. | Possible provider alternative; needs separate access, regional data evaluation and display/licensing review. Matching does not establish all current road conditions. [Directions](https://docs.mapbox.com/api/navigation/directions/), [Matching](https://docs.mapbox.com/api/navigation/map-matching/). |
| OSRM | Open routing engine with Route, Table, Nearest and Match services; full route geometry can be returned. | Candidate for an independently hosted OSM road graph or routing benchmark. Requires data preparation, updates and operational hosting. A public demo server is not a production SLA. [API](https://project-osrm.org/docs/v5.24.0/api/), [project](https://github.com/Project-OSRM/osrm-backend). |
| GraphHopper | Open routing engine using OSM, available as a Java library/server, with configurable routing models. | Candidate when custom road costs/profile rules justify maintaining a graph. It is a new adapter, not a visual vectorization pass over Google output. [Project](https://github.com/graphhopper/graphhopper), [open-source overview](https://www.graphhopper.com/open-source/). |
| Valhalla | Routing with dynamic costing; truck options include dimensions, weight and access restrictions; shortest-distance and hierarchy controls exist. | A strong research candidate for truck-aware routing. Outcomes still depend on available road tags and configuration; no automatic proof of legal clearance. [API and truck options](https://github.com/valhalla/valhalla/blob/master/docs/docs/api/route/api-reference.md). |
| openrouteservice | Open route planner with APIs and heavy-vehicle routing support. | Another truck-profile candidate, subject to hosted limits or self-hosting/data costs. No comparison requests were made in this work. [Project](https://github.com/GIScience/openrouteservice). |
| QGIS | Inspect/edit vector layers and run shortest/fastest path analysis over a supplied network, including direction fields and snapping tolerances. | Useful desktop QA for an independently licensed road dataset and coverage layers. It does not supply Google's private routing graph or validate permits. [Network analysis](https://docs.qgis.org/3.44/en/docs/user_manual/processing_algs/qgis/networkanalysis.html). |
| OSMnx | Download/model OSM street graphs and analyze routes with graph tooling. | Useful Python research/benchmark pipeline over an explicit regional dataset. Dataset freshness, rules, graph bounds and licensing must be stated. [User reference](https://osmnx.readthedocs.io/en/stable/user-reference.html). |

## Search algorithms and honest optimality

- **Current implementation:** Google searches its network; CargoMesh evaluates all complete accepted returned candidates. `FASTEST` minimizes `(duration, distance, providerIndex)` and `SHORTEST_RETURNED` minimizes `(distance, duration, providerIndex)`. This is deterministic over that set. It is not Dijkstra/A* over Google's inaccessible graph and does not prove a global optimum.
- **If we own an OSM graph later:** an exact shortest-path claim needs an explicit graph, directed edges, nonnegative costs and documented restrictions. Dijkstra can minimize the chosen nonnegative cost; A* needs an admissible heuristic for the same guarantee. A graph optimum remains limited by the supplied graph and data quality.
- **Commercial lanes are separate:** A→B plus B→C is not a direct A→C service. A multi-leg commercial planner also needs transfers, resource/temporal compatibility and responsibility evidence. A Google road connecting the endpoints cannot create missing Carrier coverage.
- **Fleet assignment is separate:** neither a driving polyline nor a road shortest path solves vehicle/driver scheduling or produces a Carrier offer.

## Practical recommendation

1. Keep Google Routes for this increment; no new provider credentials or infrastructure are necessary.
2. Keep high-quality returned coordinates unchanged through server and front. Adjust display styling/zoom independently of road geometry.
3. Prefer actual facility access/entrance coordinates when the authorized Client resolver is integrated. Current city references are explicitly city-level samples; the server cannot confirm exact building access or unknown postal restrictions from them.
4. Keep `truckAccess: UNVERIFIED`. General DRIVE estimates do not establish truck clearance, border authorization or Carrier availability. Evaluate a truck-specific provider only when those requirements and data are ready.
5. Introduce GPS map matching later, preserving raw observation timestamps/accuracy separately from matched or estimated positions.
6. If a visible road mismatch remains, diagnose endpoint snapping, coordinate precision, route source, simplification and renderer configuration. Do not fix it by painting a plausible line.

## Provider content and visualization

Google's Routes policy requires results displayed on a map to use a Google Map, restricts caching of most content, and defines attribution requirements. Keep the existing Google route display path. Do not permanently seed Google polylines into Supabase, export them into an independently hosted road graph or assume that arbitrary standalone Three.js terrain is an authorized map surface. A future provider/rendering change needs its own policy review. [Routes policies](https://developers.google.com/maps/documentation/routes/policies).

This research did not install tools, subscribe to a provider, enable Roads API, register a Waze partnership or change any existing Google key restrictions. The current live validation uses Google Routes only.
