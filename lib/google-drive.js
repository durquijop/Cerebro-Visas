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
 * Lista todos los archivos en una carpeta de Drive (incluyendo subcarpetas)
 */
export async function listDriveFolder(folderId, recursive = true) {
  if (!GOOGLE_DRIVE_API_KEY) {
    throw new Error('GOOGLE_DRIVE_API_KEY no configurada')
  }

  const files = []
  const folders = []
  
  try {
    // Listar archivos en la carpeta
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&key=${GOOGLE_DRIVE_API_KEY}&fields=files(id,name,mimeType,size,modifiedTime,parents)&pageSize=1000`,
      { method: 'GET' }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Drive API error:', error)
      throw new Error(`Error de Google Drive: ${response.status}`)
    }

    const data = await response.json()
    
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

    // Si es recursivo, listar subcarpetas
    if (recursive) {
      for (const folder of folders) {
        console.log(`📁 Explorando subcarpeta: ${folder.name}`)
        const subFiles = await listDriveFolder(folder.id, true)
        
        // Agregar path de la carpeta padre
        for (const subFile of subFiles.files) {
          subFile.path = `${folder.name}/${subFile.path}`
          subFile.parentFolderName = folder.name
          files.push(subFile)
        }
        
        for (const subFolder of subFiles.folders) {
          subFolder.path = `${folder.name}/${subFolder.path}`
          folders.push(subFolder)
        }
      }
    }

    return { files, folders }
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

    const response = await fetch(url)

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
