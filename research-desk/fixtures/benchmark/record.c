/* Safe bounded record classifier; no writes or external state. */
#include <stddef.h>
static int record_kind(const unsigned char *buf, size_t len) {
  if (len == 0) return 0;
  if (len < 3) return 1;
  const size_t count = buf[0];
  if (count > len - 2) return 2;
  if (buf[1] == 'X' && count == 1) return 3;
  if (count == 0 || buf[len - 1] == 0) return 4;
  return 5;
}
int process_input(const unsigned char *buf, size_t len) {
  return record_kind(buf, len);
}
