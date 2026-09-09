import { defineConfig } from 'vite'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const projectEnvDir = existsSync(resolve(process.cwd(), '.env'))
  ? process.cwd()
  : existsSync(resolve(process.cwd(), '..', '.env'))
    ? resolve(process.cwd(), '..')
    : process.cwd()

function collectHtmlInputs(dirPath) {
  const inputs = []

  if (!existsSync(dirPath)) return inputs

  for (const entry of readdirSync(dirPath)) {
    const fullPath = resolve(dirPath, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      inputs.push(...collectHtmlInputs(fullPath))
      continue
    }

    if (entry.toLowerCase().endsWith('.html')) {
      inputs.push(fullPath)
    }
  }

  return inputs
}

const rootDir = process.cwd()
const reportHtmlInputs = collectHtmlInputs(resolve(rootDir, 'reports'))
const buildInputs = [
  resolve(rootDir, 'index.html'),
  resolve(rootDir, 'labour-grievance.html'),
  ...reportHtmlInputs,
]

export default defineConfig({
  envDir: projectEnvDir,

  // ตั้งค่าให้ไฟล์เรียกหากันผ่าน Path แบบ Relative
  base: './',

  resolve: {
    dedupe: [
      'firebase',
      '@firebase/app',
      '@firebase/component',
      '@firebase/database',
      '@firebase/functions',
      '@firebase/logger',
      '@firebase/storage',
      '@firebase/util',
    ],
  },

  optimizeDeps: {
    force: true,
  },

  build: {
    // กำหนดให้ตอน build ออกมาแล้วไฟล์รวมกันได้ดีขึ้น
    outDir: 'dist',
    rollupOptions: {
      input: buildInputs,
    },
  }
})
