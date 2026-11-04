/* Real allocation lifetime, opaque event IDs, no address disclosure or reuse claim. */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
int main(void) {
  unsigned char *buffer = malloc(16);
  if (!buffer) return 1;
  puts("alloc id=1 bytes=16");
  for (size_t i = 0; i < 16; ++i) buffer[i] = (unsigned char)i;
  assert(buffer[0] == 0 && buffer[15] == 15);
  puts("read id=1 index=15 value=15");
  free(buffer);
  buffer = NULL;
  puts("free id=1");
  assert(buffer == NULL);
  puts("cleared id=1; no access after free");
  return 0;
}
