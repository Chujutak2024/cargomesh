# CargoMesh voice gateway

The active Web gateway connects authenticated browser audio/text to Bedrock Nova through Strands. See [voice setup, protocol and deployment](../../docs/VOICE.md), [configuration](../../docs/CONFIGURATION.md) and [tests](../../docs/TESTING.md).

`Dockerfile.gateway` / `requirements-gateway.txt` package the deployed bridge. `strands_gemini_live.py` and `strands_nova_sonic.py` are standalone comparison pilots; they are not the application gateway or an Alexa+ integration. The gateway has no business mutation tools.
