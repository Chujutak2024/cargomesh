# Alexa+ example requests for CargoMesh MCP

These are example English requests an assistant could turn into `create_freight_request` tool arguments. They are **not** classic Alexa skill slots, and no Alexa+ connection is implemented. The assistant must obtain every required field from the user or ask follow-up questions; it must not invent a route, dimensions, dates, weight or budget. It generates a UUID once per intended request and retains the same key and fields on retries.

Example matching [the sample tool arguments](alexa-sample-request-payload.json):

> Create a draft road freight request for two pallets of machinery from Callao, Peru to Santiago, Chile. Each pallet weighs 800 kilograms and measures 120 by 100 by 150 centimeters. Pick them up between October 15 and 16, 2026, at 12:00 UTC, and deliver by October 19 at 12:00 UTC. I have no budget cap or documents to list yet.

Other supported phrasing:

> Prepare a draft full-truckload road request for three pallets of machinery from Callao to Santiago. Each pallet weighs 500 kilograms and measures 120 by 100 by 140 centimeters. Arrange pickup between October 20 and 21, 2026, at 12:00 UTC. There is no delivery deadline or budget cap, and I have no documents to list.

> Create a draft for one pallet of machinery from Callao, Peru to Santiago, Chile. It weighs 700 kilograms and measures 100 by 100 by 120 centimeters. Pickup is scheduled from October 22 at 12:00 UTC to October 23 at 12:00 UTC. Deliver by October 26 at 12:00 UTC, with a maximum budget of 2,000. I have no documents to list.

`create_freight_request` only saves a DRAFT using the current ROAD/FTL/BALANCED, PALLETS/SCHEDULED contract. It does not submit, search, approve, or book freight. The current MCP endpoint is a loopback-only local preview that uses a CargoMesh cookie session; these examples do not imply a usable remote Alexa+ integration.
