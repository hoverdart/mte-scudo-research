/* Fixed UBSan positive control: arithmetic only, no memory corruption or input. */
#include <limits.h>
int main(void) {
  volatile int maximum = INT_MAX;
  volatile int one = 1;
  volatile int result = maximum + one;
  (void)result;
  return 0;
}
