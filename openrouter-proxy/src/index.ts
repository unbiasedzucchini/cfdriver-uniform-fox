interface Env {
	OPENROUTER_API_KEY: string;
	DB: D1Database;
}

interface RequestBody {
	model: string;
	system_prompt?: string;
	prompt: string;
}

interface OpenRouterResponse {
	id?: string;
	provider?: string;
	model?: string;
	choices?: Array<{
		finish_reason?: string;
		message?: {
			content?: string;
		};
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
		cost?: number;
	};
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

			// Ensure responses table exists
			await env.DB.prepare(`CREATE TABLE IF NOT EXISTS responses (
				id TEXT PRIMARY KEY,
				request_id TEXT NOT NULL,
				response_id TEXT,
				provider TEXT,
				model TEXT,
				content TEXT,
				finish_reason TEXT,
				prompt_tokens INTEGER,
				completion_tokens INTEGER,
				total_tokens INTEGER,
				cost REAL,
				created_at TEXT DEFAULT (datetime('now')),
				raw_response TEXT
			)`).run();

			// Log request to D1
			const requestId = crypto.randomUUID();
			await env.DB.prepare(
				'INSERT INTO requests (id, model, system_prompt, prompt) VALUES (?, ?, ?, ?)'
			).bind(requestId, body.model, body.system_prompt || null, body.prompt).run();

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

			const result: OpenRouterResponse = await openrouterResponse.json();

			// Log response to D1
			const responseId = crypto.randomUUID();
			const choice = result.choices?.[0];
			await env.DB.prepare(
				`INSERT INTO responses (id, request_id, response_id, provider, model, content, finish_reason, prompt_tokens, completion_tokens, total_tokens, cost, raw_response)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(
				responseId,
				requestId,
				result.id || null,
				result.provider || null,
				result.model || null,
				choice?.message?.content || null,
				choice?.finish_reason || null,
				result.usage?.prompt_tokens || null,
				result.usage?.completion_tokens || null,
				result.usage?.total_tokens || null,
				result.usage?.cost || null,
				JSON.stringify(result)
			).run();

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
