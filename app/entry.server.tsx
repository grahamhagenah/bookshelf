import { PassThrough } from "node:stream";

import { createReadableStreamFromReadable } from "@react-router/node";
import isBot from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";

// How long a page may keep streaming deferred data before the server
// gives up on it. The search page waits up to twelve seconds for Open
// Library, so this has to outlast that.
export const streamTimeout = 15_000;

// Crawlers get the whole page at once; people get it as it's ready
export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  const bot = isBot(request.headers.get("user-agent"));
  return new Promise((resolve, reject) => {
    const send = () => {
      const body = new PassThrough();

      responseHeaders.set("Content-Type", "text/html");

      resolve(
        new Response(createReadableStreamFromReadable(body), {
          headers: responseHeaders,
          status: responseStatusCode,
        }),
      );

      pipe(body);
    };
    const { abort, pipe } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady: bot ? undefined : send,
        onAllReady: bot ? send : undefined,
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          console.error(error);
        },
      },
    );

    // A little past the stream's own limit, so it can reject what's left
    // first
    setTimeout(abort, streamTimeout + 1000);
  });
}
