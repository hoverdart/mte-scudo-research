#define _GNU_SOURCE
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#if defined(__linux__)
#include <dlfcn.h>
#include <sys/auxv.h>
#include <sys/prctl.h>
#include <linux/prctl.h>
#include <asm/hwcap.h>
#endif
#if defined(__APPLE__)
static void (*const scudo_stats)(void) = NULL;
#else
extern void __scudo_print_stats(void) __attribute__((weak));
#define scudo_stats __scudo_print_stats
#endif
int main(void) {
#if defined(__linux__)
  Dl_info provider;
  if (dladdr((void *)(uintptr_t)&malloc, &provider) != 0)
    printf("{\"mallocProvider\":\"%s\"}\n", provider.dli_fname);
#endif
#if defined(__APPLE__)
  puts("{\"scudoProbe\":\"not available in this host build; use Linux track\"}");
#else
  printf("{\"scudoStatsSymbol\":%s}\n", scudo_stats ? "true" : "false");
#endif
#if defined(__linux__) && defined(__aarch64__) && defined(HWCAP2_MTE)
  const int advertised = (getauxval(AT_HWCAP2) & HWCAP2_MTE) != 0;
  const long mode = prctl(PR_GET_TAGGED_ADDR_CTRL, 0, 0, 0, 0);
  printf("{\"mteAdvertised\":%s,\"taggedAddressControl\":%ld,\"probe\":\"read-only\"}\n", advertised ? "true" : "false", mode);
#else
  puts("{\"mteProbe\":\"unsupported OS/architecture for Linux userspace query\"}");
#endif
  unsigned char *a = malloc(32);
  unsigned char *b = calloc(16, 1);
  assert(a && b);
  memset(a, 7, 32);
  for (size_t i = 0; i < 16; i++) assert(b[i] == 0);
  puts("{\"event\":\"allocate\",\"ids\":[1,2],\"requestedBytes\":48}");
  unsigned char *grown = realloc(a, 64);
  assert(grown);
  a = grown;
  for (size_t i = 0; i < 32; i++) assert(a[i] == 7);
  memset(a + 32, 9, 32);
  puts("{\"event\":\"resize\",\"id\":1,\"requestedBytes\":64,\"preservedPrefix\":true}");
  if (scudo_stats) scudo_stats();
  free(b); b = NULL;
  free(a); a = NULL;
  puts("{\"event\":\"release\",\"ids\":[2,1],\"liveRequestedBytes\":0}");
  assert(a == NULL && b == NULL);
  if (scudo_stats) scudo_stats();
  return 0;
}
