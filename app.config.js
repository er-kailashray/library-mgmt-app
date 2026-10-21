// Extends app.json so the Google Maps key can come from the environment instead of being committed.
module.exports = ({ config }) => ({
	...config,
	plugins: [
		...config.plugins,
		[
			"react-native-maps",
			{
				androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
			},
		],
	],
});
