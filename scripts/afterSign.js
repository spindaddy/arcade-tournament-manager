const { execFileSync } = require('child_process');
const path = require('path');

// Ad-hoc sign the whole .app so nested Electron helpers share one signature.
// Skipping signing leaves Electron's inner signatures intact and macOS reports
// the downloaded app as "damaged". A Developer ID is not required for this.
exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  execFileSync('codesign', [
    '--force',
    '--deep',
    '--sign', '-',
    '--timestamp=none',
    appPath,
  ], { stdio: 'inherit' });
};
