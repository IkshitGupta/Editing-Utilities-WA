const { withProjectBuildGradle } = require('expo/config-plugins');

// Some libraries compile native code without naming an NDK version, so Gradle would download
// its own default NDK for them. Pointing them at the app's NDK keeps builds to a single NDK.
const MARKER = '// Libraries that do not name an NDK version use the app NDK.';

const SNIPPET = `
${MARKER}
subprojects { subproject ->
  subproject.plugins.withId('com.android.library') {
    subproject.android.ndkVersion = rootProject.ext.ndkVersion
  }
}
`;

function withAppNdkVersion(config) {
  return withProjectBuildGradle(config, (gradle) => {
    if (gradle.modResults.language === 'groovy' && !gradle.modResults.contents.includes(MARKER)) {
      gradle.modResults.contents += SNIPPET;
    }
    return gradle;
  });
}

module.exports = withAppNdkVersion;
