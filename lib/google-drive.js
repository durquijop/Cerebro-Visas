/**
 * Google Drive Integration Service
 * Permite listar y descargar archivos de carpetas compartidas
 */

const GOOGLE_DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY

/**
 * Extrae el ID de una URL de Google Drive
 * Soporta varios formatos de URL
 */
export function extractDriveId(url) {
  if (!url) return null
  
  // Formato: https://drive.google.com/drive/folders/FOLDER_ID
  let match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (match) return { id: match[1], type: 'folder' }
  
  // Formato: https://drive.google.com/file/d/FILE_ID/view
  match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return { id: match[1], type: 'file' }
  
  // Formato: https://drive.google.com/open?id=ID
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match) return { id: match[1], type: 'unknown' }
  
  // Si es solo el ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) {
    return { id: url, type: 'unknown' }
  }
  
  return null
}

/**
 * Espera un tiempo determinado
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Hace una petición con reintentos
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      
      if (response.ok) {
        return response
      }
      
      // Si es error 500, esperar y reintentar
      if (response.status === 500 && attempt < maxRetries) {
        console.log(`⚠️ Error 500, reintentando (${attempt}/${maxRetries})...`)
        await sleep(1000 * attempt) // Backoff exponencial
        continue
      }
      
      // Si es 403 o 404, no reintentar
      if (response.status === 403 || response.status === 404) {
        const error = await response.text()
        throw new Error(`Error ${response.status}: ${error}`)
      }
      
      return response
      
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        await sleep(1000 * attempt)
      }
    }
  }
  
  throw lastError
}

/**
 * Lista archivos de una carpeta (un solo nivel)
 */
async function listFolderContents(folderId) {
  if (!GOOGLE_DRIVE_API_KEY) {
    throw new Error('GOOGLE_DRIVE_API_KEY no configurada')
  }

  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&key=${GOOGLE_DRIVE_API_KEY}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=1000`
  
  const response = await fetchWithRetry(url)
  
  if (!response.ok) {
    const error = await response.text()
    console.error('Drive API error:', error)
    throw new Error(`Error de Google Drive: ${response.status}`)
  }

  return response.json()
}

/**
 * Lista todos los archivos en una carpeta de Drive (incluyendo subcarpetas)
 * Con callback de progreso
 */
export async function listDriveFolder(folderId, recursive = true, onProgress = null) {
  const files = []
  const folders = []
  const processedFolders = []
  
  try {
    // Listar contenido de la carpeta principal
    if (onProgress) onProgress({ status: 'listing', folder: 'Carpeta principal', count: 0 })
    
    const data = await listFolderContents(folderId)
    
    for (const file of data.files || []) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        folders.push({
          id: file.id,
          name: file.name,
          type: 'folder',
          path: file.name
        })
      } else {
        files.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: parseInt(file.size) || 0,
          modifiedTime: file.modifiedTime,
          parentFolder: folderId,
          path: file.name
        })
      }
    }

    if (onProgress) onProgress({ 
      status: 'listed', 
      folder: 'Carpeta principal', 
      files: files.length,
      subfolders: folders.length 
    })

    // Si es recursivo, listar subcarpetas una por una (no en paralelo para evitar 500)
    if (recursive && folders.length > 0) {
      for (let i = 0; i < folders.length; i++) {
        const folder = folders[i]
        
        if (onProgress) onProgress({ 
          status: 'listing', 
          folder: folder.name, 
          progress: Math.round((i / folders.length) * 100),
          current: i + 1,
          total: folders.length
        })
        
        try {
          // Esperar un poco entre carpetas para evitar rate limiting
          if (i > 0) await sleep(300)
          
          const subData = await listFolderContents(folder.id)
          
          for (const subFile of subData.files || []) {
            if (subFile.mimeType === 'application/vnd.google-apps.folder') {
              // No procesamos sub-subcarpetas por ahora para evitar errores
              folders.push({
                id: subFile.id,
                name: subFile.name,
                type: 'folder',
                path: `${folder.name}/${subFile.name}`
              })
            } else {
              files.push({
                id: subFile.id,
                name: subFile.name,
                mimeType: subFile.mimeType,
                size: parseInt(subFile.size) || 0,
                modifiedTime: subFile.modifiedTime,
                parentFolder: folder.id,
                parentFolderName: folder.name,
                path: `${folder.name}/${subFile.name}`
              })
            }
          }
          
          processedFolders.push(folder.name)
          
        } catch (subError) {
          console.error(`Error en subcarpeta ${folder.name}:`, subError.message)
          // Continuar con las demás carpetas
        }
      }
    }

    if (onProgress) onProgress({ 
      status: 'complete', 
      files: files.length, 
      folders: processedFolders.length 
    })

    return { files, folders: processedFolders }
    
  } catch (error) {
    console.error('Error listing Drive folder:', error)
    throw error
  }
}

/**
 * Descarga un archivo de Google Drive
 */
export async function downloadDriveFile(fileId, mimeType) {
  if (!GOOGLE_DRIVE_API_KEY) {
    throw new Error('GOOGLE_DRIVE_API_KEY no configurada')
  }

  try {
    // Para Google Docs, Sheets, etc. necesitamos exportar
    const googleDocTypes = {
      'application/vnd.google-apps.document': 'application/pdf',
      'application/vnd.google-apps.spreadsheet': 'application/pdf',
      'application/vnd.google-apps.presentation': 'application/pdf'
    }

    let url
    let exportMimeType = null

    if (googleDocTypes[mimeType]) {
      // Exportar Google Doc como PDF
      exportMimeType = googleDocTypes[mimeType]
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}&key=${GOOGLE_DRIVE_API_KEY}`
    } else {
      // Descargar archivo normal
      url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_DRIVE_API_KEY}`
    }

    const response = await fetchWithRetry(url)

    if (!response.ok) {
      const error = await response.text()
      console.error('Download error:', error)
      throw new Error(`Error descargando archivo: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    return {
      buffer: Buffer.from(buffer),
      mimeType: exportMimeType || mimeType
    }
  } catch (error) {
    console.error('Error downloading file:', error)
    throw error
  }
}

/**
 * Detecta el tipo de documento basado en el nombre y carpeta
 */
export function detectDocumentType(fileName, folderName = '') {
  const lowerName = fileName.toLowerCase()
  const lowerFolder = folderName.toLowerCase()
  
  // Detectar por carpeta primero
  if (lowerFolder.includes('carta') || lowerFolder.includes('recomendacion') || lowerFolder.includes('interes')) {
    return 'Carta de Recomendación'
  }
  if (lowerFolder.includes('evidencia') || lowerFolder.includes('profesional')) {
    return 'Evidencia Profesional'
  }
  if (lowerFolder.includes('personal')) {
    return 'Documento Personal'
  }
  if (lowerFolder.includes('traduccion')) {
    return 'Traducción'
  }
  if (lowerFolder.includes('estadistica')) {
    return 'Estadísticas'
  }
  
  // Detectar por nombre de archivo
  if (lowerName.includes('rfe') || lowerName.includes('request for evidence')) {
    return 'RFE'
  }
  if (lowerName.includes('noid') || lowerName.includes('notice of intent')) {
    return 'NOID'
  }
  if (lowerName.includes('denial') || lowerName.includes('denied')) {
    return 'Denial'
  }
  if (lowerName.includes('petition') || lowerName.includes('peticion')) {
    return 'Petition Letter'
  }
  if (lowerName.includes('business') || lowerName.includes('plan')) {
    return 'Business Plan'
  }
  if (lowerName.includes('cv') || lowerName.includes('resume') || lowerName.includes('curriculum')) {
    return 'CV/Resume'
  }
  if (lowerName.includes('carta') || lowerName.includes('letter') || lowerName.includes('recommendation')) {
    return 'Carta de Recomendación'
  }
  if (lowerName.includes('patent') || lowerName.includes('patente')) {
    return 'Patente'
  }
  if (lowerName.includes('publication') || lowerName.includes('paper') || lowerName.includes('article')) {
    return 'Publicación'
  }
  if (lowerName.includes('contrato') || lowerName.includes('contract')) {
    return 'Contrato'
  }
  if (lowerName.includes('diploma') || lowerName.includes('degree') || lowerName.includes('titulo')) {
    return 'Diploma/Título'
  }
  if (lowerName.includes('passport') || lowerName.includes('pasaporte')) {
    return 'Pasaporte'
  }
  if (lowerName.includes('i-140') || lowerName.includes('i140')) {
    return 'Formulario I-140'
  }
  
  // Por extensión
  if (lowerName.endsWith('.pdf')) return 'Documento PDF'
  if (lowerName.endsWith('.doc') || lowerName.endsWith('.docx')) return 'Documento Word'
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.png') || lowerName.endsWith('.jpeg')) return 'Imagen'
  
  return 'Otro'
}

/**
 * Filtra archivos procesables (excluye imágenes, videos, etc.)
 */
export function filterProcessableFiles(files) {
  const processableTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.google-apps.document',
    'text/plain',
    'application/rtf'
  ]
  
  const processableExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf']
  
  return files.filter(file => {
    // Por MIME type
    if (processableTypes.includes(file.mimeType)) return true
    
    // Por extensión
    const lowerName = file.name.toLowerCase()
    return processableExtensions.some(ext => lowerName.endsWith(ext))
  })
}
