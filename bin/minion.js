#!/usr/bin/env node

const { resolve, extname, parse } = require('path')
const fs = require('fs')
const nano = require('../lib')

let path, modules

try {
    const packageJson = require(resolve(process.cwd(), 'package.json'))
    path = packageJson.main || 'index.js'
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') {
    console.error(
      `Could not read \`package.json\`: ${err.message}`,
      'invalid-package-json'
    )
    process.exit(1)
  }
}

if (!fs.existsSync(path)) {
  console.error(
    `Could not read \`${path}\``,
    'invalid-path'
  )
  process.exit(1)
}

const stats = fs.statSync(path)
modules = stats.isDirectory() ? fs.readdirSync(path).map((file) => `${path}/${file}`) : [path]
modules = modules.filter((mod) => extname(mod) === '.js')

if(!modules.length) {
  console.error(
    `No modules avaliable at \`${path}\``,
    'no-modules'
  )
  process.exit(1)
}

modules.forEach((mod) => {
  const handler = require(resolve(process.cwd(), mod))

  // TODO recursive directories for names ie. triage.create
  Object.defineProperty(handler, 'name', { value: handler.queue || parse(mod).name });

  nano(require(resolve(process.cwd(), mod)))
})