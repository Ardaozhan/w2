import { slugify } from './src/slug.js'; if (slugify(' Hello, World! ') !== 'hello-world') throw new Error('slugify failed'); console.log(JSON.stringify({criterion:'slugify',status:'PASS'}));
