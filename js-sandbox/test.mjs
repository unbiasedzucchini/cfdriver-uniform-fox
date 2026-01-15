import { getQuickJS } from 'quickjs-emscripten';

const QuickJS = await getQuickJS();
const vm = QuickJS.newContext();

// Test basic computation
const result = vm.evalCode('[1,2,3].map(x => x * 2)');
if (result.error) {
  const error = vm.dump(result.error);
  result.error.dispose();
  console.error('Error:', error);
} else {
  const value = vm.dump(result.value);
  result.value.dispose();
  console.log('Result:', JSON.stringify(value));
}

vm.dispose();
