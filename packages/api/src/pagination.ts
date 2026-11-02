/** Reads a query parameter (the next page's cursor or offset) from a DRF `next` URL. */
export function queryParam(url: string | null | undefined, name: string) {
  return url ? (new URL(url).searchParams.get(name) ?? undefined) : undefined;
}

/** The next page's offset from a DRF `next` URL, for limit/offset pagination. */
export function nextOffset(url: string | null | undefined) {
  const offset = queryParam(url, 'offset');
  return offset === undefined ? undefined : Number(offset);
}
