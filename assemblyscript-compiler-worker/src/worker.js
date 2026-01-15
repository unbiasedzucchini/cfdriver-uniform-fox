import asc from "assemblyscript/asc";

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Only accept POST requests
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    try {
      const contentType = request.headers.get("content-type") || "";
      let sourceCode;
      let options = {};

      if (contentType.includes("application/json")) {
        // JSON body: { source: "...", options: { ... } }
        const body = await request.json();
        sourceCode = body.source;
        options = body.options || {};
      } else {
        // Plain text body: just the source code
        sourceCode = await request.text();
      }

      if (!sourceCode || typeof sourceCode !== "string") {
        return new Response(JSON.stringify({ error: "No source code provided" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Compile the AssemblyScript code
      const result = await asc.compileString(sourceCode, {
        optimizeLevel: options.optimizeLevel ?? 3,
        shrinkLevel: options.shrinkLevel ?? 0,
        debug: options.debug ?? false,
        noAssert: options.noAssert ?? true,
        runtime: options.runtime ?? "stub",
        exportRuntime: options.exportRuntime ?? false,
        ...options,
      });

      // Check for compilation errors
      if (result.error) {
        const errorMessages = [];
        if (result.stderr) {
          errorMessages.push(result.stderr.toString());
        }
        return new Response(JSON.stringify({
          error: "Compilation failed",
          details: errorMessages.join("\n") || result.error.message,
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      if (!result.binary) {
        return new Response(JSON.stringify({ error: "Compilation produced no output" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Check if client wants text format instead
      const accept = request.headers.get("accept") || "";
      if (accept.includes("text/plain") || accept.includes("text/wat")) {
        return new Response(result.text || "(no text output)", {
          headers: {
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Return the WebAssembly binary
      return new Response(result.binary, {
        headers: {
          "Content-Type": "application/wasm",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: "Internal compiler error",
        details: err.message,
        stack: err.stack,
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};
