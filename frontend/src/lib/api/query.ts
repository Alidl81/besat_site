export type QueryValue = string | number | boolean | null | undefined;

export function withQuery(
  endpoint: string,
  values: Record<string, QueryValue>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `${endpoint}?${query}` : endpoint;
}

export function detailEndpoint(endpoint: string, id: string | number) {
  return `${endpoint}${encodeURIComponent(String(id))}/`;
}

export function actionEndpoint(
  endpoint: string,
  id: string | number,
  action: string,
) {
  return `${detailEndpoint(endpoint, id)}${action}/`;
}
