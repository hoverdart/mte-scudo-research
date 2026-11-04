/* Valid dav1d data API use only. Logs callbacks; never dereferences freed storage. */
#include <dav1d/data.h>
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
static const char *events[2];
static size_t count;
static void log_event(const uint8_t *data, void *cookie) {
  (void)data;
  assert(count < 2);
  events[count++] = cookie;
}
static void print_events(void) {
  putchar('[');
  for (size_t i = 0; i < count; i++) printf("%s\"%s\"", i ? "," : "", events[i]);
  putchar(']');
}
int main(void) {
  static const uint8_t payload[4] = {1,2,3,4};
  static const uint8_t metadata[1] = {5};
  const char *names[] = {"owned", "wrapped", "metadata", "both"};
  puts("{");
  for (int i = 0; i < 4; i++) {
    Dav1dData data = {0};
    count = 0;
    if (i == 0 || i == 2) assert(dav1d_data_create(&data, 4));
    else assert(dav1d_data_wrap(&data, payload, 4, log_event, "payload") == 0);
    if (i >= 2) assert(dav1d_data_wrap_user_data(&data, metadata, log_event, "metadata") == 0);
    printf("\"%s\":{\"after_setup\":", names[i]); print_events();
    dav1d_data_unref(&data);
    printf(",\"after_unref\":"); print_events();
    const size_t first_count = count;
    dav1d_data_unref(&data);
    assert(count == first_count);
    assert(data.data == NULL && data.sz == 0 && data.m.timestamp == INT64_MIN && data.m.offset == -1);
    printf(",\"after_second_unref\":"); print_events();
    printf(",\"size\":%zu,\"timestamp\":\"%s\",\"offset\":%lld}%s\n", data.sz, data.m.timestamp == INT64_MIN ? "INT64_MIN" : "other", (long long)data.m.offset, i < 3 ? "," : "");
  }
  puts("}");
  return 0;
}
