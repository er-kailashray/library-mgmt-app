import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";

// Web-only: the HTML shell around every page of the web build (the PWA iPhone users add to their
// home screen). Runs in Node during export, with no DOM. The server document context carries the
// app's scripts and styles; without headNodes/bodyNodes the page renders blank.
export default function Root({ children }: { children: React.ReactNode }) {
	const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

	return (
		<html lang="en" {...htmlAttributes}>
			<head>
				<meta charSet="utf-8" />
				<meta httpEquiv="X-UA-Compatible" content="IE=edge" />
				{/* viewport-fit=cover hands the notch/home-bar insets to safe-area-context; maximum-scale
				    stops iOS zooming in on every focused text field. */}
				<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
				<title>Librum</title>
				<meta name="description" content="Run your library: members, seats, batches, attendance and fees." />

				{/* Installable app: Android/desktop read the manifest, iOS reads the apple-* tags. */}
				<link rel="manifest" href="/manifest.webmanifest" />
				<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FDFCF9" />
				<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0C0A09" />
				<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-title" content="Librum" />
				<meta name="apple-mobile-web-app-status-bar-style" content="default" />
				<meta name="format-detection" content="telephone=no" />

				<ScrollViewStyleReset />
				<style dangerouslySetInnerHTML={{ __html: webStyles }} />
				{headNodes}
			</head>
			<body {...bodyAttributes}>
				{children}
				{bodyNodes}
			</body>
		</html>
	);
}

// Matches the app background so there's no white flash before the app paints, and keeps the page
// from rubber-banding or highlighting taps like a web page.
const webStyles = `
html, body { background-color: #FDFCF9; overscroll-behavior: none; }
@media (prefers-color-scheme: dark) { html, body { background-color: #0C0A09; } }
body { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; -webkit-text-size-adjust: 100%; }
input, textarea { -webkit-user-select: text; }
`;
