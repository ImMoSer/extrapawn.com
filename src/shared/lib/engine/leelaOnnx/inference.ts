import * as ort from "onnxruntime-web";

let session: ort.InferenceSession | null = null;
let inputName = "/input/planes";
let outputNames: string[] = [];

export async function initModel(modelData: ArrayBuffer): Promise<void> {
  // Pure single-threaded WASM execution (no GPU/JSEP, no COOP/COEP required)
  ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
  ort.env.wasm.numThreads = 1;

  session = await ort.InferenceSession.create(new Uint8Array(modelData), {
    executionProviders: ["wasm"],
  });

  inputName = session.inputNames[0] || inputName;
  outputNames = [...session.outputNames];
}

export interface InferenceResult {
  policy: Float32Array;
  wdl: [number, number, number];
  value: number;
}

export async function runInference(
  inputTensor: Float32Array,
): Promise<InferenceResult> {
  if (!session) throw new Error("LeelaONNX model not initialized");

  const feeds: Record<string, ort.Tensor> = {
    [inputName]: new ort.Tensor("float32", inputTensor, [1, 112, 8, 8]),
  };

  const results = await session.run(feeds);

  let policy = new Float32Array(1858);
  for (const name of outputNames) {
    if (name.toLowerCase().includes("policy")) {
      policy = new Float32Array(results[name].data as ArrayLike<number>);
      break;
    }
  }

  let wdl: [number, number, number] = [0.5, 0, 0.5];
  for (const name of outputNames) {
    if (name.toLowerCase().includes("wdl")) {
      const data = results[name].data as Float32Array;
      wdl = [data[0], data[1], data[2]];
      break;
    }
  }

  let value = 0;
  for (const name of outputNames) {
    if (
      name.toLowerCase().includes("value") &&
      !name.toLowerCase().includes("wdl")
    ) {
      const data = results[name].data as Float32Array;
      value = data[0];
      if (wdl[0] === 0.5 && wdl[2] === 0.5) {
        wdl = [(value + 1) / 2, 0, (1 - value) / 2];
      }
      break;
    }
  }

  return { policy, wdl, value };
}
