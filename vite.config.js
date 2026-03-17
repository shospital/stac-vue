import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const stacRoot = resolve(__dirname, '..', 'polarwatch_stac')

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload, null, 2))
}

function getCollectionPath(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('Invalid collection id')
  }

  return resolve(stacRoot, 'collections', id, 'collection.json')
}

async function readJson(filePath) {
  const text = await readFile(filePath, 'utf-8')
  return JSON.parse(text)
}

function readRequestBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk
    })

    req.on('end', () => {
      resolveBody(body)
    })

    req.on('error', (error) => {
      rejectBody(error)
    })
  })
}

const stacApiPlugin = {
  name: 'stac-local-api',
  configureServer(server) {
    server.middlewares.use(handleStacRequest)
  },
  configurePreviewServer(server) {
    server.middlewares.use(handleStacRequest)
  },
}

async function handleStacRequest(req, res, next) {
  if (!req.url?.startsWith('/api/stac')) {
    next()
    return
  }

  const requestUrl = new URL(req.url, 'http://localhost')

  try {
    if (req.method === 'GET' && requestUrl.pathname === '/api/stac/catalog') {
      const catalog = await readJson(resolve(stacRoot, 'catalog.json'))
      sendJson(res, 200, catalog)
      return
    }

    if (req.method === 'PUT' && requestUrl.pathname === '/api/stac/catalog') {
      const bodyText = await readRequestBody(req)
      const data = JSON.parse(bodyText)
      await writeFile(resolve(stacRoot, 'catalog.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
      sendJson(res, 200, { ok: true })
      return
    }

    if (requestUrl.pathname === '/api/stac/collection') {
      const collectionId = requestUrl.searchParams.get('id')

      if (!collectionId) {
        sendJson(res, 400, { error: 'Missing required query param: id' })
        return
      }

      const collectionPath = getCollectionPath(collectionId)

      if (req.method === 'GET') {
        const collection = await readJson(collectionPath)
        sendJson(res, 200, collection)
        return
      }

      if (req.method === 'PUT') {
        const bodyText = await readRequestBody(req)
        const data = JSON.parse(bodyText)
        await writeFile(collectionPath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
        sendJson(res, 200, { ok: true })
        return
      }
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unexpected error' })
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        stac: resolve(__dirname, 'stac.html'),
        learn: resolve(__dirname, 'learn.html'),
      },
    },
  },
  plugins: [vue(), stacApiPlugin],
})
