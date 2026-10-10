# Local build consistency — 2026-10-09
A browser test hit ChunkLoadError while a second production build replaced .next files under the running local server. No application or stored data error was involved.
Resolution: let the build finish, verify both listening processes belong to this app, restart them, then reload the browser. Future verification must happen after build and restart, never while .next is being replaced.
