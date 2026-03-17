<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import DefaultLayout from './layouts/DefaultLayout.vue'

const status = ref('Loading catalog...')
const loading = ref(false)
const searchQuery = ref('')
const catalogTitle = ref('PolarWatch STAC Catalog')
const datasets = ref([])
const selectedDatasetId = ref('')
const mapElement = ref(null)
const catalogUrl = 'polarwatch_stac/catalog.json'

let leafletMap = null
let bboxLayer = null

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`

    try {
      const err = await response.json()
      if (err?.error) {
        message = err.error
      }
    } catch {
      // ignore JSON parse errors for error payload
    }

    throw new Error(message)
  }

  return response.json()
}

const filteredDatasets = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (!query) {
    return datasets.value
  }

  return datasets.value.filter((dataset) => {
    const keywords = Array.isArray(dataset.keywords) ? dataset.keywords.join(' ') : ''
    const haystack = `${dataset.id} ${dataset.title || ''} ${dataset.description || ''} ${keywords}`.toLowerCase()
    return haystack.includes(query)
  })
})

const selectedDataset = computed(() => datasets.value.find((dataset) => dataset.id === selectedDatasetId.value) || null)

const selectedDatasetServiceType = computed(() => {
  if (!selectedDataset.value) {
    return ''
  }

  return selectedDataset.value.serviceType || 'unknown'
})

const selectedDatasetBbox = computed(() => {
  if (!selectedDataset.value?.bbox || selectedDataset.value.bbox.length < 4) {
    return null
  }

  return selectedDataset.value.bbox
})

const selectedDatasetProviders = computed(() => {
  if (!selectedDataset.value?.providers) {
    return []
  }

  return selectedDataset.value.providers.map((provider) => ({
    name: provider.name || 'Unknown provider',
    url: provider.url || '',
  }))
})

const selectedDatasetDataAccessForm = computed(() => {
  if (!selectedDataset.value) {
    return ''
  }

  return selectedDataset.value.dataAccessForm || ''
})

const selectedDatasetItemsLink = computed(() => {
  if (!selectedDataset.value?.links) {
    return ''
  }

  const itemsLink = selectedDataset.value.links.find((link) => link.rel === 'items' && typeof link.href === 'string')
  return itemsLink?.href || ''
})

const selectedDatasetItems = computed(() => {
  if (!selectedDataset.value) {
    return []
  }

  return itemsByDatasetId.value[selectedDataset.value.id] || []
})

const selectedDatasetNetcdfCount = computed(
  () => selectedDatasetItems.value.filter((asset) => asset.isNetcdf).length,
)

const selectedDatasetInformation = computed(() => {
  if (!selectedDataset.value) {
    return ''
  }

  return selectedDataset.value.datasetInformation || ''
})

function isExternalLink(href) {
  return /^https?:\/\//i.test(href)
}

function extractServiceType(collection) {
  if (typeof collection.service_type === 'string' && collection.service_type.length > 0) {
    return collection.service_type
  }

  if (typeof collection['pw:service_type'] === 'string' && collection['pw:service_type'].length > 0) {
    return collection['pw:service_type']
  }

  const assets = collection.assets || {}
  for (const asset of Object.values(assets)) {
    if (typeof asset?.service_type === 'string' && asset.service_type.length > 0) {
      return asset.service_type
    }
    if (typeof asset?.['pw:service_type'] === 'string' && asset['pw:service_type'].length > 0) {
      return asset['pw:service_type']
    }
  }

  return ''
}

function extractBbox(collection) {
  const bbox = collection?.extent?.spatial?.bbox?.[0]

  if (!Array.isArray(bbox) || bbox.length < 4) {
    return null
  }

  const values = bbox.slice(0, 4).map((value) => Number(value))
  if (values.some((value) => Number.isNaN(value))) {
    return null
  }

  return values
}

function extractDataAccessForm(collection) {
  const aboutLink = (collection.links || []).find((link) => link.rel === 'about' && typeof link.href === 'string')
  if (aboutLink?.href) {
    return aboutLink.href
  }

  const htmlAsset = Object.values(collection.assets || {}).find(
    (asset) => asset?.type === 'text/html' && typeof asset?.href === 'string',
  )

  return htmlAsset?.href || ''
}

function extractDatasetInformation(collection) {
  const infoLink = (collection.links || []).find((link) => {
    if (link.rel !== 'describedby' || typeof link.href !== 'string') {
      return false
    }
    return /\/info\//.test(link.href) || /dataset information/i.test(link.title || '')
  })

  if (infoLink?.href) {
    return infoLink.href
  }

  const metadataAsset = Object.values(collection.assets || {}).find(
    (asset) => typeof asset?.href === 'string' && /\/info\//.test(asset.href),
  )

  return metadataAsset?.href || ''
}

function isNetcdfAsset(asset) {
  const type = `${asset?.type || ''}`.toLowerCase()
  const href = `${asset?.href || ''}`.toLowerCase()
  return type.includes('netcdf') || href.endsWith('.nc') || href.endsWith('.nc4')
}

function getDisplayNameFromHref(href) {
  if (!href) {
    return ''
  }

  try {
    const parsed = new URL(href, window.location.href)
    const filename = parsed.pathname.split('/').filter(Boolean).pop()
    return filename || href
  } catch {
    const filename = href.split('/').filter(Boolean).pop()
    return filename || href
  }
}

function resolveRelativeUrl(baseUrl, href) {
  if (!href) {
    return ''
  }

  try {
    return new URL(href, new URL(baseUrl, window.location.href)).toString()
  } catch {
    return href
  }
}

function formatItemDatetime(item) {
  const datetime = item?.properties?.datetime || item?.properties?.start_datetime || ''
  if (!datetime) {
    return 'n/a'
  }

  return datetime
}

function flattenItemAssets(itemCollection, itemCollectionUrl) {
  const features = Array.isArray(itemCollection?.features) ? itemCollection.features : []

  return features.flatMap((feature) => {
    const assets = feature?.assets || {}
    const itemId = feature?.id || 'unknown-item'
    const itemDatetime = formatItemDatetime(feature)

    return Object.entries(assets)
      .filter(([, asset]) => typeof asset?.href === 'string' && asset.href.length > 0)
      .map(([assetKey, asset]) => {
        const resolvedHref = resolveRelativeUrl(itemCollectionUrl, asset.href)

        return {
          id: `${itemId}:${assetKey}`,
          itemId,
          itemDatetime,
          assetKey,
          title: asset.title || getDisplayNameFromHref(asset.href) || assetKey,
          href: resolvedHref,
          type: asset.type || '',
          isNetcdf: isNetcdfAsset(asset),
        }
      })
  })
}

const itemsModalOpen = ref(false)
const itemsLoading = ref(false)
const itemsError = ref('')
const itemsByDatasetId = ref({})

function closeItemsModal() {
  itemsModalOpen.value = false
}

async function openItemsModal() {
  if (!selectedDataset.value || !selectedDatasetItemsLink.value) {
    return
  }

  const datasetId = selectedDataset.value.id
  itemsModalOpen.value = true
  itemsError.value = ''

  if (itemsByDatasetId.value[datasetId]) {
    return
  }

  itemsLoading.value = true

  try {
    const itemsUrl = resolveRelativeUrl(selectedDataset.value.collectionUrl, selectedDatasetItemsLink.value)
    const itemCollection = await fetchJson(itemsUrl)
    itemsByDatasetId.value[datasetId] = flattenItemAssets(itemCollection, itemsUrl)
  } catch (error) {
    itemsError.value = `Unable to load items for this dataset: ${error.message}`
    itemsByDatasetId.value[datasetId] = []
  } finally {
    itemsLoading.value = false
  }
}

function ensureMap() {
  if (leafletMap || !mapElement.value) {
    return
  }

  leafletMap = L.map(mapElement.value, {
    center: [0, 0],
    zoom: 2,
    worldCopyJump: true,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(leafletMap)
}

function renderBboxOnMap(bbox) {
  if (!bbox || !leafletMap) {
    return
  }

  const [west, south, east, north] = bbox
  const bounds = [
    [south, west],
    [north, east],
  ]

  if (bboxLayer) {
    bboxLayer.remove()
  }

  bboxLayer = L.rectangle(bounds, {
    color: '#2c6ead',
    weight: 2,
    fillOpacity: 0.15,
  }).addTo(leafletMap)

  leafletMap.fitBounds(bounds, { padding: [20, 20] })
}

async function loadCatalogBrowser() {
  loading.value = true
  status.value = 'Loading catalog...'

  try {
    const catalog = await fetchJson(catalogUrl)
    catalogTitle.value = catalog.title || 'PolarWatch STAC Catalog'

    const childLinks = (catalog.links || []).filter(
      (link) => link.rel === 'child' && typeof link.href === 'string' && /collections\/[^/]+\/collection\.json$/.test(link.href),
    )

    const loadedDatasets = await Promise.all(
      childLinks.map(async (link) => {
        const idMatch = link.href.match(/collections\/([^/]+)\/collection\.json$/)
        const id = idMatch?.[1] || ''

        if (!id) {
          return null
        }

        try {
          const collectionUrl = `polarwatch_stac/collections/${encodeURIComponent(id)}/collection.json`
          const collection = await fetchJson(collectionUrl)
          return {
            id,
            title: collection.title || link.title || id,
            collectionUrl,
            summary: collection.description || '',
            serviceType: extractServiceType(collection),
            bbox: extractBbox(collection),
            providers: collection.providers || [],
            dataAccessForm: extractDataAccessForm(collection),
            datasetInformation: extractDatasetInformation(collection),
            links: collection.links || [],
            assets: collection.assets || {},
            extent: collection.extent || null,
          }
        } catch (error) {
          return {
            id,
            title: link.title || id,
            summary: '',
            serviceType: '',
            bbox: null,
            providers: [],
            dataAccessForm: '',
            datasetInformation: '',
            links: [],
            assets: {},
            extent: null,
            loadError: error.message,
          }
        }
      }),
    )

    datasets.value = loadedDatasets.filter((dataset) => dataset !== null).sort((a, b) => a.title.localeCompare(b.title))

    if (datasets.value.length > 0) {
      const selectedStillExists = datasets.value.some((dataset) => dataset.id === selectedDatasetId.value)
      if (!selectedStillExists) {
        selectedDatasetId.value = datasets.value[0].id
      }
      status.value = `Loaded ${datasets.value.length} datasets`
    } else {
      selectedDatasetId.value = ''
      status.value = 'No datasets found in catalog'
    }
  } catch (error) {
    status.value = `Catalog load failed: ${error.message}`
    datasets.value = []
    selectedDatasetId.value = ''
  } finally {
    loading.value = false
  }
}

watch(
  selectedDatasetBbox,
  async (bbox) => {
    if (!bbox) {
      return
    }

    await nextTick()
    ensureMap()
    renderBboxOnMap(bbox)
  },
  { immediate: true },
)

onMounted(() => {
  ensureMap()
  if (selectedDatasetBbox.value) {
    renderBboxOnMap(selectedDatasetBbox.value)
  }
})

loadCatalogBrowser()
</script>

<template>
  <DefaultLayout>
    <section id="search" class="section pt-0 page-content">
      <div class="container">
        <div class="topbar">
          <div>
            <h2 class="mb-1">{{ catalogTitle }}</h2>
            <p class="status mb-0">{{ status }}</p>
          </div>
          <div class="actions">
            <input v-model="searchQuery" type="search" placeholder="Search datasets..." />
            <button class="btn btn-primary btn-sm" :disabled="loading" @click="loadCatalogBrowser">Reload</button>
          </div>
        </div>

        <section class="browser-grid mt-3">
          <aside class="panel list-panel">
            <div class="panel-header">
              <h3 class="mb-0">Datasets</h3>
              <span class="count">{{ filteredDatasets.length }}</span>
            </div>
            <div class="dataset-list">
              <button
                v-for="item in filteredDatasets"
                :key="item.id"
                class="dataset-item"
                :class="{ active: item.id === selectedDatasetId }"
                @click="selectedDatasetId = item.id"
              >
                <div class="dataset-title">{{ item.title }}</div>
                <div class="dataset-id">{{ item.id }}</div>
              </button>
              <p v-if="!loading && filteredDatasets.length === 0" class="empty">No matching datasets.</p>
            </div>
          </aside>

          <article class="panel details-panel">
            <template v-if="selectedDataset">
              <div class="panel-header">
                <h3 class="mb-0">{{ selectedDataset.title }}</h3>
              </div>

              <p class="dataset-id-line">
                <span class="dataset-id"><strong>Dataset ID:</strong> {{ selectedDataset.id }}</span>
                <span class="service-tag">service_type: {{ selectedDatasetServiceType }}</span>
              </p>

              <p><strong>Summary:</strong> {{ selectedDataset.summary || 'No summary provided.' }}</p>

              <p v-if="selectedDatasetBbox"><strong>Bounding Box:</strong> {{ selectedDatasetBbox.join(', ') }}</p>
              <p v-else><strong>Bounding Box:</strong> n/a</p>

              <p v-if="selectedDatasetProviders.length > 0">
                <strong>Providers:</strong>
                <span v-for="(provider, index) in selectedDatasetProviders" :key="provider.name + index">
                  <template v-if="index > 0">, </template>
                  <a v-if="isExternalLink(provider.url)" :href="provider.url" target="_blank" rel="noreferrer">{{ provider.name }}</a>
                  <span v-else>{{ provider.name }}</span>
                </span>
              </p>
              <p v-else><strong>Providers:</strong> n/a</p>

              <p>
                <strong>Data Access Form:</strong>
                <a
                  v-if="isExternalLink(selectedDatasetDataAccessForm)"
                  :href="selectedDatasetDataAccessForm"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
                <span v-else>n/a</span>
              </p>

              <p>
                <strong>Items:</strong>
                <button v-if="selectedDatasetItemsLink" class="btn btn-outline-primary btn-sm ms-2" @click="openItemsModal">
                  View Items
                </button>
                <span v-else>n/a</span>
                <span v-if="selectedDatasetItems.length > 0" class="items-summary ms-2">
                  {{ selectedDatasetItems.length }} assets, {{ selectedDatasetNetcdfCount }} netCDF
                </span>
              </p>

              <p>
                <strong>Dataset Metadata:</strong>
                <a
                  v-if="isExternalLink(selectedDatasetInformation)"
                  :href="selectedDatasetInformation"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
                <span v-else>n/a</span>
              </p>

              <div class="bbox-map-wrap">
                <h4 class="mt-3 mb-2">Data Boundary</h4>
                <div v-if="selectedDatasetBbox" ref="mapElement" class="bbox-map"></div>
                <p v-else class="empty mb-0">No bounding box available for map display.</p>
              </div>

              <p v-if="selectedDataset.loadError" class="error">Some details were unavailable: {{ selectedDataset.loadError }}</p>
            </template>

            <p v-else class="empty">Select a dataset to view details.</p>
          </article>
        </section>
      </div>
    </section>

  </DefaultLayout>

  <div v-if="itemsModalOpen" class="items-modal-backdrop" @click.self="closeItemsModal">
    <div class="items-modal panel" role="dialog" aria-modal="true" aria-label="Dataset item assets">
      <div class="panel-header">
        <h3 class="mb-0">{{ selectedDataset?.title || 'Dataset' }} Items</h3>
        <button class="btn btn-sm" @click="closeItemsModal">Close</button>
      </div>

      <p class="dataset-id mb-2"><strong>Dataset ID:</strong> {{ selectedDataset?.id || 'n/a' }}</p>

      <p v-if="itemsLoading" class="mb-0">Loading item assets...</p>
      <p v-else-if="itemsError" class="error mb-0">{{ itemsError }}</p>
      <p v-else-if="selectedDatasetItems.length === 0" class="empty mb-0">No downloadable assets were found.</p>

      <div v-else class="items-table-wrap">
        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Date/Time</th>
              <th>Asset</th>
              <th>Type</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="asset in selectedDatasetItems" :key="asset.id">
              <td>{{ asset.itemId }}</td>
              <td>{{ asset.itemDatetime }}</td>
              <td>{{ asset.title }}</td>
              <td>
                <span :class="['asset-type-badge', { netcdf: asset.isNetcdf }]">
                  {{ asset.type || (asset.isNetcdf ? 'application/x-netcdf' : 'unknown') }}
                </span>
              </td>
              <td>
                <a :href="asset.href" target="_blank" rel="noreferrer">Download</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
