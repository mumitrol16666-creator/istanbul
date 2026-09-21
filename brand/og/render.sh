#!/bin/sh
# Рендерит обложки превью ссылок из card.html в PNG 2400×1260 (headless Chrome), затем ужимает в JPEG 1200×630.
# Запуск: sh brand/og/render.sh        → brand/og/out/og-a.jpg, og-b.jpg, og-c.jpg
cd "$(dirname "$0")" || exit 1
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p out
for v in a b c; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1200,630 \
    --virtual-time-budget=9000 --screenshot="$PWD/out/og-$v.png" "file://$PWD/card.html?$v" >/dev/null 2>&1
  sips -z 630 1200 -s format jpeg -s formatOptions 88 "out/og-$v.png" --out "out/og-$v.jpg" >/dev/null
  echo "og-$v: $(sips -g pixelWidth -g pixelHeight out/og-$v.jpg | awk '/pixel/{printf "%s ", $2}') $(du -k out/og-$v.jpg | cut -f1) KB"
done
