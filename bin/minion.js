#!/usr/bin/env node

const { resolve, extname, parse } = require('path')
const fs = require('fs')
const minion = require('../lib')
const logger = minion.logger
const repl = require('repl')

const parseArgs = require('mri')

const flags = parseArgs(process.argv.slice(2), {
  default: {
  },
  alias: {
    x: 'exchangeName',
    t: 'exchangeType',
    i: 'interactive'
  },
  unknown(flag) {
    logger.info(`The option "${flag}" is unknown. Use one of these: exchange / type`)
    process.exit(1)
  }
})

let path, modules

try {
    const packageJson = require(resolve(process.cwd(), 'package.json'))
    path = packageJson.main || 'index.js'
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') {
    logger.error(
      `Could not read \`package.json\`: ${err.message}`,
      'invalid-package-json'
    )
    process.exit(1)
  }
}

if (!fs.existsSync(path)) {
  logger.error(
    `Could not read \`${path}\``,
    'invalid-path'
  )
  process.exit(1)
}

const stats = fs.statSync(path)
modules = stats.isDirectory() ? fs.readdirSync(path).map((file) => `${path}/${file}`) : [path]
modules = modules.filter((mod) => extname(mod) === '.js')

if(!modules.length) {
  logger.error(
    `No modules avaliable at \`${path}\``,
    'no-modules'
  )
  process.exit(1)
}

const services = modules.reduce((services, mod) => {
  const handler = require(resolve(process.cwd(), mod))

  // TODO recursive directories for names ie. triage.create
  Object.defineProperty(handler, 'name', { value: handler.queue || parse(mod).name })

  services[handler.name] = minion(handler, flags)
  return services
}, {})

if (flags.interactive) {
  const minionRepl = repl.start('> ')
  minionRepl.context.services = services
  minionRepl.context.minion = minion
}
