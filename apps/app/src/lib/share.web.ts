/**
 * Shares a link with the browser's share sheet where there is one (mostly
 * phones); otherwise copies it and resolves to 'copied'.
 */
export async function shareLink(title: string, url: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch (error) {
      // Closing the sheet isn't a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
    }
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
