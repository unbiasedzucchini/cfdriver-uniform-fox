interface Env {
	OPENROUTER_API_KEY: string;
}

interface RequestBody {
	model: string;
	system_prompt?: string;
	prompt: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		if (request.method !== 'POST') {
			return new Response(JSON.stringify({ error: 'Method not allowed' }), {
				status: 405,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		try {
			const body: RequestBody = await request.json();

			if (!body.model || !body.prompt) {
				return new Response(
					JSON.stringify({ error: 'Missing required fields: model, prompt' }),
					{ status: 400, headers: { 'Content-Type': 'application/json' } }
				);
			}

			const messages: Array<{ role: string; content: string }> = [];

			if (body.system_prompt) {
				messages.push({ role: 'system', content: body.system_prompt });
			}
			messages.push({ role: 'user', content: body.prompt });

			const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: body.model,
					messages: messages,
				}),
			});

			const result = await openrouterResponse.json();

			return new Response(JSON.stringify(result), {
				status: openrouterResponse.status,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			return new Response(JSON.stringify({ error: message }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},
};
