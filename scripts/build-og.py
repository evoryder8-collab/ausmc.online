"""Render the 1200x630 social share image (public/og.jpg)."""
import os, io, random
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
NM = os.path.join(ROOT, 'node_modules')
W, H = 1200, 630

def font_from_woff2(path, size, axes=None):
    f = TTFont(path)
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    buf.seek(0)
    font = ImageFont.truetype(buf, size)
    if axes:
        font.set_variation_by_axes(axes)
    return font

archivo = os.path.join(NM, '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2')
geist = os.path.join(NM, '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2')
serif_i = os.path.join(NM, '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2')

# background: deep navy with royal glow, a red silk ribbon and stars
bg = Image.new('RGB', (W, H), (0, 6, 22))
glow = Image.new('RGB', (W, H), (0, 0, 0))
g = ImageDraw.Draw(glow)
g.ellipse((-200, -260, 760, 560), fill=(10, 42, 120))
g.ellipse((620, 40, 1400, 760), fill=(8, 34, 105))
glow = glow.filter(ImageFilter.GaussianBlur(140))
bg = Image.blend(bg, glow, 0.85)
rib = Image.new('L', (W, H), 0)
r = ImageDraw.Draw(rib)
r.polygon([(-50, 520), (420, 380), (900, 460), (1300, 300), (1300, 360), (900, 520), (420, 440), (-50, 590)], fill=255)
rib = rib.filter(ImageFilter.GaussianBlur(38))
red = Image.new('RGB', (W, H), (228, 0, 43))
bg = Image.composite(red, bg, rib.point(lambda v: int(v * 0.42)))
d = ImageDraw.Draw(bg)
random.seed(7)
for _ in range(110):
    x, y, s = random.randint(0, W), random.randint(0, H), random.choice([1, 1, 1, 2])
    a = random.randint(90, 230)
    d.ellipse((x, y, x + s, y + s), fill=(a, a, min(255, a + 20)))

# badge with soft halo
badge = Image.open(os.path.join(ROOT, 'public/logo/badge-1280.png')).resize((470, 470), Image.LANCZOS)
halo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(halo).ellipse((670, 70, 1170, 570), fill=(140, 170, 255, 120))
halo = halo.filter(ImageFilter.GaussianBlur(50))
bg = bg.convert('RGBA')
bg.alpha_composite(halo)
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((700, 110, 1160, 580), fill=(0, 4, 20, 170))
bg.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(26)))
bg.alpha_composite(badge, (685, 80))

d = ImageDraw.Draw(bg)
small = font_from_woff2(geist, 21, [600])
title = font_from_woff2(archivo, 128, [860, 125])
year = font_from_woff2(serif_i, 150)
body = font_from_woff2(geist, 26, [500])

pill = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(pill).rounded_rectangle((70, 92, 340, 132), radius=20, fill=(255, 255, 255, 30), outline=(255, 255, 255, 70))
bg.alpha_composite(pill)
d = ImageDraw.Draw(bg)
d.ellipse((88, 107, 98, 117), fill=(255, 45, 85))
d.text((108, 101), 'OFFICIAL SCHEDULE', font=small, fill=(255, 255, 255))
d.text((62, 140), 'AusMC', font=title, fill=(255, 255, 255))
d.text((150, 262), '2026', font=year, fill=(255, 92, 120))
d.text((72, 452), 'AUSTRALIAN MASSAGE CHAMPIONSHIP', font=small, fill=(214, 224, 255))
d.text((72, 494), '9–11 October 2026  ·  Cockatoo Island, Sydney', font=body, fill=(255, 255, 255))

bg.convert('RGB').save(os.path.join(ROOT, 'public/og.jpg'), quality=90, optimize=True)
print('wrote public/og.jpg')
