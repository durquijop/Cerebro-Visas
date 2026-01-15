// Checklist de entregables para casos NIW
export const NIW_CHECKLIST = [
  {
    category: 'Formularios USCIS',
    icon: '📋',
    color: 'blue',
    items: [
      {
        id: 'i140',
        name: 'Formulario I-140 (Petition for Alien Worker)',
        required: true,
        instructions: [
          'Confirmar que esté completo',
          'Verificar que la página 6 esté firmada a mano por el beneficiario',
          'Asegurar que la fecha esté escrita junto a la firma',
          'Usar bolígrafo NEGRO',
          'Solo enviar a imprimir cuando la firma esté visible y legible'
        ],
        doc_type: 'i140'
      },
      {
        id: 'i907',
        name: 'Formulario I-907 (Premium Processing)',
        required: false,
        instructions: [
          'Verificar que esté completo',
          'Confirmar que la página 4 esté firmada a mano y fechada',
          'Usar siempre bolígrafo NEGRO',
          'No enviar a imprimir sin esta firma'
        ],
        doc_type: 'i907'
      },
      {
        id: 'g1450',
        name: 'Formulario G-1450 (Authorization Credit Card)',
        required: true,
        instructions: [
          'Confirmar que esté firmado a mano por el titular de la tarjeta',
          'Revisar que el monto autorizado ($3,820.00) sea correcto si es Premium Processing',
          'Verificar datos: tarjeta, dirección, teléfono y correo electrónico',
          'Firma debe estar hecha con bolígrafo NEGRO'
        ],
        doc_type: 'g1450'
      },
      {
        id: 'g1145',
        name: 'Formulario G-1145 (E-Notification)',
        required: true,
        instructions: [
          'Verificar que esté completo con email correcto'
        ],
        doc_type: 'g1145'
      }
    ]
  },
  {
    category: 'Documentos de Inmigración',
    icon: '🛂',
    color: 'green',
    items: [
      {
        id: 'i94',
        name: 'I-94 (Registro de Entrada)',
        required: true,
        instructions: [
          'Descargar del sitio oficial de CBP',
          'Verificar que esté vigente'
        ],
        doc_type: 'i94'
      },
      {
        id: 'passport',
        name: 'Pasaporte (página biográfica + visas relevantes)',
        required: true,
        instructions: [
          'Incluir página biográfica completa',
          'Incluir todas las visas relevantes',
          'Verificar vigencia del pasaporte'
        ],
        doc_type: 'passport'
      },
      {
        id: 'current_visa',
        name: 'Visa actual/anterior',
        required: true,
        instructions: [
          'Incluir copia de visa actual',
          'Si aplica, incluir visas anteriores relevantes'
        ],
        doc_type: 'visa'
      }
    ]
  },
  {
    category: 'Carta de Autopetición NIW',
    icon: '📝',
    color: 'purple',
    items: [
      {
        id: 'niw_letter',
        name: 'Carta de Autopetición NIW Completa',
        required: true,
        instructions: [
          'Verificar que cubra los 3 Prongs de Dhanasar',
          'Prong 1: Mérito sustancial e importancia nacional',
          'Prong 2: Bien posicionado para avanzar el endeavor',
          'Prong 3: Balance test - beneficio del waiver',
          'Incluir citas a evidencia específica'
        ],
        doc_type: 'cover_letter'
      }
    ]
  },
  {
    category: 'Project Documentation',
    icon: '📊',
    color: 'orange',
    items: [
      {
        id: 'policy_paper',
        name: '1.1 Policy Paper',
        required: false,
        instructions: ['Documento de política pública si aplica'],
        doc_type: 'policy_paper'
      },
      {
        id: 'white_paper',
        name: '1.2 White Paper',
        required: false,
        instructions: ['Documento técnico del proyecto'],
        doc_type: 'white_paper'
      },
      {
        id: 'econometric',
        name: '1.3 Econometric Study',
        required: false,
        instructions: ['Estudio econométrico con proyecciones de impacto'],
        doc_type: 'econometric'
      },
      {
        id: 'mvp',
        name: '1.4 MVP (Minimum Viable Product)',
        required: false,
        instructions: ['Documentación del producto mínimo viable'],
        doc_type: 'mvp'
      },
      {
        id: 'patent',
        name: '1.5 Patent Documentation',
        required: false,
        instructions: ['Patentes o solicitudes de patente si aplica'],
        doc_type: 'patent'
      },
      {
        id: 'libro',
        name: '1.6 Libro/Publicaciones',
        required: false,
        instructions: ['Libros o publicaciones del beneficiario'],
        doc_type: 'publication'
      }
    ]
  },
  {
    category: 'Curriculum Vitae',
    icon: '📄',
    color: 'teal',
    items: [
      {
        id: 'cv',
        name: 'Curriculum Vitae',
        required: true,
        instructions: [
          'CV completo y actualizado',
          'Incluir educación, experiencia, publicaciones, premios',
          'Formato profesional en inglés'
        ],
        doc_type: 'cv'
      }
    ]
  },
  {
    category: 'Certificates of Study',
    icon: '🎓',
    color: 'indigo',
    items: [
      {
        id: 'titles',
        name: 'Títulos Académicos',
        required: true,
        instructions: [
          'Incluir todos los títulos universitarios',
          'Traducciones certificadas al inglés'
        ],
        doc_type: 'degree'
      },
      {
        id: 'certificates',
        name: 'Certificados Académicos',
        required: true,
        instructions: [
          'Certificados de notas/calificaciones',
          'Traducción certificada al inglés'
        ],
        doc_type: 'certificate'
      }
    ]
  },
  {
    category: 'Expert Evaluation Letter',
    icon: '🔬',
    color: 'pink',
    items: [
      {
        id: 'expert_eval',
        name: 'Carta de Evaluación Experta',
        required: true,
        instructions: [
          'Firmada por el experto',
          'Incluir hoja de vida del experto',
          'Incluir identificación del experto',
          'El experto debe ser independiente del beneficiario'
        ],
        doc_type: 'expert_evaluation'
      }
    ]
  },
  {
    category: 'Recommendation Letters',
    icon: '✉️',
    color: 'yellow',
    items: [
      {
        id: 'recommendation_letters',
        name: 'Cartas de Recomendación de Expertos',
        required: true,
        instructions: [
          'Firmadas por cada recomendador',
          'Incluir credenciales de cada recomendador',
          'Mínimo 5-6 cartas recomendadas',
          'Al menos algunas de expertos independientes',
          'Deben hablar específicamente del trabajo del beneficiario'
        ],
        doc_type: 'recommendation'
      }
    ]
  },
  {
    category: 'Employment Certificate Letters',
    icon: '💼',
    color: 'gray',
    items: [
      {
        id: 'employment_letters',
        name: 'Cartas Laborales',
        required: true,
        instructions: [
          'Fechas de empleo claras',
          'Cargo desempeñado',
          'Funciones y responsabilidades detalladas',
          'En papel membretado de la empresa',
          'Firmadas por supervisor o HR'
        ],
        doc_type: 'employment'
      }
    ]
  },
  {
    category: 'Letter of Intent',
    icon: '🎯',
    color: 'red',
    items: [
      {
        id: 'intent_letter',
        name: 'Carta de Intención',
        required: true,
        instructions: [
          'Firmada por el beneficiario',
          'Incluir hoja de vida',
          'Incluir identificación',
          'Describir planes futuros en EE.UU.'
        ],
        doc_type: 'intent_letter'
      }
    ]
  },
  {
    category: 'Documents of My Family',
    icon: '👨‍👩‍👧‍👦',
    color: 'cyan',
    items: [
      {
        id: 'family_i94',
        name: 'I-94 Familiares',
        required: false,
        instructions: [
          'I-94 de cónyuge e hijos si aplica'
        ],
        doc_type: 'family_i94'
      },
      {
        id: 'family_passports',
        name: 'Pasaportes Familiares',
        required: false,
        instructions: [
          'Páginas biográficas de familiares'
        ],
        doc_type: 'family_passport'
      },
      {
        id: 'family_visas',
        name: 'Visas Familiares',
        required: false,
        instructions: [
          'Copias de visas de familiares'
        ],
        doc_type: 'family_visa'
      }
    ]
  },
  {
    category: 'Traducciones',
    icon: '🌐',
    color: 'emerald',
    items: [
      {
        id: 'translations',
        name: 'Documentos Traducidos al Inglés',
        required: true,
        instructions: [
          'Todos los documentos en otro idioma deben tener traducción certificada',
          'Incluir certificación del traductor',
          'El traductor debe declarar competencia en ambos idiomas'
        ],
        doc_type: 'translation'
      }
    ]
  }
]

// Función para obtener el checklist con estado
export function getChecklistWithStatus(uploadedDocs = []) {
  const uploadedTypes = uploadedDocs.map(d => d.doc_type)
  
  return NIW_CHECKLIST.map(category => ({
    ...category,
    items: category.items.map(item => ({
      ...item,
      status: uploadedTypes.includes(item.doc_type) ? 'uploaded' : 'pending',
      uploadedDoc: uploadedDocs.find(d => d.doc_type === item.doc_type)
    }))
  }))
}

// Calcular progreso del checklist
export function calculateChecklistProgress(uploadedDocs = []) {
  const allItems = NIW_CHECKLIST.flatMap(c => c.items)
  const requiredItems = allItems.filter(i => i.required)
  const uploadedTypes = uploadedDocs.map(d => d.doc_type)
  
  const uploadedRequired = requiredItems.filter(i => uploadedTypes.includes(i.doc_type))
  
  return {
    total: allItems.length,
    uploaded: uploadedDocs.length,
    required: requiredItems.length,
    requiredUploaded: uploadedRequired.length,
    percentage: Math.round((uploadedRequired.length / requiredItems.length) * 100)
  }
}
