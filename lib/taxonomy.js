// ===========================================
// TAXONOMÍA DE CRITERIOS PARA VISAS EB2-NIW y EB1A
// Estructura: VISA.CRITERIO.MOTIVO_ESPECÍFICO
// ===========================================

export const TAXONOMY = {
  // =============================================
  // NIW - National Interest Waiver (Dhanasar Framework)
  // Test de 3 Prongs
  // =============================================
  NIW: {
    name: 'EB-2 National Interest Waiver',
    description: 'Visa basada en el test Dhanasar de 3 prongs',
    criteria_type: 'prongs', // Debe cumplir los 3 prongs
    prongs: {
      P1: {
        name: 'Prong 1 - Mérito Sustancial e Importancia Nacional',
        description: 'El endeavor propuesto tiene mérito sustancial e importancia nacional',
        required: true,
        issues: {
          IMPORTANCIA_NO_DEMOSTRADA: {
            code: 'NIW.P1.IMPORTANCIA_NO_DEMOSTRADA',
            label: 'Importancia nacional no demostrada',
            severity: 'critical',
            description: 'No se demuestra cómo el trabajo beneficia a EE.UU. más allá del empleador',
            remediation: 'Agregar evidencia de impacto a nivel nacional: estadísticas, estudios de mercado, cartas de expertos del sector'
          },
          IMPACTO_LOCAL: {
            code: 'NIW.P1.IMPACTO_LOCAL',
            label: 'Impacto descrito como local/regional',
            severity: 'high',
            description: 'El oficial considera que el impacto es solo local o regional',
            remediation: 'Demostrar alcance nacional: clientes en múltiples estados, impacto en industria nacional, datos de mercado'
          },
          MERITO_INSUFICIENTE: {
            code: 'NIW.P1.MERITO_INSUFICIENTE',
            label: 'Mérito sustancial insuficiente',
            severity: 'high',
            description: 'No se establece el mérito intrínseco del endeavor',
            remediation: 'Explicar por qué el trabajo es valioso: problema que resuelve, necesidad del mercado, impacto social'
          },
          ENDEAVOR_VAGO: {
            code: 'NIW.P1.ENDEAVOR_VAGO',
            label: 'Endeavor descrito vagamente',
            severity: 'medium',
            description: 'La descripción del trabajo propuesto es demasiado general',
            remediation: 'Definir endeavor específico: actividades concretas, objetivos medibles, plan de acción detallado'
          },
          BENEFICIO_ECONOMICO_NO_CUANTIFICADO: {
            code: 'NIW.P1.BENEFICIO_ECONOMICO_NO_CUANTIFICADO',
            label: 'Beneficio económico no cuantificado',
            severity: 'medium',
            description: 'Falta cuantificación del impacto económico',
            remediation: 'Incluir estudio econométrico, proyecciones financieras con metodología, datos de mercado'
          },
          AREA_NO_PRIORITARIA: {
            code: 'NIW.P1.AREA_NO_PRIORITARIA',
            label: 'Área no considerada prioritaria',
            severity: 'medium',
            description: 'El campo no se considera de interés nacional',
            remediation: 'Conectar con prioridades nacionales: salud, tecnología, energía, seguridad, educación'
          }
        }
      },
      P2: {
        name: 'Prong 2 - Bien Posicionado para Avanzar',
        description: 'El beneficiario está bien posicionado para avanzar el endeavor propuesto',
        required: true,
        issues: {
          CALIFICACIONES_INSUFICIENTES: {
            code: 'NIW.P2.CALIFICACIONES_INSUFICIENTES',
            label: 'Calificaciones insuficientes',
            severity: 'critical',
            description: 'Educación o experiencia no demuestran capacidad',
            remediation: 'Destacar grados avanzados, certificaciones, años de experiencia relevante'
          },
          TRACCION_INSUFICIENTE: {
            code: 'NIW.P2.TRACCION_INSUFICIENTE',
            label: 'Tracción/progreso insuficiente',
            severity: 'high',
            description: 'Falta evidencia de logros o progreso en el campo',
            remediation: 'Mostrar track record: proyectos completados, clientes, contratos, premios'
          },
          PLAN_NO_VIABLE: {
            code: 'NIW.P2.PLAN_NO_VIABLE',
            label: 'Plan no viable o especulativo',
            severity: 'high',
            description: 'El plan de trabajo parece especulativo',
            remediation: 'Presentar business plan sólido, cartas de intención, contratos, financiamiento asegurado'
          },
          RECURSOS_NO_DEMOSTRADOS: {
            code: 'NIW.P2.RECURSOS_NO_DEMOSTRADOS',
            label: 'Recursos/financiamiento no demostrados',
            severity: 'medium',
            description: 'No hay evidencia de recursos para ejecutar el plan',
            remediation: 'Mostrar capital, inversores, grants, líneas de crédito, partnerships'
          },
          CARTAS_GENERICAS: {
            code: 'NIW.P2.CARTAS_GENERICAS',
            label: 'Cartas de recomendación genéricas',
            severity: 'medium',
            description: 'Las cartas no abordan específicamente las capacidades',
            remediation: 'Obtener cartas específicas que mencionen logros concretos y capacidad única'
          },
          PUBLICACIONES_INSUFICIENTES: {
            code: 'NIW.P2.PUBLICACIONES_INSUFICIENTES',
            label: 'Publicaciones/citas insuficientes',
            severity: 'medium',
            description: 'Historial de publicaciones o citas no demuestra impacto',
            remediation: 'Incluir métricas de citaciones, factor de impacto, publicaciones en journals reconocidos'
          },
          EXPERIENCIA_NO_RELEVANTE: {
            code: 'NIW.P2.EXPERIENCIA_NO_RELEVANTE',
            label: 'Experiencia no relevante al endeavor',
            severity: 'medium',
            description: 'La experiencia laboral no conecta con el endeavor propuesto',
            remediation: 'Establecer conexión clara entre experiencia pasada y endeavor futuro'
          },
          SIN_INTERES_TERCEROS: {
            code: 'NIW.P2.SIN_INTERES_TERCEROS',
            label: 'Sin interés demostrado de terceros',
            severity: 'medium',
            description: 'No hay cartas de clientes, inversores o gobierno interesados',
            remediation: 'Obtener cartas de interés de potenciales clientes, inversores, agencias gubernamentales'
          }
        }
      },
      P3: {
        name: 'Prong 3 - Balance de Factores (Waiver)',
        description: 'En balance, sería beneficioso para EE.UU. eximir el requisito de oferta laboral',
        required: true,
        issues: {
          TRABAJADORES_US_DISPONIBLES: {
            code: 'NIW.P3.TRABAJADORES_US_DISPONIBLES',
            label: 'Trabajadores US disponibles',
            severity: 'critical',
            description: 'No se demuestra por qué un trabajador US no podría hacerlo',
            remediation: 'Demostrar habilidades únicas, escasez de talento, datos de mercado laboral'
          },
          BENEFICIO_WAIVER_NO_DEMOSTRADO: {
            code: 'NIW.P3.BENEFICIO_WAIVER_NO_DEMOSTRADO',
            label: 'Beneficio del waiver no demostrado',
            severity: 'high',
            description: 'No se explica por qué el waiver beneficia a EE.UU.',
            remediation: 'Argumentar urgencia, impacto negativo de delay, beneficio inmediato'
          },
          URGENCIA_NO_ESTABLECIDA: {
            code: 'NIW.P3.URGENCIA_NO_ESTABLECIDA',
            label: 'Urgencia no establecida',
            severity: 'medium',
            description: 'No hay argumento de por qué el trabajo es urgente',
            remediation: 'Mostrar oportunidades time-sensitive, ventanas de mercado, necesidad inmediata'
          },
          PERJUICIO_TRABAJADORES: {
            code: 'NIW.P3.PERJUICIO_TRABAJADORES',
            label: 'Perjuicio a trabajadores US no descartado',
            severity: 'medium',
            description: 'No se descarta que perjudique a trabajadores estadounidenses',
            remediation: 'Demostrar que el trabajo crea empleo, no desplaza trabajadores US'
          }
        }
      }
    },
    evidence_types: {
      CARTAS_RECOMENDACION: 'Cartas de recomendación de expertos independientes',
      BUSINESS_PLAN: 'Plan de negocios con proyecciones y metodología',
      ESTUDIO_ECONOMETRICO: 'Estudio econométrico de impacto',
      PUBLICACIONES: 'Publicaciones académicas y citaciones',
      CONTRATOS: 'Contratos y cartas de intención',
      PREMIOS: 'Premios y reconocimientos en el campo',
      PATENTES: 'Patentes y propiedad intelectual',
      MEDIA: 'Cobertura en medios sobre el trabajo'
    }
  },

  // =============================================
  // EB1A - Extraordinary Ability
  // 10 Criterios - debe cumplir al menos 3
  // =============================================
  EB1A: {
    name: 'EB-1A Extraordinary Ability',
    description: 'Visa para personas con habilidad extraordinaria en ciencias, artes, educación, negocios o atletismo',
    criteria_type: 'criteria', // Debe cumplir 3 de 10 criterios
    min_criteria: 3,
    criteria: {
      C1_PREMIOS: {
        name: 'Criterio 1 - Premios Nacionales/Internacionales',
        description: 'Documentación de premios o reconocimientos de excelencia nacional o internacional',
        issues: {
          PREMIOS_NO_RECONOCIDOS: {
            code: 'EB1A.C1.PREMIOS_NO_RECONOCIDOS',
            label: 'Premios no reconocidos como de excelencia',
            severity: 'high',
            description: 'Los premios presentados no son considerados de nivel nacional o internacional',
            remediation: 'Documentar prestigio del premio: historial, jurado, competencia, cobertura mediática'
          },
          PREMIOS_INSUFICIENTES: {
            code: 'EB1A.C1.PREMIOS_INSUFICIENTES',
            label: 'Premios insuficientes en cantidad o calidad',
            severity: 'medium',
            description: 'Los premios no demuestran excelencia sostenida',
            remediation: 'Agregar más premios o documentar mejor el prestigio de los existentes'
          },
          PREMIOS_NO_RELACIONADOS: {
            code: 'EB1A.C1.PREMIOS_NO_RELACIONADOS',
            label: 'Premios no relacionados al campo de expertise',
            severity: 'medium',
            description: 'Los premios no corresponden al área en que se solicita la visa',
            remediation: 'Incluir premios específicos del campo o explicar conexión'
          }
        }
      },
      C2_MEMBRESIAS: {
        name: 'Criterio 2 - Membresías en Asociaciones Exclusivas',
        description: 'Membresía en asociaciones que requieren logros destacados para admisión',
        issues: {
          MEMBRESIA_NO_EXCLUSIVA: {
            code: 'EB1A.C2.MEMBRESIA_NO_EXCLUSIVA',
            label: 'Membresía no requiere logros destacados',
            severity: 'high',
            description: 'La asociación no tiene requisitos selectivos de admisión',
            remediation: 'Documentar criterios de admisión, tasa de rechazo, proceso de selección'
          },
          MEMBRESIA_POR_PAGO: {
            code: 'EB1A.C2.MEMBRESIA_POR_PAGO',
            label: 'Membresía obtenida solo por pago',
            severity: 'high',
            description: 'La membresía se obtiene únicamente pagando cuota',
            remediation: 'Demostrar que hubo evaluación de méritos además del pago'
          },
          SIN_DOCUMENTACION_CRITERIOS: {
            code: 'EB1A.C2.SIN_DOCUMENTACION_CRITERIOS',
            label: 'Criterios de admisión no documentados',
            severity: 'medium',
            description: 'No se incluye documentación de los requisitos de la asociación',
            remediation: 'Incluir bylaws, requisitos de admisión, estadísticas de membresía'
          }
        }
      },
      C3_MATERIAL_PUBLICADO: {
        name: 'Criterio 3 - Material Publicado sobre el Beneficiario',
        description: 'Material publicado en medios profesionales o principales sobre el beneficiario',
        issues: {
          MATERIAL_NO_PROFESIONAL: {
            code: 'EB1A.C3.MATERIAL_NO_PROFESIONAL',
            label: 'Material no es de medios profesionales/principales',
            severity: 'high',
            description: 'Las publicaciones no son de medios reconocidos',
            remediation: 'Incluir publicaciones de medios mainstream o trade publications reconocidas'
          },
          MATERIAL_AUTOGENERADO: {
            code: 'EB1A.C3.MATERIAL_AUTOGENERADO',
            label: 'Material generado por el propio beneficiario',
            severity: 'high',
            description: 'Los artículos son autopromocionales, no de terceros independientes',
            remediation: 'Obtener cobertura de periodistas o publicaciones independientes'
          },
          MATERIAL_INSUFICIENTE: {
            code: 'EB1A.C3.MATERIAL_INSUFICIENTE',
            label: 'Cantidad insuficiente de material',
            severity: 'medium',
            description: 'Pocas publicaciones para demostrar reconocimiento',
            remediation: 'Buscar más cobertura mediática o incluir todas las menciones existentes'
          }
        }
      },
      C4_JUEZ: {
        name: 'Criterio 4 - Juez del Trabajo de Otros',
        description: 'Participación como juez del trabajo de otros en el campo',
        issues: {
          ROL_JUEZ_NO_DEMOSTRADO: {
            code: 'EB1A.C4.ROL_JUEZ_NO_DEMOSTRADO',
            label: 'Rol como juez no demostrado',
            severity: 'high',
            description: 'No hay evidencia suficiente de haber juzgado trabajo de otros',
            remediation: 'Incluir invitaciones a revisar, cartas de editores, certificados de revisión'
          },
          JUEZ_INFORMAL: {
            code: 'EB1A.C4.JUEZ_INFORMAL',
            label: 'Rol de juez fue informal o casual',
            severity: 'medium',
            description: 'La evaluación no fue en capacidad formal reconocida',
            remediation: 'Documentar revisiones formales: peer review, paneles de evaluación, competencias'
          },
          POCAS_REVISIONES: {
            code: 'EB1A.C4.POCAS_REVISIONES',
            label: 'Pocas instancias de revisión',
            severity: 'medium',
            description: 'El número de revisiones es insuficiente',
            remediation: 'Documentar más instancias o demostrar la importancia de las realizadas'
          }
        }
      },
      C5_CONTRIBUCIONES: {
        name: 'Criterio 5 - Contribuciones Originales de Importancia Mayor',
        description: 'Contribuciones originales de importancia significativa en el campo',
        issues: {
          CONTRIBUCION_NO_ORIGINAL: {
            code: 'EB1A.C5.CONTRIBUCION_NO_ORIGINAL',
            label: 'Contribución no es original',
            severity: 'critical',
            description: 'El trabajo no se considera una contribución original',
            remediation: 'Documentar qué es nuevo/único, comparar con estado del arte previo'
          },
          IMPACTO_NO_DEMOSTRADO: {
            code: 'EB1A.C5.IMPACTO_NO_DEMOSTRADO',
            label: 'Impacto de la contribución no demostrado',
            severity: 'critical',
            description: 'No se demuestra que la contribución sea de importancia mayor',
            remediation: 'Incluir citaciones, adopción por otros, cartas de expertos sobre impacto'
          },
          CONTRIBUCION_RUTINARIA: {
            code: 'EB1A.C5.CONTRIBUCION_RUTINARIA',
            label: 'Contribución considerada rutinaria',
            severity: 'high',
            description: 'El trabajo es considerado esperado o rutinario en el campo',
            remediation: 'Explicar por qué va más allá de lo esperado, comparar con trabajo típico'
          },
          SIN_EVIDENCIA_TERCEROS: {
            code: 'EB1A.C5.SIN_EVIDENCIA_TERCEROS',
            label: 'Sin evidencia de terceros sobre importancia',
            severity: 'medium',
            description: 'Solo el beneficiario afirma la importancia',
            remediation: 'Obtener cartas de expertos independientes validando la contribución'
          }
        }
      },
      C6_ARTICULOS: {
        name: 'Criterio 6 - Artículos Académicos/Profesionales',
        description: 'Autoría de artículos académicos en publicaciones profesionales',
        issues: {
          PUBLICACIONES_NO_RECONOCIDAS: {
            code: 'EB1A.C6.PUBLICACIONES_NO_RECONOCIDAS',
            label: 'Publicaciones en journals no reconocidos',
            severity: 'high',
            description: 'Los journals no son considerados profesionales o académicos',
            remediation: 'Incluir publicaciones en journals indexados, con factor de impacto'
          },
          POCAS_PUBLICACIONES: {
            code: 'EB1A.C6.POCAS_PUBLICACIONES',
            label: 'Número insuficiente de publicaciones',
            severity: 'medium',
            description: 'El número de publicaciones no demuestra sostenido trabajo académico',
            remediation: 'Agregar más publicaciones o documentar impacto de las existentes'
          },
          CITACIONES_BAJAS: {
            code: 'EB1A.C6.CITACIONES_BAJAS',
            label: 'Citaciones insuficientes',
            severity: 'medium',
            description: 'Las publicaciones tienen pocas citaciones',
            remediation: 'Explicar contexto del campo, incluir otras métricas de impacto'
          },
          COAUTORIA_MENOR: {
            code: 'EB1A.C6.COAUTORIA_MENOR',
            label: 'Rol de coautoría menor',
            severity: 'medium',
            description: 'El beneficiario no fue autor principal',
            remediation: 'Documentar contribución específica en cada publicación'
          }
        }
      },
      C7_EXHIBICIONES: {
        name: 'Criterio 7 - Exhibiciones Artísticas',
        description: 'Exhibiciones artísticas en eventos de significancia',
        issues: {
          EXHIBICION_NO_SIGNIFICATIVA: {
            code: 'EB1A.C7.EXHIBICION_NO_SIGNIFICATIVA',
            label: 'Exhibición no es de significancia',
            severity: 'high',
            description: 'El venue o evento no es considerado significativo',
            remediation: 'Documentar prestigio del venue, historial, artistas exhibidos'
          },
          EXHIBICION_GRUPAL: {
            code: 'EB1A.C7.EXHIBICION_GRUPAL',
            label: 'Solo exhibiciones grupales',
            severity: 'medium',
            description: 'No hay exhibiciones individuales destacadas',
            remediation: 'Obtener exhibiciones solo o demostrar rol destacado en grupales'
          }
        }
      },
      C8_ROL_PRINCIPAL: {
        name: 'Criterio 8 - Rol Principal en Organizaciones Distinguidas',
        description: 'Desempeño de rol principal o crítico en organizaciones distinguidas',
        issues: {
          ROL_NO_PRINCIPAL: {
            code: 'EB1A.C8.ROL_NO_PRINCIPAL',
            label: 'Rol no es principal o crítico',
            severity: 'high',
            description: 'El puesto no es considerado de liderazgo significativo',
            remediation: 'Documentar responsabilidades, reportes directos, impacto de decisiones'
          },
          ORGANIZACION_NO_DISTINGUIDA: {
            code: 'EB1A.C8.ORGANIZACION_NO_DISTINGUIDA',
            label: 'Organización no es distinguida',
            severity: 'high',
            description: 'La organización no tiene reputación distinguida',
            remediation: 'Documentar premios de la org, rankings, reconocimiento en industria'
          },
          ROL_CORTO: {
            code: 'EB1A.C8.ROL_CORTO',
            label: 'Tiempo en rol muy corto',
            severity: 'medium',
            description: 'El período en el puesto es muy breve',
            remediation: 'Documentar logros específicos durante el período'
          }
        }
      },
      C9_SALARIO_ALTO: {
        name: 'Criterio 9 - Salario Alto o Remuneración',
        description: 'Salario alto o remuneración significativa en comparación con otros',
        issues: {
          SALARIO_NO_ALTO: {
            code: 'EB1A.C9.SALARIO_NO_ALTO',
            label: 'Salario no es significativamente alto',
            severity: 'high',
            description: 'El salario no es distinguido comparado con peers',
            remediation: 'Incluir datos de mercado, percentil del salario, comparaciones documentadas'
          },
          COMPARACION_INADECUADA: {
            code: 'EB1A.C9.COMPARACION_INADECUADA',
            label: 'Comparación salarial inadecuada',
            severity: 'medium',
            description: 'No se compara con el grupo correcto de peers',
            remediation: 'Usar datos de BLS, salary surveys del campo específico'
          },
          SIN_DOCUMENTACION: {
            code: 'EB1A.C9.SIN_DOCUMENTACION',
            label: 'Salario sin documentación',
            severity: 'medium',
            description: 'No hay documentación del salario o contrato',
            remediation: 'Incluir contratos, tax returns, cartas de empleador'
          }
        }
      },
      C10_EXITO_COMERCIAL: {
        name: 'Criterio 10 - Éxito Comercial en Artes',
        description: 'Éxito comercial en artes escénicas demostrado por ventas o ingresos',
        issues: {
          EXITO_NO_DEMOSTRADO: {
            code: 'EB1A.C10.EXITO_NO_DEMOSTRADO',
            label: 'Éxito comercial no demostrado',
            severity: 'high',
            description: 'No hay evidencia de box office, ventas, ratings',
            remediation: 'Incluir datos de ventas, box office, rankings, certificaciones'
          },
          VENTAS_INSUFICIENTES: {
            code: 'EB1A.C10.VENTAS_INSUFICIENTES',
            label: 'Ventas/ingresos insuficientes',
            severity: 'medium',
            description: 'Los números no demuestran éxito significativo',
            remediation: 'Contextualizar con promedios de industria, comparar con peers'
          }
        }
      }
    },
    // Evaluación final EB1A
    final_merits: {
      SUSTAINED_ACCLAIM_NOT_SHOWN: {
        code: 'EB1A.FINAL.SUSTAINED_ACCLAIM',
        label: 'Aclamación sostenida no demostrada',
        severity: 'critical',
        description: 'Aunque cumple criterios, no demuestra nivel de habilidad extraordinaria sostenida',
        remediation: 'Demostrar reconocimiento continuo, no solo logros aislados'
      },
      TOP_OF_FIELD_NOT_SHOWN: {
        code: 'EB1A.FINAL.TOP_OF_FIELD',
        label: 'No demuestra estar en el top del campo',
        severity: 'critical',
        description: 'La evidencia no coloca al beneficiario en el pequeño porcentaje superior',
        remediation: 'Incluir comparaciones directas con peers, rankings, reconocimiento de líderes'
      }
    },
    evidence_types: {
      PREMIOS: 'Certificados de premios y documentación del prestigio',
      MEMBRESIAS: 'Cartas de membresía y criterios de admisión',
      ARTICULOS_SOBRE: 'Artículos publicados sobre el beneficiario',
      PEER_REVIEW: 'Evidencia de revisión de trabajo de otros',
      PUBLICACIONES: 'Artículos publicados por el beneficiario',
      EXHIBICIONES: 'Catálogos y documentación de exhibiciones',
      CONTRATOS: 'Contratos mostrando salario o rol',
      CARTAS_EXPERTOS: 'Cartas de expertos en el campo'
    }
  }
}

// =============================================
// FUNCIONES UTILITARIAS
// =============================================

/**
 * Obtiene la taxonomía completa para un tipo de visa
 */
export function getTaxonomyForVisa(visaType) {
  // Normalizar el tipo de visa
  const normalizedType = visaType?.toUpperCase().replace('-', '').replace(' ', '')
  
  if (normalizedType?.includes('EB1A') || normalizedType?.includes('EB1')) {
    return TAXONOMY.EB1A
  }
  
  // Default a NIW
  return TAXONOMY.NIW
}

/**
 * Obtiene todos los códigos de taxonomía para una visa
 */
export function getAllTaxonomyCodes(visaType = 'NIW') {
  const taxonomy = getTaxonomyForVisa(visaType)
  const codes = []
  
  if (taxonomy.criteria_type === 'prongs') {
    // Para NIW - iterar prongs
    Object.entries(taxonomy.prongs).forEach(([prongKey, prong]) => {
      Object.entries(prong.issues).forEach(([issueKey, issue]) => {
        codes.push({
          code: issue.code,
          label: issue.label,
          severity: issue.severity,
          description: issue.description,
          remediation: issue.remediation,
          prong: prongKey,
          prongName: prong.name
        })
      })
    })
  } else if (taxonomy.criteria_type === 'criteria') {
    // Para EB1A - iterar criterios
    Object.entries(taxonomy.criteria).forEach(([criteriaKey, criteria]) => {
      Object.entries(criteria.issues).forEach(([issueKey, issue]) => {
        codes.push({
          code: issue.code,
          label: issue.label,
          severity: issue.severity,
          description: issue.description,
          remediation: issue.remediation,
          criteria: criteriaKey,
          criteriaName: criteria.name
        })
      })
    })
    // Agregar final merits
    if (taxonomy.final_merits) {
      Object.entries(taxonomy.final_merits).forEach(([key, issue]) => {
        codes.push({
          code: issue.code,
          label: issue.label,
          severity: issue.severity,
          description: issue.description,
          remediation: issue.remediation,
          criteria: 'FINAL',
          criteriaName: 'Evaluación Final'
        })
      })
    }
  }
  
  return codes
}

/**
 * Genera el texto de taxonomía para el prompt del LLM
 */
export function getTaxonomyPrompt(visaType) {
  const codes = getAllTaxonomyCodes(visaType)
  return codes.map(c => `${c.code}: ${c.label}`).join('\n')
}

/**
 * Obtiene el prompt de análisis según el tipo de visa
 */
export function getAnalysisPrompt(visaType) {
  const taxonomy = getTaxonomyForVisa(visaType)
  
  if (visaType?.toUpperCase().includes('EB1A') || visaType?.toUpperCase().includes('EB1')) {
    return {
      system: `Eres un experto en visas EB-1A de Habilidad Extraordinaria.

La visa EB-1A requiere demostrar habilidad extraordinaria en ciencias, artes, educación, negocios o atletismo.

CRITERIOS EB-1A (debe cumplir AL MENOS 3 de 10):
1. Premios nacionales/internacionales de excelencia
2. Membresía en asociaciones que requieren logros destacados
3. Material publicado sobre el beneficiario en medios profesionales
4. Juez del trabajo de otros en el campo
5. Contribuciones originales de importancia mayor al campo
6. Artículos académicos en publicaciones profesionales
7. Exhibiciones artísticas (si aplica)
8. Rol principal en organizaciones distinguidas
9. Salario alto comparado con otros en el campo
10. Éxito comercial en artes escénicas (si aplica)

ADEMÁS debe demostrar:
- Aclamación nacional o internacional SOSTENIDA
- Estar en el pequeño porcentaje TOP de su campo

Analiza con estos criterios específicos.`,
      criteria_explanation: `
Los 10 criterios EB-1A son:
C1_PREMIOS: Premios de excelencia nacional/internacional
C2_MEMBRESIAS: Membresías en asociaciones exclusivas
C3_MATERIAL_PUBLICADO: Artículos sobre el beneficiario en medios
C4_JUEZ: Participación como juez de trabajo de otros
C5_CONTRIBUCIONES: Contribuciones originales de importancia mayor
C6_ARTICULOS: Publicaciones académicas/profesionales
C7_EXHIBICIONES: Exhibiciones artísticas (si aplica)
C8_ROL_PRINCIPAL: Rol de liderazgo en organizaciones distinguidas
C9_SALARIO_ALTO: Salario significativamente alto
C10_EXITO_COMERCIAL: Éxito comercial en artes (si aplica)`
    }
  }
  
  // Default NIW
  return {
    system: `Eres un experto en visas EB-2 NIW (National Interest Waiver).

La visa EB-2 NIW usa el test DHANASAR de 3 PRONGS:

PRONG 1 - Mérito Sustancial e Importancia Nacional:
- ¿El endeavor propuesto tiene mérito intrínseco?
- ¿Es de importancia a nivel NACIONAL (no solo local)?

PRONG 2 - Bien Posicionado:
- ¿El beneficiario tiene las calificaciones necesarias?
- ¿Tiene track record de éxito?
- ¿Tiene un plan viable?
- ¿Tiene recursos/apoyo?

PRONG 3 - Balance (Waiver del Labor Certification):
- ¿Por qué sería beneficioso para EE.UU. eximir el labor cert?
- ¿Hay urgencia o razón para no esperar el proceso normal?

Analiza con estos 3 prongs específicos.`,
    criteria_explanation: `
Los 3 Prongs del test Dhanasar para NIW:
P1: Mérito Sustancial e Importancia Nacional
P2: Beneficiario Bien Posicionado para Avanzar el Endeavor
P3: Balance de Factores favorece el Waiver`
  }
}

/**
 * Obtiene detalles de un código específico
 */
export function getTaxonomyDetails(code) {
  if (!code) return null
  
  const parts = code.split('.')
  if (parts.length < 3) return null
  
  const visaType = parts[0]
  const taxonomy = getTaxonomyForVisa(visaType)
  
  // Buscar en todas las categorías
  const allCodes = getAllTaxonomyCodes(visaType)
  return allCodes.find(c => c.code === code) || null
}

// Exportar lista simple para compatibilidad
export const TAXONOMY_CODES_FOR_PROMPT = getTaxonomyPrompt('NIW')
