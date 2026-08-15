# Launcher de consolas LLM

> Amster-dam: the LLM river held by a little HTML dam. Run `amster dump` to open the floodgates.

Panel estático para abrir todas las consolas de billing de LLM desde un solo lugar.

## Cómo abrirlo

```bash
xdg-open /home/eve/Coding_Projects/amsterdam/index.html
```

O abrí `index.html` con tu navegador (doble clic en el explorador de archivos).

## Helper CLI opcional

El repo incluye `scripts/amster`, un helper de shell. Se puede usar
directamente desde el repo:

```bash
./scripts/amster link   # Muestra la URL file:// del lanzador
./scripts/amster path   # Muestra la ruta absoluta del lanzador
./scripts/amster open   # Abre el lanzador con xdg-open
```

Instalación opcional en `~/.local/bin`. Se recomienda el symlink, así
el helper siempre apunta al `index.html` del repo:

```bash
ln -s "$PWD/scripts/amster" ~/.local/bin/amster
```

Copiar también funciona: si `scripts/amster` no encuentra el `index.html`
relativo, usa como respaldo la ruta absoluta
`/home/eve/Coding_Projects/amsterdam/index.html`:

```bash
install -m 755 scripts/amster ~/.local/bin/amster
```

## Notas

- Es un archivo único, sin assets externos ni llamadas de red.
- No contiene secretos ni API keys.
- La caja de búsqueda filtra las tarjetas en vivo.
- Botones "Abrir consola" abren cada página en una pestaña nueva.
- El repo es local-only: no tiene remotes y no se hace push.

Generado el 2026-08-14.
