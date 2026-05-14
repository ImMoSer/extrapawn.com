/* eslint-disable */
/* @ts-self-types="./engine_rs.d.ts" */

/**
 * Analyze one move from a starting FEN.
 *
 * Returns a JSON object describing every motif that fires, suitable for
 * JS-side composition. On any parsing error returns `{ error: "..." }`.
 * @param {string} fen_before
 * @param {string} uci
 * @returns {any}
 */
export function analyze(fen_before, uci) {
  const ptr0 = passStringToWasm0(fen_before, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ptr1 = passStringToWasm0(uci, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len1 = WASM_VECTOR_LEN
  const ret = wasm.analyze(ptr0, len0, ptr1, len1)
  return takeObject(ret)
}

/**
 * Analyze a sequence of UCI moves starting from a FEN.
 *
 * Same shape as `analyze`, but returns an array of results — one per ply.
 * @param {string} start_fen
 * @param {any[]} ucis
 * @param {number} plies
 * @returns {any}
 */
export function analyze_pv(start_fen, ucis, plies) {
  const ptr0 = passStringToWasm0(start_fen, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ptr1 = passArrayJsValueToWasm0(ucis, wasm.__wbindgen_export)
  const len1 = WASM_VECTOR_LEN
  const ret = wasm.analyze_pv(ptr0, len0, ptr1, len1, plies)
  return takeObject(ret)
}

/**
 * Static evaluation of a position. Returns the same `Eval` struct as the
 * internal evaluator: phase, per-side breakdown, final centipawn score.
 *
 * Use this to attribute "why is this position +0.7?" to specific terms
 * (material, psqt, mobility, pawns, king_safety, threats, imbalance).
 * @param {string} fen
 * @returns {any}
 */
export function evaluate_fen(fen) {
  const ptr0 = passStringToWasm0(fen, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ret = wasm.evaluate_fen(ptr0, len0)
  return takeObject(ret)
}

/**
 * Comprehensive structured explanation of why one side has the
 * advantage. Returns the full `Explanation` blob — material, pawn
 * structure, king safety, activity, line control, immediate tactics,
 * and high-level themes — designed for downstream LLM consumption.
 * @param {string} fen
 * @returns {any}
 */
export function explain_position(fen) {
  const ptr0 = passStringToWasm0(fen, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ret = wasm.explain_position(ptr0, len0)
  return takeObject(ret)
}

/**
 * Per-piece contribution to the static evaluation. Returns one entry per
 * non-king piece on the board: `value_cp` (side-relative), plus the
 * breakdown by head (material / psqt / mobility / pawns / king_safety /
 * threats / imbalance). This is what the heatmap renders.
 * @param {string} fen
 * @returns {any}
 */
export function piece_contributions(fen) {
  const ptr0 = passStringToWasm0(fen, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ret = wasm.piece_contributions(ptr0, len0)
  return takeObject(ret)
}

/**
 * Single-piece contribution at a square. Convenience for hover tooltips
 * that don't need the full board scan.
 * @param {string} fen
 * @param {string} square
 * @returns {any}
 */
export function piece_value_at(fen, square) {
  const ptr0 = passStringToWasm0(fen, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len0 = WASM_VECTOR_LEN
  const ptr1 = passStringToWasm0(square, wasm.__wbindgen_export, wasm.__wbindgen_export2)
  const len1 = WASM_VECTOR_LEN
  const ret = wasm.piece_value_at(ptr0, len0, ptr1, len1)
  return takeObject(ret)
}

/**
 * Quick smoke-test export so JS can confirm the WASM binding is alive.
 * @returns {string}
 */
export function version() {
  let deferred1_0
  let deferred1_1
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16)
    wasm.version(retptr)
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true)
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true)
    deferred1_0 = r0
    deferred1_1 = r1
    return getStringFromWasm0(r0, r1)
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16)
    wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1)
  }
}
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg_Error_3639a60ed15f87e7: function (arg0, arg1) {
      const ret = Error(getStringFromWasm0(arg0, arg1))
      return addHeapObject(ret)
    },
    __wbg___wbindgen_boolean_get_c3dd5c39f1b5a12b: function (arg0) {
      const v = getObject(arg0)
      const ret = typeof v === 'boolean' ? v : undefined
      return isLikeNone(ret) ? 0xffffff : ret ? 1 : 0
    },
    __wbg___wbindgen_debug_string_07cb72cfcc952e2b: function (arg0, arg1) {
      const ret = debugString(getObject(arg1))
      const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2)
      const len1 = WASM_VECTOR_LEN
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true)
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true)
    },
    __wbg___wbindgen_is_string_eddc07a3efad52e6: function (arg0) {
      const ret = typeof getObject(arg0) === 'string'
      return ret
    },
    __wbg___wbindgen_jsval_loose_eq_1978f1e77b4bce62: function (arg0, arg1) {
      const ret = getObject(arg0) == getObject(arg1)
      return ret
    },
    __wbg___wbindgen_number_get_dd6d69a6079f26f1: function (arg0, arg1) {
      const obj = getObject(arg1)
      const ret = typeof obj === 'number' ? obj : undefined
      getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true)
      getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true)
    },
    __wbg___wbindgen_string_get_965592073e5d848c: function (arg0, arg1) {
      const obj = getObject(arg1)
      const ret = typeof obj === 'string' ? obj : undefined
      var ptr1 = isLikeNone(ret)
        ? 0
        : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2)
      var len1 = WASM_VECTOR_LEN
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true)
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true)
    },
    __wbg___wbindgen_throw_9c75d47bf9e7731e: function (arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1))
    },
    __wbg_fromCodePoint_ac3a66d5b95b4ddf: function () {
      return handleError(function (arg0) {
        const ret = String.fromCodePoint(arg0 >>> 0)
        return addHeapObject(ret)
      }, arguments)
    },
    __wbg_instanceof_ArrayBuffer_eab9f28fbec23477: function (arg0) {
      let result
      try {
        result = getObject(arg0) instanceof ArrayBuffer
      } catch (_) {
        result = false
      }
      const ret = result
      return ret
    },
    __wbg_instanceof_Uint8Array_57d77acd50e4c44d: function (arg0) {
      let result
      try {
        result = getObject(arg0) instanceof Uint8Array
      } catch (_) {
        result = false
      }
      const ret = result
      return ret
    },
    __wbg_length_ba3c032602efe310: function (arg0) {
      const ret = getObject(arg0).length
      return ret
    },
    __wbg_new_2fad8ca02fd00684: function () {
      const ret = new Object()
      return addHeapObject(ret)
    },
    __wbg_new_3baa8d9866155c79: function () {
      const ret = []
      return addHeapObject(ret)
    },
    __wbg_new_46ae4e4ff2a07a64: function () {
      const ret = new Map()
      return addHeapObject(ret)
    },
    __wbg_new_8454eee672b2ba6e: function (arg0) {
      const ret = new Uint8Array(getObject(arg0))
      return addHeapObject(ret)
    },
    __wbg_prototypesetcall_fd4050e806e1d519: function (arg0, arg1, arg2) {
      Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), getObject(arg2))
    },
    __wbg_set_6be42768c690e380: function (arg0, arg1, arg2) {
      getObject(arg0)[takeObject(arg1)] = takeObject(arg2)
    },
    __wbg_set_82f7a370f604db70: function (arg0, arg1, arg2) {
      const ret = getObject(arg0).set(getObject(arg1), getObject(arg2))
      return addHeapObject(ret)
    },
    __wbg_set_f614f6a0608d1d1d: function (arg0, arg1, arg2) {
      getObject(arg0)[arg1 >>> 0] = takeObject(arg2)
    },
    __wbindgen_cast_0000000000000001: function (arg0) {
      // Cast intrinsic for `F64 -> Externref`.
      const ret = arg0
      return addHeapObject(ret)
    },
    __wbindgen_cast_0000000000000002: function (arg0) {
      // Cast intrinsic for `I64 -> Externref`.
      const ret = arg0
      return addHeapObject(ret)
    },
    __wbindgen_cast_0000000000000003: function (arg0, arg1) {
      // Cast intrinsic for `Ref(String) -> Externref`.
      const ret = getStringFromWasm0(arg0, arg1)
      return addHeapObject(ret)
    },
    __wbindgen_cast_0000000000000004: function (arg0) {
      // Cast intrinsic for `U64 -> Externref`.
      const ret = BigInt.asUintN(64, arg0)
      return addHeapObject(ret)
    },
    __wbindgen_object_clone_ref: function (arg0) {
      const ret = getObject(arg0)
      return addHeapObject(ret)
    },
    __wbindgen_object_drop_ref: function (arg0) {
      takeObject(arg0)
    },
  }
  return {
    __proto__: null,
    './engine_rs_bg.js': import0,
  }
}

function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1)
  const idx = heap_next
  heap_next = heap[idx]

  heap[idx] = obj
  return idx
}

function debugString(val) {
  // primitive types
  const type = typeof val
  if (type == 'number' || type == 'boolean' || val == null) {
    return `${val}`
  }
  if (type == 'string') {
    return `"${val}"`
  }
  if (type == 'symbol') {
    const description = val.description
    if (description == null) {
      return 'Symbol'
    } else {
      return `Symbol(${description})`
    }
  }
  if (type == 'function') {
    const name = val.name
    if (typeof name == 'string' && name.length > 0) {
      return `Function(${name})`
    } else {
      return 'Function'
    }
  }
  // objects
  if (Array.isArray(val)) {
    const length = val.length
    let debug = '['
    if (length > 0) {
      debug += debugString(val[0])
    }
    for (let i = 1; i < length; i++) {
      debug += ', ' + debugString(val[i])
    }
    debug += ']'
    return debug
  }
  // Test for built-in
  const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val))
  let className
  if (builtInMatches && builtInMatches.length > 1) {
    className = builtInMatches[1]
  } else {
    // Failed to match the standard '[object ClassName]'
    return toString.call(val)
  }
  if (className == 'Object') {
    // we're a user defined class or Object
    // JSON.stringify avoids problems with cycles, and is generally much
    // easier than looping through ownProperties of `val`.
    try {
      return 'Object(' + JSON.stringify(val) + ')'
    } catch (_) {
      return 'Object'
    }
  }
  // errors
  if (val instanceof Error) {
    return `${val.name}: ${val.message}\n${val.stack}`
  }
  // TODO we could test for more things here, like `Set`s and `Map`s.
  return className
}

function dropObject(idx) {
  if (idx < 1028) return
  heap[idx] = heap_next
  heap_next = idx
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len)
}

let cachedDataViewMemory0 = null
function getDataViewMemory0() {
  if (
    cachedDataViewMemory0 === null ||
    cachedDataViewMemory0.buffer.detached === true ||
    (cachedDataViewMemory0.buffer.detached === undefined &&
      cachedDataViewMemory0.buffer !== wasm.memory.buffer)
  ) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer)
  }
  return cachedDataViewMemory0
}

function getStringFromWasm0(ptr, len) {
  return decodeText(ptr >>> 0, len)
}

let cachedUint8ArrayMemory0 = null
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer)
  }
  return cachedUint8ArrayMemory0
}

function getObject(idx) {
  return heap[idx]
}

function handleError(f, args) {
  try {
    return f.apply(this, args)
  } catch (e) {
    wasm.__wbindgen_export3(addHeapObject(e))
  }
}

let heap = new Array(1024).fill(undefined)
heap.push(undefined, null, true, false)

let heap_next = heap.length

function isLikeNone(x) {
  return x === undefined || x === null
}

function passArrayJsValueToWasm0(array, malloc) {
  const ptr = malloc(array.length * 4, 4) >>> 0
  const mem = getDataViewMemory0()
  for (let i = 0; i < array.length; i++) {
    mem.setUint32(ptr + 4 * i, addHeapObject(array[i]), true)
  }
  WASM_VECTOR_LEN = array.length
  return ptr
}

function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg)
    const ptr = malloc(buf.length, 1) >>> 0
    getUint8ArrayMemory0()
      .subarray(ptr, ptr + buf.length)
      .set(buf)
    WASM_VECTOR_LEN = buf.length
    return ptr
  }

  let len = arg.length
  let ptr = malloc(len, 1) >>> 0

  const mem = getUint8ArrayMemory0()

  let offset = 0

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset)
    if (code > 0x7f) break
    mem[ptr + offset] = code
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset)
    }
    ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len)
    const ret = cachedTextEncoder.encodeInto(arg, view)

    offset += ret.written
    ptr = realloc(ptr, len, offset, 1) >>> 0
  }

  WASM_VECTOR_LEN = offset
  return ptr
}

function takeObject(idx) {
  const ret = getObject(idx)
  dropObject(idx)
  return ret
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true })
cachedTextDecoder.decode()
const MAX_SAFARI_DECODE_BYTES = 2146435072
let numBytesDecoded = 0
function decodeText(ptr, len) {
  numBytesDecoded += len
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true })
    cachedTextDecoder.decode()
    numBytesDecoded = len
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len))
}

const cachedTextEncoder = new TextEncoder()

if (!('encodeInto' in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function (arg, view) {
    const buf = cachedTextEncoder.encode(arg)
    view.set(buf)
    return {
      read: arg.length,
      written: buf.length,
    }
  }
}

let WASM_VECTOR_LEN = 0

let wasmModule, wasmInstance, wasm
function __wbg_finalize_init(instance, module) {
  wasmInstance = instance
  wasm = instance.exports
  wasmModule = module
  cachedDataViewMemory0 = null
  cachedUint8ArrayMemory0 = null
  return wasm
}

async function __wbg_load(module, imports) {
  if (typeof Response === 'function' && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        return await WebAssembly.instantiateStreaming(module, imports)
      } catch (e) {
        const validResponse = module.ok && expectedResponseType(module.type)

        if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            e,
          )
        } else {
          throw e
        }
      }
    }

    const bytes = await module.arrayBuffer()
    return await WebAssembly.instantiate(bytes, imports)
  } else {
    const instance = await WebAssembly.instantiate(module, imports)

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module }
    } else {
      return instance
    }
  }

  function expectedResponseType(type) {
    switch (type) {
      case 'basic':
      case 'cors':
      case 'default':
        return true
    }
    return false
  }
}

function initSync(module) {
  if (wasm !== undefined) return wasm

  if (module !== undefined) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ;({ module } = module)
    } else {
      console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
    }
  }

  const imports = __wbg_get_imports()
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module)
  }
  const instance = new WebAssembly.Instance(module, imports)
  return __wbg_finalize_init(instance, module)
}

async function __wbg_init(module_or_path) {
  if (wasm !== undefined) return wasm

  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ;({ module_or_path } = module_or_path)
    } else {
      console.warn(
        'using deprecated parameters for the initialization function; pass a single object instead',
      )
    }
  }

  if (module_or_path === undefined) {
    module_or_path = '/coach/engine_rs_bg.wasm'
  }
  const imports = __wbg_get_imports()

  if (
    typeof module_or_path === 'string' ||
    (typeof Request === 'function' && module_or_path instanceof Request) ||
    (typeof URL === 'function' && module_or_path instanceof URL)
  ) {
    module_or_path = fetch(module_or_path)
  }

  const { instance, module } = await __wbg_load(await module_or_path, imports)

  return __wbg_finalize_init(instance, module)
}

export { initSync, __wbg_init as default }
