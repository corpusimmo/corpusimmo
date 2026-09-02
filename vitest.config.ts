import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      /**
       * `server-only` lève à l'import, par construction : c'est sa seule
       * fonction, et elle est utile — elle empêche un module serveur de
       * partir dans le paquet du navigateur.
       *
       * Sous Vitest, il n'y a ni serveur ni client, et l'audit des
       * métadonnées importe de VRAIES pages : une page dont un composant
       * client référence une action serveur entraîne toute la chaîne, donc ce
       * garde-fou, et le fichier de test échouait avant d'exécuter un seul
       * test. On le neutralise ici, et nulle part ailleurs : la garantie
       * continue de valoir là où elle compte, au build.
       */
      "server-only": fileURLToPath(
        new URL("./vitest.server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
});
