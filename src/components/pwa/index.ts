/**
 * Surface d'import unique du sujet PWA.
 * `layout.tsx` ne connaît que `PwaRuntime`, et c'est tout ce qu'il doit
 * connaître : voir `docs/pwa.md`.
 */

export { PwaRuntime } from "./pwa-runtime";
export { InstallInvite } from "./install-invite";
export { ServiceWorkerRegistrar } from "./service-worker";
export { useInstallInvite } from "./use-install-invite";
export type { Canal, InstallInvite as InstallInviteState } from "./use-install-invite";
