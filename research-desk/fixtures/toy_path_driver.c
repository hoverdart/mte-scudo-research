#include <assert.h>
#include <stdio.h>
#include <stddef.h>
int process_input(const unsigned char *buf, size_t len);
int main(void) {
  static const struct { const char *input; size_t len; int expected; } cases[] = {
    {NULL, 0, 0}, {"A", 1, 1}, {"A!", 2, 1}, {"B", 1, 3},
    {"B!", 2, 2}, {"Bx", 2, 3}, {"C", 1, 3}
  };
  for (size_t i = 0; i < sizeof(cases) / sizeof(cases[0]); ++i) {
    int actual = process_input((const unsigned char *)cases[i].input, cases[i].len);
    printf("case=%zu length=%zu expected=%d actual=%d\n", i, cases[i].len, cases[i].expected, actual);
    fflush(stdout);
    assert(actual == cases[i].expected);
  }
  return 0;
}
