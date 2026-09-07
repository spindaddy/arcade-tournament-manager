const { execFileSync } = require('child_process');
const path = require('path');

// Ad-hoc sign here (afterPack, not afterSign). electron-builder skips afterSign
// when it does not find a Developer ID, which is exactly our unsigned/ad-hoc case.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  console.log(`ad-hoc signing ${appPath}`);
  execFileSync('codesign', [
    '--force',
    '--deep',
    '--sign', '-',
    '--timestamp=none',
    appPath,
  ], { stdio: 'inherit' });

  execFileSync('codesign', ['--verify', '-v', appPath], { stdio: 'inherit' });
};
