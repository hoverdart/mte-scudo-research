/* Defensive execution-path fixture. It has no external dependencies and no
 * memory-unsafe operation; use it to validate tracing and model summaries. */
#include <stddef.h>

static int classify(const unsigned char *buf, size_t len) {
  if (len == 0) return 0;
  if (buf[0] == 'A') return 1;
  if (buf[0] == 'B' && len >= 2 && buf[1] == '!') return 2;
  return 3;
}

int process_input(const unsigned char *buf, size_t len) {
  return classify(buf, len);
}
