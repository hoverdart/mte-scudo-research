/* CPU-only known-color raster + ordinary PNG round-trip, no external images. */
#include "include/core/SkBitmap.h"
#include "include/core/SkCanvas.h"
#include "include/core/SkColor.h"
#include "include/core/SkData.h"
#include "include/core/SkPaint.h"
#include "include/core/SkSurface.h"
#include "include/codec/SkPngDecoder.h"
#include "include/encode/SkPngEncoder.h"
#include <cassert>
#include <cstdio>
#include <fstream>
#include <string>
int main(int argc, char **argv) {
  if (argc != 2) return 2;
  for (const auto dimensions : {std::pair{8,8}, std::pair{16,9}, std::pair{32,32}}) {
    const int w = dimensions.first, h = dimensions.second;
    const auto info = SkImageInfo::MakeN32Premul(w, h);
    auto surface = SkSurfaces::Raster(info);
    assert(surface);
    auto *canvas = surface->getCanvas();
    canvas->clear(SK_ColorWHITE);
    SkPaint paint;
    paint.setAntiAlias(false);
    paint.setColor(SK_ColorRED);
    canvas->drawRect(SkRect::MakeWH(w / 2, h), paint);
    canvas->save();
    canvas->clipRect(SkRect::MakeXYWH(w / 2, h / 2, w - w / 2, h - h / 2));
    canvas->drawColor(SK_ColorBLUE);
    canvas->restore();
    SkBitmap raster;
    assert(raster.tryAllocPixels(info));
    assert(surface->readPixels(raster, 0, 0));
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      const SkColor expected = x < w / 2 ? SK_ColorRED : (y >= h / 2 ? SK_ColorBLUE : SK_ColorWHITE);
      assert(raster.getColor(x, y) == expected);
    }
    SkPixmap pixels;
    assert(surface->peekPixels(&pixels));
    auto encoded = SkPngEncoder::Encode(pixels, {});
    assert(encoded && encoded->size() > 0);
    SkCodec::Result status;
    auto codec = SkPngDecoder::Decode(encoded, &status);
    assert(codec && status == SkCodec::kSuccess);
    assert(codec->dimensions().width() == w && codec->dimensions().height() == h);
    SkBitmap decoded;
    assert(decoded.tryAllocPixels(info));
    assert(codec->getPixels(info, decoded.getPixels(), decoded.rowBytes()) == SkCodec::kSuccess);
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) assert(decoded.getColor(x, y) == raster.getColor(x, y));
    std::string path = std::string(argv[1]) + "/raster-" + std::to_string(w) + "x" + std::to_string(h) + ".png";
    std::ofstream file(path, std::ios::binary);
    file.write(static_cast<const char *>(encoded->data()), static_cast<std::streamsize>(encoded->size()));
    assert(file.good());
    std::printf("{\"width\":%d,\"height\":%d,\"pixelsVerified\":%d,\"pngBytes\":%zu,\"roundTrip\":true}\n", w, h, w * h, encoded->size());
  }
  return 0;
}
