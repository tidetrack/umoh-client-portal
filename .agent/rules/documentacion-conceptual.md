# Regla: Documentación Conceptual y de Negocios (NotebookLM)

## Contexto y Objetivo
La planilla Pymes no es solo un software; es una herramienta educativa y estratégica asíncrona. Toda la base de conocimiento del proyecto será eventualmente consumida o parseada por una IA tipo **NotebookLM** que actuará como tutor financiero/técnico para los usuarios finales. Por lo tanto, **no basta con documentar cómo funciona el código**, se debe documentar de forma exhaustiva el **POR QUÉ** teórico, contable y de negocios de cada aspecto de la planilla.

## División de Tareas
- `@agente-contextual`: Es el encargado directo de generar (o requerir que se le generen) los documentos teóricos dentro del directorio `docs/permanente/notebookLM/` cada vez que se cierra una funcionalidad (ej: Módulo ABM, Dashboard Financiero, Conciliación Bancaria).
- `@github-docs`: Es el responsable de replicar ese valor en la cara pública del proyecto de Github. Los README y Wikis deben dejar claro el concepto funcional antes de explicar la implementación en código.

## Criterios de Documentación Obligatoria
Ante cualquier feature mayor o bloque del producto que se complete, se **debe crear/actualizar un documento conceptual** basado en `TEMPLATE_FUNCIONALIDAD.md`. 
El reporte debe contener obligatoriamente:
1. **Definición Simples**: Qué es la herramienta.
2. **Valor para Pymes**: El problema de negocio que resuelve.
3. **Fundamento Teórico/Contable**: Bases técnicas de la administración (ej. naturaleza de cuentas, flujo vs devengado).
4. **Guía de Uso**: Cómo usarlo en la UI.
5. **Relaciones**: Qué hojas se nutren de esta data.

Ningún feature core o hito de la planilla debe darse por completado en github si el equipo no ha alimentado la base de conocimiento para NotebookLM.
