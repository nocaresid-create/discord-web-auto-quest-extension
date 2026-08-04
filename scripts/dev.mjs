import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { build } from 'vite';

const { svelte } = await import('@sveltejs/vite-plugin-svelte');
const cssInjectedByJs = (await import('vite-plugin-css-injected-by-js')).default;

const sveltePlugin = svelte();

const popupConfig = {
  base: './',
  plugins: [sveltePlugin],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    rollupOptions: {
      input: { popup: 'src/popup/popup.html' },
      output: { entryFileNames: 'popup-[name].js' }
    }
  }
};

const scriptEntries = [
  { name: 'quest-home', input: 'src/content/quest-home.ts' },
  { name: 'quest-code', input: 'src/quest-code.ts' },
  { name: 'background', input: 'src/background.ts' }
];

const scriptConfigs = scriptEntries.map(({ name, input }) => ({
  plugins: [sveltePlugin, cssInjectedByJs({ styleId: 'dqc-quest-styles' })],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    rollupOptions: {
      input,
      output: { format: 'iife', entryFileNames: `${name}.js`, inlineDynamicImports: true }
    }
  }
}));

function postProcessPopup() {
  const built = 'dist/src/popup/popup.html';
  if (!existsSync(built)) return;
  let html = readFileSync(built, 'utf8');
  html = html.replace(/\.\.\/\.\.\//g, './');
  writeFileSync('dist/popup.html', html);
  rmSync('dist/src', { recursive: true, force: true });
}

rmSync('dist', { recursive: true, force: true });

console.log('Watch mode: rebuild on src changes...');

const watchers = [popupConfig, ...scriptConfigs].map((config) =>
  build({ ...config, build: { ...config.build, watch: true } })
);

for (const watcher of watchers) {
  watcher.on('event', (event) => {
    if (event.code === 'END') postProcessPopup();
  });
}
