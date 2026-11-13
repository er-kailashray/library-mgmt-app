// Service worker for the installed web app (PWA). It only makes the app open fast and survive a
// flaky connection; it never touches API calls, which go to the backend's own origin.
//
// - Pages: network first, so a new deploy shows up on the next open; the cached copy is used offline.
// - Bundles, fonts, images under /_expo/static, /assets and /icons: their names carry a content hash,
//   so a cached copy is always right - cache first.
//
// Bump VERSION to drop every cached file (e.g. after changing this worker's rules).
const VERSION = "v1";
const CACHE = `librum-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim()),
	);
});

/** Stores a good response, keeping the worker alive until it's written. */
function remember(event, request, response) {
	if (response.ok) {
		const copy = response.clone();
		event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
	}
	return response;
}

function isImmutable(url) {
	return url.pathname.startsWith("/_expo/static/") || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET") return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => remember(event, request, response))
				// Offline: this page if it was opened before, else the app shell (the router reads the URL).
				.catch(() => caches.match(request).then((hit) => hit || caches.match("/"))),
		);
		return;
	}

	if (isImmutable(url)) {
		event.respondWith(
			caches.match(request).then((hit) => hit || fetch(request).then((response) => remember(event, request, response))),
		);
	}
});
