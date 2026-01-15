// ===========================================
// TAXONOMÍA DE MOTIVOS PARA EB-2 NIW
// Estructura: VISA.PRONG.MOTIVO_ESPECÍFICO
// ===========================================

export const TAXONOMY = {
  // NIW - National Interest Waiver (Dhanasar Framework)
  NIW: {
    name: 'EB-2 National Interest Waiver',
    prongs: {
      P1: {
        name: 'Mérito Sustancial e Importancia Nacional',
        description: 'El endeavor propuesto tiene mérito sustancial e importancia nacional',
        issues: {
          IMPORTANCIA_NO_DEMOSTRADA: {
            code: 'NIW.P1.IMPORTANCIA_NO_DEMOSTRADA',
            label: 'Importancia nacional no demostrada',
            severity: 'critical',
            description: 'No se demuestra cómo el trabajo beneficia a EE.UU. más allá del empleador'
          },
          IMPACTO_LOCAL: {
            code: 'NIW.P1.IMPACTO_LOCAL',
            label: 'Impacto descrito como local/regional',
            severity: 'high',
            description: 'El oficial considera que el impacto es solo local o regional'
          },
          MERITO_INSUFICIENTE: {
            code: 'NIW.P1.MERITO_INSUFICIENTE',
            label: 'Mérito sustancial insuficiente',
            severity: 'high',
            description: 'No se establece el mérito intrínseco del endeavor'
          },
          ENDEAVOR_VAGO: {
            code: 'NIW.P1.ENDEAVOR_VAGO',
            label: 'Endeavor descrito vagamente',
            severity: 'medium',
            description: 'La descripción del trabajo propuesto es demasiado general'
          },
          BENEFICIO_ECONOMICO_NO_CUANTIFICADO: {
            code: 'NIW.P1.BENEFICIO_ECONOMICO_NO_CUANTIFICADO',
            label: 'Beneficio económico no cuantificado',
            severity: 'medium',
            description: 'Falta cuantificación del impacto económico'
          },
          AREA_NO_PRIORITARIA: {
            code: 'NIW.P1.AREA_NO_PRIORITARIA',
            label: 'Área no considerada prioritaria',
            severity: 'medium',
            description: 'El campo no se considera de interés nacional'
          }
        }
      },
      P2: {
        name: 'Bien Posicionado para Avanzar',
        description: 'El beneficiario está bien posicionado para avanzar el endeavor propuesto',
        issues: {
          CALIFICACIONES_INSUFICIENTES: {
            code: 'NIW.P2.CALIFICACIONES_INSUFICIENTES',
            label: 'Calificaciones insuficientes',
            severity: 'critical',
            description: 'Educación o experiencia no demuestran capacidad'
          },
          TRACCION_INSUFICIENTE: {
            code: 'NIW.P2.TRACCION_INSUFICIENTE',
            label: 'Tracción/progreso insuficiente',
            severity: 'high',
            description: 'Falta evidencia de logros o progreso en el campo'
          },
          PLAN_NO_VIABLE: {
            code: 'NIW.P2.PLAN_NO_VIABLE',
            label: 'Plan no viable o especulativo',
            severity: 'high',
            description: 'El plan de trabajo parece especulativo'
          },
          RECURSOS_NO_DEMOSTRADOS: {
            code: 'NIW.P2.RECURSOS_NO_DEMOSTRADOS',
            label: 'Recursos/financiamiento no demostrados',
            severity: 'medium',
            description: 'No hay evidencia de recursos para ejecutar el plan'
          },
          CARTAS_GENERICAS: {
            code: 'NIW.P2.CARTAS_GENERICAS',
            label: 'Cartas de recomendación genéricas',
            severity: 'medium',
            description: 'Las cartas no abordan específicamente las capacidades'
          },
          PUBLICACIONES_INSUFICIENTES: {
            code: 'NIW.P2.PUBLICACIONES_INSUFICIENTES',
            label: 'Publicaciones/citas insuficientes',
            severity: 'medium',
            description: 'Historial de publicaciones o citas no demuestra impacto'
          },
          EXPERIENCIA_NO_RELEVANTE: {
            code: 'NIW.P2.EXPERIENCIA_NO_RELEVANTE',
            label: 'Experiencia no relevante al endeavor',
            severity: 'medium',
            description: 'La experiencia laboral no conecta con el endeavor propuesto'
          }
        }
      },
      P3: {
        name: 'Balance de Factores (Waiver del Labor Cert)',
        description: 'En balance, sería beneficioso para EE.UU. eximir el requisito de oferta laboral',
        issues: {
          TRABAJADORES_US_DISPONIBLES: {
            code: 'NIW.P3.TRABAJADORES_US_DISPONIBLES',
            label: 'Trabajadores US disponibles',
            severity: 'critical',
            description: 'No se demuestra por qué un trabajador US no podría hacerlo'
          },
          BENEFICIO_WAIVER_NO_DEMOSTRADO: {
            code: 'NIW.P3.BENEFICIO_WAIVER_NO_DEMOSTRADO',
            label: 'Beneficio del waiver no demostrado',
            severity: 'high',
            description: 'No se explica por qué el waiver beneficia a EE.UU.'
          },
          URGENCIA_NO_ESTABLECIDA: {
            code: 'NIW.P3.URGENCIA_NO_ESTABLECIDA',
            label: 'Urgencia no establecida',
            severity: 'medium',
            description: 'No hay argumento de por qué el trabajo es urgente'
          },
          IMPACTO_LABOR_CERT_NO_EXPLICADO: {
            code: 'NIW.P3.IMPACTO_LABOR_CERT_NO_EXPLICADO',
            label: 'Impacto negativo del labor cert no explicado',
            severity: 'medium',
            description: 'No se explica cómo el proceso de labor cert afectaría negativamente'
          }
        }
      }
    }
  }
}

// Función para obtener todos los códigos de taxonomía
export function getAllTaxonomyCodes() {
  const codes = []
  Object.entries(TAXONOMY).forEach(([visa, visaData]) => {
    Object.entries(visaData.prongs).forEach(([prongKey, prong]) => {
      Object.entries(prong.issues).forEach(([issueKey, issue]) => {
        codes.push({
          code: issue.code,
          label: issue.label,
          severity: issue.severity,
          prong: prong.name,
          visa: visaData.name
        })
      })
    })
  })
  return codes
}

// Función para obtener detalles de un código específico
export function getTaxonomyDetails(code) {
  const parts = code.split('.')
  if (parts.length !== 3) return null
  
  const [visa, prong, issue] = parts
  const visaData = TAXONOMY[visa]
  if (!visaData) return null
  
  const prongData = visaData.prongs[prong]
  if (!prongData) return null
  
  const issueData = prongData.issues[issue]
  if (!issueData) return null
  
  return {
    ...issueData,
    prongName: prongData.name,
    prongDescription: prongData.description,
    visaName: visaData.name
  }
}

// Lista de códigos para el prompt del LLM
export const TAXONOMY_CODES_FOR_PROMPT = getAllTaxonomyCodes().map(t => t.code).join(', ')
