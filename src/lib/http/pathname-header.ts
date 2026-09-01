/**
 * Name of the request header through which `src/middleware.ts` publishes the
 * requested pathname to Server Components.
 *
 * Lives in its own module so a layout can import the constant without importing
 * the middleware entry point (which Next treats specially and which pulls in
 * `next/server`).
 */
export const PATHNAME_HEADER = "x-corpusimmo-pathname";
