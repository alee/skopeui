const { Server } = require('@hapi/hapi')
const Routes = require('../api')
const consola = require('consola')
const HapiNuxt = require('@nuxtjs/hapi')

const server = new Server({
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT || 3000
})

server
  .register({
    plugin: HapiNuxt
  })
  .then(() => server.route(Routes))
  .then(() => server.start())
  .then(() =>
    consola.ready({
      message: `Server running at: ${server.info.uri}`,
      badge: true
    })
  )
  .catch(err => {
    consola.error(err)
    throw err
  })
