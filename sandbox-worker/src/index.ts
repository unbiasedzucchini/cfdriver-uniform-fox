/**
 * JS Sandbox Worker
 * Executes untrusted JavaScript in a QuickJS sandbox
 * No I/O to outside world - pure computation only
 */

import type { QuickJSWASMModule } from 'quickjs-emscripten';
import { newQuickJSWASMModule, RELEASE_SYNC as baseVariant, newVariant } from 'quickjs-emscripten';
import cloudflareWasmModule from './RELEASE_SYNC.wasm';

const cloudflareVariant = newVariant(baseVariant, {
  wasmModule: cloudflareWasmModule,
});

let QuickJS: QuickJSWASMModule | undefined;

interface RequestBody {
  code: string;
  timeout_ms?: number;
}

interface SandboxResult {
  result?: unknown;
  error?: string;
}

function runSandbox(code: string, timeoutMs: number = 1000): SandboxResult {
  if (!QuickJS) {
    return { error: 'QuickJS not initialized' };
  }

  const vm = QuickJS.newContext();
  
  // Set up interrupt handler for timeout
  const deadline = Date.now() + timeoutMs;
  let interrupted = false;
  vm.runtime.setInterruptHandler(() => {
    if (Date.now() > deadline) {
      interrupted = true;
      return true;
    }
    return false;
  });

  try {
    const result = vm.evalCode(code);
    
    if (interrupted) {
      if (result.error) result.error.dispose();
      if (result.value) result.value.dispose();
      return { error: 'Execution timeout' };
    }
    
    if (result.error) {
      const errorVal = vm.dump(result.error);
      result.error.dispose();
      // Handle error object
      if (typeof errorVal === 'object' && errorVal !== null) {
        const err = errorVal as Record<string, unknown>;
        return { error: err.message ? String(err.message) : JSON.stringify(errorVal) };
      }
      return { error: String(errorVal) };
    }
    
    const value = vm.dump(result.value);
    result.value.dispose();
    return { result: value };
  } catch (e) {
    if (interrupted) {
      return { error: 'Execution timeout' };
    }
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    vm.dispose();
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    // Initialize QuickJS if needed
    QuickJS ??= await newQuickJSWASMModule(cloudflareVariant);

    // CORS preflight
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
      
      if (!body.code) {
        return new Response(
          JSON.stringify({ error: 'Missing required field: code' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Cap timeout at 5 seconds to avoid Worker timeout
      const timeout = Math.min(body.timeout_ms ?? 1000, 5000);
      const result = runSandbox(body.code, timeout);
      
      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
