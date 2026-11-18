import { z } from 'zod'

// Disable Zod v4 JIT `new Function("")` probe so strict CSP (without 'unsafe-eval') triggers 0 browser violations.
// Any module using Zod should import `z` from here so `jitless: true` is guaranteed before `z.object(...)` init.
z.config({ jitless: true })

export { z }
