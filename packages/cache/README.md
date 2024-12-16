# Cache

```typescript
import { Cache } from './src';
import { MemoryStorage } from './src/storage/memory';

const storage = new MemoryStorage();
const cache = new Cache({ storage });

const cached = cache.cached('value', () => fetch('http://www.randomnumberapi.com/api/v1.0/random?count=5').then(r => r.json()))

console.log(await cached())
console.log(await cached())
console.log(await cached())
// same output three times

cache.invalidate('value')

console.log(await cached())
console.log(await cached())
// another output two times
```
