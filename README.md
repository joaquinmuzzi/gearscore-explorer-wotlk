# Gearscore Explorer (WotLK)

Buscador y visualizador de Gearscore vs Item Level con datos locales. Permite buscar por ID o por nombre en inglés (si el cache de nombres está generado).

## Live

https://joaquinmuzzi.github.io/gearscore-explorer-wotlk/

## Datos

- `GS.json` está embebido en `gs-data.js` para evitar problemas de CORS.
- Los nombres de ítems se cargan desde `item-names.js` (cache generado).

## Generar cache de nombres

> Requiere Python y `requests`.

1. Instalar dependencias:
   - `pip install requests`
2. Ejecutar:
   - `python tools/build_item_names_cache.py`

Esto genera/actualiza:
- `item_names_cache.json`
- `item-names.js`
