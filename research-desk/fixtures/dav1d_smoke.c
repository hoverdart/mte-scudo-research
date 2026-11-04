/* Lifecycle/API contract check on the maintained upstream build; no media input. */
#include <assert.h>
#include <errno.h>
#include <stdio.h>
#include <dav1d/dav1d.h>
int main(void) {
  Dav1dSettings settings;
  Dav1dContext *context = NULL;
  Dav1dPicture picture = {0};
  dav1d_default_settings(&settings);
  settings.n_threads = 1;
  settings.max_frame_delay = 1;
  int result = dav1d_open(&context, &settings);
  assert(result == 0 && context != NULL);
  puts("dav1d_open: success threads=1");
  result = dav1d_get_picture(context, &picture);
  assert(result == DAV1D_ERR(EAGAIN));
  puts("dav1d_get_picture: expected EAGAIN without input");
  dav1d_flush(context);
  puts("dav1d_flush: success");
  dav1d_close(&context);
  assert(context == NULL);
  puts("dav1d_close: context cleared");
  return 0;
}
