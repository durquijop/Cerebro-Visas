# Cerebro Visas — Reporte Comprehensivo de la Aplicación

## Tipo de Solución
**Plataforma web de inteligencia artificial** para abogados de inmigración, especializada en el análisis, gestión y optimización de casos de visa EB-2 NIW (National Interest Waiver) y EB-1A (Extraordinary Ability).

**Página Web:** Sistema integral que combina gestión documental, análisis con IA, detección de tendencias y asistente conversacional (RAG) en una sola plataforma.

**Fecha de inicio:** Diciembre 2024

---

## Estado Actual

Actualmente se tiene un sistema robusto donde abogados de inmigración, drafters y analistas pueden gestionar con eficiencia sus casos de visa utilizando inteligencia artificial avanzada. A continuación se detalla cada área funcional:

---

### 1. Landing Page y Autenticación

Al entrar a la plataforma, el usuario ve una landing page profesional con tema navy/gold que presenta las 4 capacidades principales del sistema: **Análisis Inteligente**, **Tendencias en Tiempo Real**, **Taxonomía Estructurada** y **Auditoría de Expedientes**. Se muestran los 4 roles del sistema (Admin, Attorney, Drafter, Analyst) y se ofrece registro/login.

La autenticación se maneja completamente mediante **Supabase Auth** con:
- Registro con email y contraseña
- Verificación por email
- Callback de autenticación
- Middleware de protección de rutas
- Perfil de usuario con roles (admin, attorney, drafter, analyst) almacenado en tabla `profiles`

---

### 2. Dashboard Principal con Chat RAG

Al entrar al dashboard, el usuario ve un panel personalizado según su rol con:

- **Estadísticas en tiempo real**: Total de casos registrados, total de documentos procesados y rol del usuario
- **Acciones rápidas basadas en rol**:
  - **Admin**: Gestionar Usuarios, Taxonomía, Tendencias, Drift Detector, Prompt Analyzer, Drive Import, Subir Documento, Casos, Documentos
  - **Attorney**: Tendencias, Drift Detector, Prompt Analyzer, Drive Import, Subir Documento, Casos, Documentos
  - **Drafter**: Drive Import, Subir Documento, Casos, Documentos, Taxonomía
  - **Analyst**: Casos, Documentos, Taxonomía
- **Chat RAG integrado**: Panel lateral (desktop) o overlay (móvil) con asistente de IA que permite hacer preguntas sobre los casos y documentos utilizando búsqueda semántica (embeddings). El chat muestra las fuentes consultadas con porcentaje de similitud y enlaces a los documentos originales.

---

### 3. Gestión de Casos de Visa (`/casos`)

Sistema completo de gestión del ciclo de vida de un caso de visa con las siguientes capacidades:

- **Crear Caso Nuevo**: Requiere obligatoriamente el CV del beneficiario. Al subir el CV, el sistema lo analiza con IA y genera automáticamente un **reporte de aptitud** que incluye:
  - **Score de aptitud** (porcentaje) con recomendación (ALTAMENTE RECOMENDADO, RECOMENDADO, POSIBLE CON MEJORAS, NO RECOMENDADO)
  - **Análisis por Prong**: Score individual para Prong 1 (Importancia Nacional), Prong 2 (Bien Posicionado), Prong 3 (Balance de Intereses)
  - **Fortalezas clave** identificadas del candidato
  - **Evidencia faltante** que necesita ser recopilada
  - **Razonamiento detallado** del análisis
  
- **Categorías de Visa soportadas**: EB2-NIW, EB1A, EB1B, EB1C, Otro
- **Estados del Caso**: Pendiente, Aprobado, RFE Recibido, NOID Recibido, Denegado (con iconos y colores distintivos)
- **Service Centers**: Texas (TSC), Nebraska (NSC), California (CSC), Vermont (VSC)

- **Subir Documentos al Caso**: Más de 30 tipos de documentos categorizados:
  - Formularios USCIS (I-140, I-907, G-1450, G-1145)
  - Documentos de Inmigración (I-94, Pasaporte, Visa)
  - Carta NIW (Autopetición completa)
  - Project Documentation (Policy Paper, White Paper, Econometric Study, MVP, Patent, Libro)
  - CV, Títulos Académicos, Expert Evaluation, Cartas de Recomendación
  - Employment Letters, Letter of Intent
  - Documentos Familiares, Traducciones
  - RFE/NOID y Respuestas, Notificaciones de Aprobación/Denegación
  - Buscador integrado para encontrar tipos rápidamente

- **Análisis del Caso con IA**: Botón que analiza todos los documentos del caso para generar un reporte con:
  - Resumen general
  - Fortalezas identificadas (lo que se hizo bien)
  - Debilidades detectadas
  - Recomendaciones de mejora

- **Vista detallada de documentos**: Cada documento muestra metadatos (tipo, palabras, caracteres, páginas), estado de análisis, y si apoya o no al cliente
- **Búsqueda de documentos** dentro de cada caso
- **Eliminar casos y documentos** con confirmación

---

### 4. Subida de Documentos con Pipeline Asíncrono (`/documents/upload`)

El módulo de carga de documentos tiene un pipeline de procesamiento asíncrono robusto que:

1. **Crea inmediatamente** un registro en la base de datos con estado `pending` al iniciar la carga
2. **Sube el archivo** a Supabase Storage
3. **Extrae texto**: Soporta PDF, DOCX, DOC y TXT
4. **OCR inteligente**: Para PDFs escaneados, usa **GPT-4o via OpenRouter** para OCR óptico (convierte páginas a imágenes con `poppler-utils` y las envía al LLM)
5. **Análisis estructurado con IA**: Extrae automáticamente:
   - **Issues/problemas** clasificados con taxonomía (NIW.P1.IMPORTANCIA_NO_DEMOSTRADA, etc.)
   - **Solicitudes de evidencia** (evidence_requested) mapeadas a prongs
   - **Tipo de documento**, categoría de visa, número de recibo, fechas, centro de servicio
   - **Citas textuales** relevantes
6. **Genera embeddings**: Divide el documento en chunks y genera embeddings vectoriales para búsqueda semántica
7. **Actualización de estado en tiempo real**: El frontend muestra el progreso (Pendiente → Extrayendo texto → Realizando OCR → Analizando → Completado) con timeout de 10 minutos para documentos grandes

Los documentos procesados aparecen inmediatamente en la lista con su estado de procesamiento y se actualizan automáticamente al completarse.

---

### 5. Lista de Documentos (`/documents`)

Vista de todos los documentos procesados en el sistema con:
- **Badges de estado**: pending (gris), extracting (azul animado), analyzing (amarillo), completed (verde), failed (rojo)
- **Auto-refresh**: La lista se actualiza automáticamente cada 5 segundos mientras hay documentos en procesamiento
- **Información por documento**: Nombre, tipo, número de issues y requests extraídos, chunks de embeddings, fecha
- **Vista detallada** de cada documento con todo su contenido estructurado

---

### 6. Dashboard de Tendencias (`/trends`)

Dashboard analítico completo con 4 pestañas:

#### 6.1 Conclusiones (Análisis Inteligente con IA)
- Panel de análisis generado por IA que interpreta todos los datos y genera conclusiones y recomendaciones accionables
- Basado en el total de documentos e issues del sistema

#### 6.2 Vista General
- **Cards de estadísticas**: Total documentos, total issues, RFEs, Denegaciones (NOID+Denial)
- **Gráfico de barras horizontales**: Top issues más frecuentes con códigos de taxonomía
- **Gráfico de pie**: Distribución por Prong (P1 Mérito Nacional, P2 Bien Posicionado, P3 Balance de Intereses) del test Dhanasar
- **Gráfico de área temporal**: Issues por mes apilados por severidad (Críticos, Altos, Medios, Bajos)
- **Barras de progreso**: Distribución por severidad con porcentajes
- **Tabla detallada**: Lista completa de issues con código de taxonomía, ocurrencias, porcentaje y desglose de severidad
- **Filtros avanzados**: Categoría de visa (EB2-NIW, EB1A, EB1B, O-1A), tipo de documento (RFE, NOID, Denial), rango de fechas, período (3 meses, 6 meses, 1 año, todo)

#### 6.3 Drift Detector
Herramienta innovadora para detectar cambios en los criterios de adjudicación de USCIS:
- **Índice de Cambio**: Score numérico (0-100) que indica cuánto han cambiado los patrones
- **Configuración flexible**: Período reciente (30/60/90 días) vs período base (180 días / 1 año / 2 años)
- **Alertas automáticas**: Detecta y muestra alertas de cambios significativos con severidad (high/medium) y recomendaciones
- **Cambios por Prong**: Muestra cómo ha evolucionado el escrutinio en cada área del test Dhanasar
- **Nuevos Issues Detectados**: Issues que aparecen en el período reciente pero no existían en el período base
- **Tabla de cambios**: Detalle por issue con porcentaje reciente vs base, cambio relativo, y si es significativo

#### 6.4 Comparar Períodos (Cohort Analyzer)
- Selecciona dos períodos (trimestres) para comparar
- **Cards de resumen**: Total de issues por período, cambio neto, issues emergentes
- **Issues en Aumento**: Lista de issues que están creciendo (destacando los NUEVOS)
- **Issues en Descenso**: Lista de issues que están disminuyendo
- **Cambios por Prong**: Comparación visual de Prong 1, 2 y 3 entre ambos períodos

---

### 7. Drift Detector Dedicado (`/drift-detector`)

Versión dedicada del detector de drift con dos pestañas:

#### 7.1 Drift Detector
- Configuración de ventana corta (30/60/90 días) vs ventana larga (90/180/365 días)
- Cards de resumen: Alertas Críticas, Alertas Altas, En Aumento, Nuevos Patrones
- Lista detallada de alertas con badges de severidad, porcentaje de cambio, y comparación entre períodos
- Empty state cuando no se detectan cambios significativos

#### 7.2 Frecuencia de Issues
- Top issues más frecuentes con tendencia (increasing/decreasing/stable)
- Configurable por semana o por mes
- Resumen: Issues totales, códigos únicos, períodos analizados

---

### 8. Optimizador de Prompts (`/prompt-analyzer`)

Herramienta sofisticada para mejorar prompts de generación de documentos legales basándose en datos reales de RFEs, NOIDs y Denials:

- **14 tipos de documento soportados**: Propuestas EB-2 NIW, Patentes USPTO, Libros Completos, Estudios Econométricos, White Papers, Cartas de Recomendación, Casos de Estudio, Reportes de Impacto Social, Cartas de Expertos, Cartas de Autopetición, Respuestas a RFE, Respuestas a NOID, Declaraciones Personales, Resúmenes de Evidencia

- **Análisis del Prompt**:
  1. El sistema busca en embeddings de documentos reales (RFEs, NOIDs, Denials) los más relevantes
  2. Cruza con la taxonomía de issues para identificar vulnerabilidades
  3. Genera una **puntuación de 1-10** con resumen
  4. Lista **puntos fuertes** del prompt actual
  5. Detecta **issues** (problemas) con severidad (alta/media/baja), categoría (Prong 1/2/3, Evidencia), descripción y sugerencia de mejora
  6. Muestra los **documentos consultados** con nombre, tipo y porcentaje de similitud

- **Mejora del Prompt**:
  1. El usuario selecciona qué issues quiere abordar (checkbox)
  2. El sistema genera un **prompt mejorado** optimizado
  3. Muestra los **cambios realizados** explicando qué issue se abordó y cómo
  4. Ofrece **tips adicionales** de mejora
  5. Botón para copiar al portapapeles

- **Historial de optimizaciones**: Guarda todas las optimizaciones realizadas con el prompt original, análisis, prompt mejorado y se pueden cargar desde el historial para revisión

---

### 9. Auditor de Expediente (`/auditor`)

Sistema de auditoría integral de casos contra los 3 prongs del test Dhanasar:

- **Selección de caso** para auditar
- **Score General** (0-100) con clasificación: Fuerte (80+), Moderado (60-79), Débil (40-59), Crítico (<40)
- **Cards de resumen**: Documentos analizados, Issues detectados, Solicitudes USCIS

- **4 pestañas de análisis**:
  1. **Análisis por Prong**: Card individual para P1, P2, P3 con score, barra de progreso, fortalezas identificadas, debilidades, conteo de issues y solicitudes
  2. **Checklist**: 
     - Documentos esenciales (presente/faltante/no verificado) con nivel de importancia
     - Solicitudes de USCIS pendientes mapeadas a prongs
     - Evidencia recomendada basada en issues detectados
  3. **Recomendaciones**: Plan de acción priorizado (critical/high/medium/low) con acciones específicas por prong
  4. **Issues**: Listado completo agrupado por severidad (Críticos, Altos, Medios, Bajos) con código de taxonomía, cita textual y documento fuente

---

### 10. Importar Expediente (`/drive-import`)

Sistema avanzado de importación masiva de documentos con 3 métodos:

#### 10.1 Archivos Locales
- **Selección de archivos individuales** o **carpeta completa** (incluyendo subcarpetas)
- **Drag & drop** con soporte para carpetas (lectura recursiva de directorios)
- **Detección automática de tipo de documento** por nombre de archivo (RFE, NOID, Denial, Carta de Recomendación, Business Plan, CV, etc.)
- **Detección de duplicados**: Compara contra documentos ya subidos al caso y contra la lista local
- **Edición de tipo** inline por cada archivo antes de importar
- **Progreso individual** por archivo con estados (pending, uploading, success, error)
- **Soporte para caso existente**: Puede agregar archivos a un caso ya creado o crear uno nuevo

#### 10.2 ZIP Grande (Segundo Plano)
- **Sin límite de tamaño** para archivos ZIP
- Se sube a Supabase Storage y se procesa en segundo plano
- Crea un job de importación que se puede monitorear

#### 10.3 Trabajos en Proceso
- **Monitoreo en tiempo real** de importaciones en segundo plano
- Estados: Pendiente, Subiendo, Procesando, Completado, Error
- Barra de progreso con archivo actual y conteo
- Enlace directo al caso cuando se completa
- Polling automático cada 5 segundos

---

### 11. Módulo de Ingesta (`/ingesta`)

Módulo simplificado de carga individual de documentos con:
- Drag & drop con validación de formato (PDF, DOCX, DOC, TXT) y tamaño (50MB)
- 10 tipos de documento: RFE, NOID, Denial, Cover Letter, Brief, Carta de Recomendación, Business Plan, Estudio Econométrico, Exhibit Index, Otro
- **Vista del resultado en formato JSON canonicalizado**: Metadatos (tipo, páginas, caracteres, palabras) + texto limpio extraído + JSON completo
- **Lista de documentos procesados** con badge de tipo, fecha y conteo de caracteres
- Modal de detalle con contenido completo del documento

---

### 12. Taxonomía de Issues

El sistema cuenta con una **taxonomía estructurada y exhaustiva** de criterios para visas EB2-NIW y EB1A:

#### EB-2 NIW (Framework Dhanasar de 3 Prongs):
- **Prong 1 (Mérito Sustancial e Importancia Nacional)**: 6 issues (IMPORTANCIA_NO_DEMOSTRADA, IMPACTO_LOCAL, MERITO_INSUFICIENTE, ENDEAVOR_VAGO, BENEFICIO_ECONOMICO_NO_CUANTIFICADO, AREA_NO_PRIORITARIA)
- **Prong 2 (Bien Posicionado para Avanzar)**: 7+ issues (CALIFICACIONES_INSUFICIENTES, TRACCION_INSUFICIENTE, PLAN_NO_VIABLE, SIN_FINANCIAMIENTO, etc.)
- **Prong 3 (Balance de Intereses)**: 5+ issues (WAIVER_NO_JUSTIFICADO, BENEFICIO_NO_SUPERIOR, DISPONIBILIDAD_TRABAJADORES, etc.)
- **Evidencia**: Issues de calidad probatoria, cartas genéricas, falta de independencia
- **Coherencia**: Inconsistencias, claims no soportados
- **Procedurales**: Documentación incompleta, formato incorrecto

#### EB-1A (Extraordinary Ability):
- Issues para cada uno de los 10 criterios (Premios, Membresías, Publicaciones, Jurado, Contribuciones Originales, Artículos Académicos, Exhibiciones, Liderazgo, Salario Alto, Éxito Comercial)
- Issues de "Final Merits Determination"

Cada issue tiene: **código** (ej: NIW.P1.IMPORTANCIA_NO_DEMOSTRADA), **label**, **severidad** (critical/high/medium/low), **descripción** y **remediación** sugerida.

---

### 13. Chat RAG (Retrieval-Augmented Generation)

Asistente conversacional integrado en el dashboard que:
- Usa **búsqueda semántica** en embeddings de todos los documentos del sistema
- Genera respuestas basadas en el contenido real de los documentos
- Muestra **fuentes consultadas** con nombre del documento, tipo y porcentaje de similitud
- Permite **generar embeddings** para todos los documentos si aún no existen
- Soporte de Markdown en las respuestas
- Historial de conversación por sesión

---

### 14. Sistema de Roles y Permisos

4 roles con acceso diferenciado:
| Función | Admin | Attorney | Drafter | Analyst |
|---------|-------|----------|---------|---------|
| Gestionar Usuarios | ✅ | ❌ | ❌ | ❌ |
| Tendencias | ✅ | ✅ | ❌ | ❌ |
| Drift Detector | ✅ | ✅ | ❌ | ❌ |
| Prompt Analyzer | ✅ | ✅ | ❌ | ❌ |
| Drive Import | ✅ | ✅ | ✅ | ❌ |
| Subir Documentos | ✅ | ✅ | ✅ | ❌ |
| Casos | ✅ | ✅ | ✅ | ✅ |
| Documentos | ✅ | ✅ | ✅ | ✅ |
| Taxonomía | ✅ | ✅ | ✅ | ✅ |

---

## Arquitectura Técnica

### Stack Tecnológico
- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS, shadcn/ui, Recharts (gráficas), Lucide Icons, react-markdown
- **Backend**: Next.js API Routes (server-side)
- **Base de Datos**: Supabase (PostgreSQL) — Auth, Database, Storage
- **IA/LLM**: OpenRouter (gateway para GPT-4.1, GPT-4o) como proveedor principal, OpenAI como fallback
- **OCR**: poppler-utils (pdftoppm) + GPT-4o vision via OpenRouter
- **Embeddings**: Generación vectorial para búsqueda semántica RAG

### Módulos Backend Clave
| Módulo | Archivo | Función |
|--------|---------|---------|
| Case Miner | `lib/case-miner.js` | Extracción estructurada de datos con IA, guardado resiliente a DB |
| LLM Client | `lib/llm-client.js` | Cliente unificado para llamadas a LLM |
| Document Processor | `lib/document-processor.js` | Extracción de texto de PDF/DOCX/TXT |
| OCR Processor | `lib/ocr-processor.js` | OCR con GPT-4o vision para PDFs escaneados |
| Embeddings | `lib/embeddings.js` | Generación y búsqueda de embeddings vectoriales |
| Taxonomy | `lib/taxonomy.js` | Taxonomía maestra de 60+ códigos de issues |
| Trends Analysis | `lib/trends-analysis.js` | Análisis estadístico de tendencias |
| Checklist | `lib/checklist.js` | Lógica del auditor de expediente |
| Google Drive | `lib/google-drive.js` | Integración con Google Drive |

### APIs (30+ endpoints)
- `/api/casos` — CRUD completo de casos + análisis con IA + análisis de CV
- `/api/documents` — Upload async, bulk upload, job status, análisis
- `/api/trends` — Tendencias, drift detection, cohort analysis
- `/api/drift-detector` — Detección de cambios de criterio
- `/api/issue-frequency` — Frecuencia temporal de issues
- `/api/prompt-analyzer` — Análisis y mejora de prompts
- `/api/chat` — Chat RAG con búsqueda semántica
- `/api/embeddings` — Generación y búsqueda de embeddings
- `/api/taxonomy` — CRUD de taxonomía + sincronización
- `/api/claims` — Gestión de claims
- `/api/stats` — Estadísticas globales
- `/api/drive-import` — Importación desde Google Drive
- `/api/zip-import` — Importación de archivos ZIP
- `/api/import-jobs` — Gestión de jobs de importación en segundo plano
- `/api/ingesta` — Ingesta y canonicalización de documentos

### Base de Datos (Supabase)
Tablas principales:
- `profiles` — Usuarios con roles
- `cases` / `visa_cases` — Casos de visa con análisis de CV y caso
- `documents` — Documentos procesados con texto, datos estructurados, estado de extracción
- `document_issues` — Issues extraídos con FK a taxonomía
- `document_requests` — Solicitudes de evidencia extraídas
- `document_embeddings` — Chunks vectoriales para RAG
- `taxonomy` — Códigos de issues sincronizados
- `case_documents` — Documentos asociados a casos
- `import_jobs` — Jobs de importación en segundo plano
- `prompt_analysis_history` — Historial de optimizaciones de prompts

### Migraciones SQL
6 archivos de migración versionados:
- `002_structured_extraction.sql` — Schema base de extracción estructurada
- `003_claims_and_drift.sql` — Claims y detección de drift
- `004_page_references.sql` — Referencias de página en embeddings
- `005_import_jobs.sql` — Jobs de importación en segundo plano
- `006_rfe_strategy.sql` — Estrategia de respuesta a RFE

---

## Innovaciones Clave

1. **Pipeline de Procesamiento Asíncrono con Estado en Tiempo Real**: El documento aparece inmediatamente en la lista con estado "pending" y se actualiza automáticamente a medida que avanza por las fases de procesamiento (extracting → analyzing → completed).

2. **OCR con IA Multimodal**: Para PDFs escaneados, el sistema convierte páginas a imágenes y usa GPT-4o (visión) para extraer texto, logrando procesar documentos que otros sistemas no pueden leer.

3. **Taxonomía Canónica de Issues**: Más de 60 códigos estructurados jerárquicamente (VISA.PRONG.ISSUE) con severidad, descripción y remediación. Permite análisis estadístico riguroso.

4. **Drift Detector**: Algoritmo original que compara distribuciones de issues entre ventanas temporales para detectar cambios en los criterios de adjudicación de USCIS — algo que normalmente requiere años de experiencia de un abogado.

5. **Prompt Optimizer con RAG**: Analiza prompts contra datos reales de RFEs/NOIDs/Denials usando búsqueda semántica, identifica vulnerabilidades y genera versiones mejoradas — un ciclo de mejora continua basado en evidencia.

6. **Auditor de Expediente Automatizado**: Evalúa un caso completo contra los 3 prongs del test Dhanasar, genera checklist de evidencia, identifica debilidades y produce un plan de acción priorizado.

7. **Análisis de Aptitud por CV**: Al crear un caso, analiza automáticamente el CV del beneficiario y genera un score de aptitud para la visa antes de iniciar el trabajo, ahorrando tiempo y recursos.

8. **Chat RAG Especializado**: Asistente conversacional que busca en todos los documentos del sistema usando embeddings vectoriales para dar respuestas fundamentadas en evidencia real.

9. **Importación Masiva Inteligente**: Soporta carpetas completas, archivos ZIP de cualquier tamaño (procesamiento en background), detección automática de tipo de documento y deduplicación.

10. **Guardado Resiliente a Base de Datos**: El sistema detecta y maneja errores silenciosos de Supabase (como violaciones de FK), reintenta inserciones individuales si falla el bulk, y registra todo para depuración.

---

## Público Objetivo

- **Abogados de Inmigración**: Acceso a tendencias, drift detector, auditoría de expedientes y prompt optimizer para tomar decisiones basadas en datos
- **Drafters / Redactores Legales**: Optimización de prompts para generar documentos más sólidos, carga de documentos
- **Analistas de Data**: Gestión de casos, documentos y reportes
- **Firmas de Inmigración**: Plataforma completa para gestionar múltiples casos EB-2 NIW / EB-1A simultáneamente

---

## Resumen Ejecutivo

**Cerebro Visas** es una plataforma de inteligencia artificial diseñada específicamente para transformar la práctica de abogados de inmigración especializados en visas EB-2 NIW y EB-1A. El sistema ingesta y analiza documentos de USCIS (RFEs, NOIDs, Denegaciones) usando modelos de lenguaje avanzados (GPT-4.1, GPT-4o) para extraer issues estructurados con una taxonomía canónica de más de 60 códigos.

A partir de esta data, el sistema ofrece herramientas únicas como el **Drift Detector** (que detecta cambios en criterios de USCIS comparando ventanas temporales), el **Prompt Optimizer** (que mejora prompts de generación de documentos basándose en patrones reales de denegación), y el **Auditor de Expediente** (que evalúa un caso completo contra los 3 prongs del test Dhanasar).

La plataforma pasa de un modelo donde los abogados dependen de intuición y experiencia acumulada a uno donde las decisiones están respaldadas por análisis cuantitativo de datos reales — representando una ventaja competitiva significativa para cualquier firma de inmigración.
