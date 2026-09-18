/**
 * Validates postMessage origins received from a webcam embed.
 *
 * A message is accepted only when its origin exactly matches the origin
 * of the iframe that is expected to have sent it.
 *
 * This covers:
 * - YouTube web embeds
 * - YouTube privacy-enhanced embeds
 * - Rasadyar desktop local embed proxy
 *
 * Invalid, opaque, malformed, or mismatched origins are rejected.
 */
export function isAllowedWebcamEmbedMessageOrigin(
  messageOrigin: string,
  iframeSrc: string,
): boolean {
  if (!messageOrigin || messageOrigin === 'null' || !iframeSrc) {
    return false;
  }

  try {
    const iframeUrl = new URL(iframeSrc, window.location.href);

    if (
      iframeUrl.protocol !== 'https:' &&
      iframeUrl.protocol !== 'http:'
    ) {
      return false;
    }

    return messageOrigin === iframeUrl.origin;
  } catch {
    return false;
  }
}