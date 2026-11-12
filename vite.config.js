import { defineConfig } from "vite";
import { loadCourse } from "./scripts/course.mjs";

// Which course to build: COURSE=<id> npm run build (default gh-500).
const COURSE = process.env.COURSE || "gh-500";
const VIRTUAL = "virtual:course-data";

// Serves the course JSON as a module and fills the page head and body from src/template.html.
function course() {
  return {
    name: "course",
    resolveId(id) { if (id === VIRTUAL) return "\0" + VIRTUAL; },
    load(id) {
      if (id !== "\0" + VIRTUAL) return;
      const { data } = loadCourse(COURSE);
      return `export default ${JSON.stringify(data)};`;
    },
    // Reload the page when course content or the template changes during npm run dev.
    handleHotUpdate({ file, server }) {
      if (/[\\/]courses[\\/]|template\.html$/.test(file)) {
        const mod = server.moduleGraph.getModuleById("\0" + VIRTUAL);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
        return [];
      }
    },
    transformIndexHtml(html) {
      const { head, body } = loadCourse(COURSE);
      return html.replace("<!-- course:head -->", head).replace("<!-- course:body -->", body);
    }
  };
}

export default defineConfig({
  plugins: [course()],
  build: { outDir: "dist", emptyOutDir: true }
});
