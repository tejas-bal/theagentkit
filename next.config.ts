import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // onnxruntime-node (a transformers.js dependency, used for local embeddings)
  // ships a native .node binary that Next.js's build-time bundler/tracer can't
  // follow -- bundling it breaks in Vercel's serverless runtime with
  // "Cannot find module 'onnxruntime-node'". Excluding these from bundling
  // makes Next.js require() them normally at runtime from node_modules instead.
  serverExternalPackages: ["onnxruntime-node", "@huggingface/transformers", "vectra"],
  // serverExternalPackages alone isn't always enough: Vercel's separate file-trace
  // step (which decides what actually ships in the deployed function) can still
  // miss a native binary since it's loaded via a dynamic platform/arch path, not a
  // static require() the tracer can follow. Force-include just the Linux x64 CPU
  // runtime (Vercel's build platform) explicitly -- NOT a directory glob, since
  // onnxruntime-node also ships CUDA/TensorRT provider .so files (~270MB combined,
  // GPU-only, unused here) that would blow well past Vercel's function size limit.
  // Both API routes embed the query, so both need the binary (keyed by a glob
  // over the route paths -- keying only /ask left /search without it).
  // transformers.js also loads onnxruntime-node itself via
  // createRequire(import.meta.url), which the tracer can't follow either, so
  // the package's own entry point (package.json + dist/) must be listed too or
  // the function fails with "Cannot find module 'onnxruntime-node'".
  outputFileTracingIncludes: {
    "/api/projects/[slug]/*": [
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/*.js",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/onnxruntime_binding.node",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime.so.1",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime_providers_shared.so",
    ],
  },
};

export default nextConfig;
