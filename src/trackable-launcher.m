#import <AppKit/AppKit.h>
#include <mach-o/dyld.h>
#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static void showConflictAlert(void) {
  [NSApplication sharedApplication];
  NSAlert *alert = [[NSAlert alloc] init];
  alert.messageText = @"Quit ChatGPT first";
  alert.informativeText = @"ChatGPT Trackable uses your existing ChatGPT profile. Running both apps against that profile at once could damage it.";
  [alert addButtonWithTitle:@"OK"];
  [alert runModal];
}

int main(int argc, char *argv[]) {
  @autoreleasepool {
    NSArray<NSRunningApplication *> *official =
      [NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.openai.codex"];
    if (official.count > 0) {
      showConflictAlert();
      return 2;
    }

    char executablePath[PATH_MAX];
    uint32_t size = sizeof(executablePath);
    if (_NSGetExecutablePath(executablePath, &size) != 0) {
      fprintf(stderr, "Unable to resolve launcher path\n");
      return 1;
    }

    char *lastSlash = strrchr(executablePath, '/');
    if (lastSlash == NULL) return 1;
    *lastSlash = '\0';

    char realPath[PATH_MAX];
    snprintf(realPath, sizeof(realPath), "%s/ChatGPTTrackable.real", executablePath);

    const char *inspectArgument = "--inspect=49281";
    const char *profilePrefix = "--user-data-dir=";
    const char *home = getenv("HOME");
    if (home == NULL) home = "";

    char profileArgument[PATH_MAX];
    snprintf(
      profileArgument,
      sizeof(profileArgument),
      "%s%s/Library/Application Support/Codex",
      profilePrefix,
      home
    );

    char **forwarded = calloc((size_t)argc + 3, sizeof(char *));
    if (forwarded == NULL) return 1;
    forwarded[0] = realPath;
    for (int index = 1; index < argc; index++) forwarded[index] = argv[index];
    forwarded[argc] = (char *)inspectArgument;
    forwarded[argc + 1] = profileArgument;
    forwarded[argc + 2] = NULL;

    execv(realPath, forwarded);
    fprintf(stderr, "Unable to launch ChatGPT Trackable: %s\n", strerror(errno));
    free(forwarded);
    return 1;
  }
}
