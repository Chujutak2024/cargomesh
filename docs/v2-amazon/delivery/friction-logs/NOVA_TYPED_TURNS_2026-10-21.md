# Typed turns lost audio when Nova was enabled

Observed by Axel on 21 October 2026. Impact: written questions only received text and the panel repeated an implementation notice, breaking continuity with Nova voice. Cause: the text response reading effect returned whenever Nova was enabled, while the Nova gateway accepted PCM only after auth.

Correction: capability-negotiated bounded text turns over the same authenticated connection, shared transcript/draft capture, audio playback without microphone permission, and removal of the repeated notice. Native business operations retain their validation/consent; their device speech cannot echo into Nova capture. The gateway packaging allowlist correction is included.

Evidence: targeted lifecycle tests cover written PCM playback, no microphone permission, old-gateway compatibility, no cutoff, mute, scope refresh and echo avoidance; Python covers frame validation and existing grant controls. Live typed Nova audio is pending an updated deployment and human acceptance. The previously deployed 64 KiB gateway solves auth size only and is not falsely credited with this new feature.
