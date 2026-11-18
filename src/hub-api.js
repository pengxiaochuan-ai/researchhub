export async function hubRequest(path, options = {}) {
  const response = await fetch(`/api/hubs${path}`, {
    credentials: 'same-origin', cache: 'no-store', ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.message || `请求失败（${response.status}）`);
    error.status = response.status; error.code = body.code;
    throw error;
  }
  return response.json();
}
