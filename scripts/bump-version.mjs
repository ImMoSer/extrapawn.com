import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = path.join(rootDir, 'package.json')

function pad2(num) {
  return String(num).padStart(2, '0')
}

function buildTimestampVersion(now = new Date(), includeSeconds = false) {
  const yy = pad2(now.getFullYear() % 100)
  const mm = pad2(now.getMonth() + 1)
  const dd = pad2(now.getDate())
  const hh = pad2(now.getHours())
  const min = pad2(now.getMinutes())
  const base = `${yy}.${mm}.${dd}-${hh}${min}`
  if (!includeSeconds) {
    return base
  }
  return `${base}-${pad2(now.getSeconds())}`
}

const rawPkg = fs.readFileSync(pkgPath, 'utf8')
const pkg = JSON.parse(rawPkg)

const now = new Date()
let nextVersion = buildTimestampVersion(now, false)
if (pkg.version === nextVersion) {
  nextVersion = buildTimestampVersion(now, true)
}

pkg.version = nextVersion
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')

if (process.argv.includes('--stage')) {
  execFileSync('git', ['add', 'package.json'], { cwd: rootDir, stdio: 'inherit' })
}

console.log(`[bump-version] Updated package.json version -> ${nextVersion}`)
