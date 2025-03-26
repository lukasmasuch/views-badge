// Example using JavaScript for Cloudflare Workers

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// Extract key from path instead of query parameter
		const pathParts = url.pathname.split('/');

		// Check the base path (first part after /)
		const basePath = pathParts[1];

		// Handle stats-batch specially since it doesn't require a key in the path
		if (basePath === 'stats-batch') {
			// Extract keys from query parameter
			const keysString = url.searchParams.get('keys');
			if (!keysString) {
				return new Response('Missing keys query parameter. Use ?keys=key1,key2,key3', { status: 400 });
			}

			const keys = keysString.split(',').map((k) => k.trim());
			const results = {};

			// Fetch all views in parallel
			const promises = keys.map(async (key) => {
				const kvKey = `visits:${key}`;
				const views = parseInt((await env.VISITS_BADGE_COUNTS.get(kvKey)) || '0');
				results[key] = { views };
			});

			await Promise.all(promises);

			return new Response(JSON.stringify(results), {
				headers: { 'Content-Type': 'application/json' },
				status: 200,
			});
		}

		// For all other endpoints, require a key in the path
		const key = pathParts[2]; // /badge/key or /badgen/key or /stats/key

		if (!key) {
			return new Response('Missing key in path', { status: 400 });
		}

		// Sanitize/normalize the URL key if necessary
		const kvKey = `visits:${key}`;

		if (basePath === 'badge') {
			// Increment and get count (KV operations are generally atomic for single keys)
			let currentVisits = parseInt((await env.VISITS_BADGE_COUNTS.get(kvKey)) || '0');
			const newVisits = currentVisits + 1;
			ctx.waitUntil(env.VISITS_BADGE_COUNTS.put(kvKey, newVisits.toString())); // Non-blocking write

			const label = 'views';
			const views = newVisits.toString();

			// Fixed width for "views" label section
			const leftWidth = 390; // Fixed width for "views" label

			// Increase space for digits - use more width per digit
			const digitWidth = 80; // Increased from 60
			const rightPadding = 60; // Increased padding
			const rightWidth = Math.max(150, views.length * digitWidth + rightPadding); // Increased minimum width

			const totalWidth = leftWidth + rightWidth;

			const badgeSvg = `
			<svg xmlns="http://www.w3.org/2000/svg" width="${
				totalWidth / 10
			}" height="20" viewBox="0 0 ${totalWidth} 200" role="img" aria-label="${label}: ${views}">
				<title>${label}: ${views}</title>
				<g>
					<rect fill="#555" width="${leftWidth}" height="200"/>
					<rect fill="#08C" x="${leftWidth}" width="${rightWidth}" height="200"/>
				</g>
				<g aria-hidden="true" fill="#fff" text-anchor="start" font-family="Verdana,DejaVu Sans,sans-serif" font-size="110">
					<text x="60" y="148" textLength="290" fill="#000" opacity="0.1">${label}</text>
					<text x="50" y="138" textLength="290">${label}</text>
					<text x="${leftWidth + 40}" y="148" textLength="${views.length * digitWidth - 10}" fill="#000" opacity="0.1">${views}</text>
					<text x="${leftWidth + 30}" y="138" textLength="${views.length * digitWidth - 10}">${views}</text>
				</g>
			</svg>`;

			const response = new Response(badgeSvg.trim(), {
				headers: {
					'Content-Type': 'image/svg+xml',
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache',
					Expires: '0',
				},
				status: 200,
			});
			return response;
		} else if (basePath === 'badgen') {
			// Supports https://badgen.net/https:
			let currentVisits = parseInt((await env.VISITS_BADGE_COUNTS.get(kvKey)) || '0');
			const newVisits = currentVisits + 1;
			ctx.waitUntil(env.VISITS_BADGE_COUNTS.put(kvKey, newVisits.toString())); // Non-blocking write

			const label = 'views';
			const message = newVisits.toString();

			const responseContent = {
				subject: label,
				status: message,
				color: 'blue',
			};
			return new Response(JSON.stringify(responseContent), {
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache',
					Expires: '0',
				},
				status: 200,
			});
		} else if (basePath === 'shields') {
			// https://shields.io/badges/dynamic-json-badge
			// https://shields.io/badges/endpoint-badge
			let currentVisits = parseInt((await env.VISITS_BADGE_COUNTS.get(kvKey)) || '0');
			const newVisits = currentVisits + 1;
			ctx.waitUntil(env.VISITS_BADGE_COUNTS.put(kvKey, newVisits.toString())); // Non-blocking write

			const label = 'views';
			const message = newVisits.toString();

			const responseContent = {
				schemaVersion: 1,
				label: label,
				message: message,
				color: 'blue',
				style: 'flat-square',
				cacheSeconds: 0,
			};
			return new Response(JSON.stringify(responseContent), {
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache',
					Expires: '0',
				},
				status: 200,
			});
		} else if (basePath === 'stats') {
			// Get count without incrementing
			const views = parseInt((await env.VISITS_BADGE_COUNTS.get(kvKey)) || '0');
			const data = { views: views };

			return new Response(JSON.stringify(data), {
				headers: { 'Content-Type': 'application/json' },
				status: 200,
			});
		}

		return new Response('Not Found', { status: 404 });
	},
};
