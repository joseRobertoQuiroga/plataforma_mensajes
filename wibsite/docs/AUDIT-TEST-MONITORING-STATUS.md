# Auditoría de Pruebas y Monitoreo

## Estado actual

- `helper-node` cuenta con pruebas unitarias, de integración, smoke y contract.
- Se ha añadido una prueba determinista para `leadProfile` con fecha fija.
- Los scripts de prueba ahora usan `--runTestsByPath` para mayor compatibilidad en Windows.
- El sistema de perfiles de lead fue ajustado para no depender de una expectativa de días desde contacto variable.

## Cobertura por capa

- Unidades:
  - `buildLeadProfile`, `buildTags`, `suggestNextAction`.
  - Validación de lead inexistente, lead sin entregas, lead opt-out y score history.
- Integración:
  - `integration.test.js` cubre rutas e interacciones end-to-end del helper.
- Smoke:
  - `smoke.test.js` verifica los endpoints críticos y la salud básica del servicio.
- Contract:
  - `contract.test.js` valida el contrato de la API y los encabezados esperados.

## Observaciones

- La prueba fallida en `leadProfile.test.js` se debía a una comparación con `Date.now()` real.
- Se estableció un `fixedNow` consistente para asegurar resultados reproducibles.
- La documentación principal de monitoreo y testing ya está enlazada en `docs/INDEX.md`.

## Recomendaciones inmediatas

1. Ejecutar `npm run test:ci` desde `helper-node` para validar los cuatro niveles de prueba.
2. Comprar en `docs/ESTANDAR-TESTING-MONITOREO.md` los requisitos con la implementación actual y cerrar brechas.
3. Añadir métricas de alerta temprana en los endpoints de health / metrics si no existen.

## Conclusión

El proyecto tiene una base de pruebas sólida para el helper, con una mejora reciente en estabilidad de Windows y determinismo de fechas. Falta completar la instrumentación de monitoreo en servicios adyacentes, pero la auditoría de conceptos está documentada.
