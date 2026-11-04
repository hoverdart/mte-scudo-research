/* Safe flag classifier; caller supplies len readable bytes, or NULL for len=0. */
#include <stddef.h>
static int flags(const unsigned char *buf, size_t len) {
  if (len == 0) return 0;
  if (len < 2) return 1;
  if ((buf[0] & 128) != 0 && (buf[1] & 1) == 0) return 2;
  if ((buf[0] & 3) == 3) return 3;
  return 4;
}
int process_input(const unsigned char *buf, size_t len) {
  return flags(buf, len);
}
