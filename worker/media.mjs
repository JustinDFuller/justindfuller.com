const keyPattern = /^v1\/[a-f0-9]{64}\.(png|jpg|svg)$/;
export const privateHeaders = {
  "cache-control": "private, no-store, no-transform",
  "x-robots-tag": "noindex, nofollow",
  "x-content-type-options": "nosniff",
};

export async function privateImage(request, bucket, allowlist) {
  const url = new URL(request.url);
  const key = url.pathname.slice("/__obsidian/media/".length);
  const record = allowlist[key];
  if (
    !url.pathname.startsWith("/__obsidian/media/") ||
    url.search ||
    !keyPattern.test(key) ||
    !record ||
    record.key !== key ||
    record.size <= 0 ||
    record.size > 20 * 1024 * 1024
  )
    return new Response(null, { status: 404, headers: privateHeaders });
  if (!["GET", "HEAD"].includes(request.method))
    return new Response(null, {
      status: 405,
      headers: { ...privateHeaders, allow: "GET, HEAD" },
    });
  try {
    const object =
      request.method === "HEAD"
        ? await bucket.head(key)
        : await bucket.get(key);
    if (
      !object ||
      object.size !== record.size ||
      object.httpMetadata?.contentType !== record.contentType ||
      object.customMetadata?.sha256 !== record.sha256 ||
      object.customMetadata?.md5 !== record.md5
    ) {
      await object?.body?.cancel();
      return new Response(null, { status: 404, headers: privateHeaders });
    }
    const headers = {
      ...privateHeaders,
      "content-type": record.contentType,
      "content-length": String(record.size),
    };
    if (request.method === "HEAD") return new Response(null, { headers });
    let count = 0;
    const bounded = new TransformStream({
      transform(chunk, controller) {
        count += chunk.byteLength;
        if (count > record.size)
          throw new Error("Private image length mismatch");
        controller.enqueue(chunk);
      },
      flush() {
        if (count !== record.size)
          throw new Error("Private image length mismatch");
      },
    });
    return new Response(object.body.pipeThrough(bounded), { headers });
  } catch {
    return new Response(null, { status: 503, headers: privateHeaders });
  }
}

export async function privateSite(request, env, allowlist) {
  const url = new URL(request.url);
  let response;
  if (url.pathname.startsWith("/__obsidian/"))
    response = await privateImage(request, env.OBSIDIAN_SOURCE, allowlist);
  else response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(privateHeaders))
    headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
