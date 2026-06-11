#!/usr/bin/env python3
"""
Genera todos los íconos institucionales de la Alcaldía Municipal de Simacota
con margen seguro, fondo blanco limpio y escudo centrado sin deformación.
"""

from PIL import Image
import shutil

SRC = "public/brand/logo-alcaldia-simacota.png"
OUT = "public"
BG  = (255, 255, 255, 255)

# ── Recorte manual del escudo ─────────────────────────────────────────────────
# El logo fuente es de 1574×382px. El escudo (contenido real) está en:
#   cols 41–319,  filas 20–364  (detectado por análisis de píxeles)
# Se agrega un margen de 4px en cada borde.
raw = Image.open(SRC).convert("RGBA")

CROP_LEFT   = max(0, 41  - 4)
CROP_TOP    = max(0, 20  - 4)
CROP_RIGHT  = min(raw.width,  319 + 4)
CROP_BOTTOM = min(raw.height, 364 + 4)

src = raw.crop((CROP_LEFT, CROP_TOP, CROP_RIGHT, CROP_BOTTOM))
W, H = src.size
print(f"Escudo recortado: {W}×{H}px")


def make_icon(size: int, padding_ratio: float = 0.10) -> Image.Image:
    """
    Ícono cuadrado con fondo blanco, escudo centrado y sin deformación.
    """
    canvas = Image.new("RGBA", (size, size), BG)
    pad    = int(size * padding_ratio)
    avail  = size - 2 * pad

    ratio  = min(avail / W, avail / H)
    new_w  = int(W * ratio)
    new_h  = int(H * ratio)
    scaled = src.resize((new_w, new_h), Image.LANCZOS)

    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas.paste(scaled, (x, y), scaled)
    return canvas


def save_png(img: Image.Image, path: str):
    img.convert("RGB").save(path, "PNG", optimize=True)


# ── Genera cada tamaño ────────────────────────────────────────────────────────

save_png(make_icon(16,  0.06), f"{OUT}/favicon-16x16.png")
print("✓ favicon-16x16.png")

save_png(make_icon(32,  0.06), f"{OUT}/favicon-32x32.png")
print("✓ favicon-32x32.png")

# favicon.ico multi-resolución 16+32+48
ico_imgs = [make_icon(s, 0.06).convert("RGBA") for s in (16, 32, 48)]
ico_imgs[0].save(
    f"{OUT}/favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
    append_images=ico_imgs[1:],
)
print("✓ favicon.ico  (16+32+48px multi-resolución)")

save_png(make_icon(180, 0.10), f"{OUT}/apple-touch-icon.png")
print("✓ apple-touch-icon.png  (180×180)")

save_png(make_icon(192, 0.10), f"{OUT}/icon-192x192.png")
print("✓ icon-192x192.png")

save_png(make_icon(512, 0.10), f"{OUT}/icon-512x512.png")
print("✓ icon-512x512.png")

# Maskable: 20% padding para zona segura de Android
save_png(make_icon(192, 0.20), f"{OUT}/maskable-icon-192x192.png")
print("✓ maskable-icon-192x192.png")

save_png(make_icon(512, 0.20), f"{OUT}/maskable-icon-512x512.png")
print("✓ maskable-icon-512x512.png")

# Copia favicon al directorio app/ (Next.js App Router)
shutil.copy(f"{OUT}/favicon.ico", "app/favicon.ico")
print("✓ app/favicon.ico  (copia para Next.js App Router)")

print("\n✅ Todos los íconos generados correctamente.")
