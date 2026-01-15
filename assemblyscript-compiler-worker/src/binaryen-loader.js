// This module patches binaryen to use a statically imported wasm module
// instead of dynamically instantiating from embedded base64

import binaryenWasm from "../binaryen.wasm";

// Store the pre-instantiated module for binaryen to use
globalThis.__binaryen_wasm_module = binaryenWasm;

export { binaryenWasm };
