import { multiply } from './src/math.js'; if (multiply(6, 7) !== 42) throw new Error('multiply failed'); console.log(JSON.stringify({criterion:'multiply',status:'PASS'}));
