/* Trusted runner: accepts only hexadecimal strings of 0..8 bytes. */
#include <stddef.h>
#include <stdio.h>
#include <string.h>
int process_input(const unsigned char *buf, size_t len);
static int digit(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}
int main(int argc, char **argv) {
  if (argc < 2 || argc > 17) return 2;
  putchar('[');
  for (int test = 1; test < argc; test++) {
    const size_t chars = strlen(argv[test]);
    if (chars > 16 || chars % 2 != 0) return 2;
    unsigned char buffer[8] = {0};
    for (size_t i = 0; i < chars / 2; i++) {
      const int high = digit(argv[test][2 * i]);
      const int low = digit(argv[test][2 * i + 1]);
      if (high < 0 || low < 0) return 2;
      buffer[i] = (unsigned char)(high * 16 + low);
    }
    if (test > 1) putchar(',');
    printf("%d", process_input(chars ? buffer : NULL, chars / 2));
  }
  puts("]");
  return 0;
}
