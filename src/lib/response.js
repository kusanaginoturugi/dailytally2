export function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

export function redirectResponse(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: { location, ...headers },
  });
}

export function badRequest(message) {
  return jsonResponse({ error: message }, { status: 400 });
}

export function forbidden(message = "Forbidden") {
  return jsonResponse({ error: message }, { status: 403 });
}

export function notFound() {
  return jsonResponse({ error: "Not found" }, { status: 404 });
}
