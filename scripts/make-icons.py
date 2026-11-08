#!/usr/bin/env python3
"""The ICSA app's icons, launch mark and Play graphics, made from one spec.

Yasir ruled, 8 Nov 2026: icon C — tall white ICSA letters in the style of the
ICSA emblem, with the brand yellow bar, on ICSA blue. The letters are set in
Anton (SIL Open Font License, assets/brand/Anton-OFL.txt), the nearest free
face to the emblem's lettering. Run from the repo root:

    python3 scripts/make-icons.py

and it rewrites every file below. Nothing here is drawn by hand.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / 'assets/brand/Anton-latin-400.woff'
NUNITO = ROOT / 'node_modules/@expo-google-fonts/nunito'
BLUE = (13, 71, 161)       # ICSA blue  #0D47A1
YELLOW = (255, 193, 7)     # ICSA accent #FFC107
WHITE = (255, 255, 255)


def mark(width: int) -> Image.Image:
    """The ICSA letters and the yellow bar, transparent, `width` wide."""
    f = ImageFont.truetype(str(FONT), 1000)
    probe = ImageDraw.Draw(Image.new('L', (1, 1)))
    bb = probe.textbbox((0, 0), 'ICSA', font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    gap, bar = int(th * 0.12), int(th * 0.12)
    im = Image.new('RGBA', (tw, th + gap + bar), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((-bb[0], -bb[1]), 'ICSA', font=f, fill=WHITE + (255,))
    inset = int(tw * 0.03)
    d.rounded_rectangle((inset, th + gap, tw - inset, th + gap + bar), radius=bar // 2, fill=YELLOW + (255,))
    h = round(im.height * width / im.width)
    return im.resize((width, h), Image.LANCZOS)


def on_square(size: int, mark_width: int, bg) -> Image.Image:
    im = Image.new('RGBA', (size, size), bg)
    m = mark(mark_width)
    im.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return im


def main() -> None:
    img = ROOT / 'assets/images'
    # iPhone and the master: 1024, no transparency (the App Store refuses an icon with alpha).
    on_square(1024, 720, BLUE + (255,)).convert('RGB').save(img / 'icon.png')
    # Android adaptive icon, 512: the mark's corners kept inside the safe circle
    # (66 of 108 dp, 61%), whatever shape the phone cuts; blue behind it.
    on_square(512, 250, (0, 0, 0, 0)).save(img / 'android-icon-foreground.png')
    Image.new('RGBA', (512, 512), BLUE + (255,)).save(img / 'android-icon-background.png')
    # Android themed (monochrome) icon: the shape only, in white.
    mono = on_square(432, 212, (0, 0, 0, 0))
    a = mono.getchannel('A')
    Image.merge('RGBA', (a.point(lambda _: 255),) * 3 + (a,)).save(img / 'android-icon-monochrome.png')
    # The launch screen: the mark alone (app.json draws it on ICSA blue).
    mark(456).save(img / 'splash-icon.png')

    store = ROOT / 'store'
    store.mkdir(exist_ok=True)
    # Google Play: the 512 icon (Play rounds it itself) and the 1024 x 500 feature graphic.
    on_square(512, 360, BLUE + (255,)).convert('RGB').save(store / 'play-icon-512.png')
    fg = Image.new('RGB', (1024, 500), BLUE)
    tile = on_square(300, 210, BLUE + (255,))
    shade = Image.new('RGBA', (300, 300), (255, 255, 255, 28))
    mask = Image.new('L', (300, 300), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 299, 299), radius=66, fill=255)
    fg.paste(Image.alpha_composite(tile, shade).convert('RGB'), (90, 100), mask)
    d = ImageDraw.Draw(fg)
    head = ImageFont.truetype(str(NUNITO / '900Black/Nunito_900Black.ttf'), 64)
    body = ImageFont.truetype(str(NUNITO / '600SemiBold/Nunito_600SemiBold.ttf'), 32)
    tag = ImageFont.truetype(str(NUNITO / '800ExtraBold/Nunito_800ExtraBold.ttf'), 30)
    d.text((450, 120), 'ICSA', font=head, fill=WHITE)
    d.text((450, 205), 'Classes, check-in, lessons,', font=body, fill=WHITE)
    d.text((450, 247), 'assignments and fees.', font=body, fill=WHITE)
    d.rounded_rectangle((450, 318, 520, 326), radius=4, fill=YELLOW)
    d.text((450, 340), 'Your Partner in Success', font=tag, fill=YELLOW)
    fg.save(store / 'play-feature-graphic.png')


if __name__ == '__main__':
    main()
