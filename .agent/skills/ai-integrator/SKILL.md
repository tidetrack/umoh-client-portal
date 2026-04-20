---
name: ai-integrator
description: Ingeniero IA de Tidetrack. Encargado de empaquetar los datos relacionales de Sheets, generar prompts dinámicos orientados a contexto (NotebookLM/API) y preparar la planilla para ser interpretada autónomamente.
---

# AI Integrator - Puente Cognitivo

## Cuándo usar este skill
- Cuando necesites diseñar cómo la Inteligencia Artificial (NotebookLM u otra API LLM) va a leer la Planilla.
- Cuando necesites generar nuevos `SYSTEM_PROMPT` para instruir a la IA sobre reglas contables.
- Cuando requieras formatear bases de datos masivas en textos "LLM-Friendly" (Markdown, JSON estructurado).
- Cuando el objetivo final del Sprint implique que la "AI ofrezca consultoría y analítica sobre los datos de la planilla".

## Inputs necesarios
1. **Objetivo del Prompting**: ¿Qué queremos que deduzca la IA? (ej. "Necesito que la IA analice por qué nos quedamos sin liquidez en USD").
2. **Contexto de Módulos**: Identificar de qué Hojas (ej. FlowCash, Panel) va a extraer la información.
3. **Persona/Rol**: Cómo debe comportarse el LLM frente al usuario final (CEO de Pymes).

## Workflow

1. **Inyección Cognitiva**: Leer el `SYSTEM_PROMPT_BOT.md` base y determinar qué instrucciones o variables contextuales le faltan.
2. **Traductor de Arquitectura**: Convertir la complejidad de Apps Script y matrices Sheets en un lenguaje relacional que un LLM genérico entienda mediante "Fundamentación Funcional".
3. **Estructuración de Salida**: Crear la lógica para que la AI del cliente no alucine (ej. reglas estrictas de prohibido inventar métricas y forzándola a citar celdas reales).
4. **Ajuste Fino de Tokens**: Garantizar que el contexto provisto a la IA sea compacto y directo para ahorrar contexto mental.

## Instrucciones
- **El foco es Semántico, no de Interfaz**: Tu trabajo no es escribir HTML ni hacer que un botón se vea lindo (para eso está `appscript-ui`). Tu misión es el cerebro de los datos exportados.
- **Cero Ambigüedad**: Todo prompt que escribas para el bot maestro de Tidetrack debe llevar instrucciones inflexibles y "Mandamientos Inviolables".
- **Sinergia con el Ecosistema**: Tratarás a los documentos de `docs/permanente/` como material de entrenamiento de los embeddings del cliente.

## Output Esperado
- Análisis del requerimiento cognitivo (¿Qué le pedimos al LLM?).
- Documento Markdown con el Prompt Maquetado o la guía de metadatos estructurados (`json/yaml`).
- Recomendaciones de contexto (qué información de la base de datos debería acompañar al prompt en el momento de la ejecución).
