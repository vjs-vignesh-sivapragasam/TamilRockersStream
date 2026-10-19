const fs = require('fs');
const path = require('path');

const patchDirectory = (dir) => {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== '.git') {
      patchDirectory(fullPath);
    } else if (entry.name === 'validate-react-native-version.js') {
      fs.writeFileSync(fullPath, 'process.exit(0);\n');
      console.log('✅ Patched', fullPath);
    } else if (entry.name.endsWith('.podspec')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('assert_minimal_react_native_version')) {
        content = content.replace(/^.*assert_minimal_react_native_version.*$/gm, '# assert_minimal_react_native_version');
        fs.writeFileSync(fullPath, content);
        console.log('✅ Patched', fullPath);
      }
    } else if (entry.name === 'ios-build-native-modules.sh' || entry.name === 'ios-sign-native-modules.sh') {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('CURRENT_NODE_VERSION')) {
        content = content.replace(
          /if\s*\[\s*"\$CURRENT_NODE_VERSION"\s*-ne\s*"\$DESIRED_NODE_VERSION"\s*\];\s*then/g,
          'if false && [ "$CURRENT_NODE_VERSION" -ne "$DESIRED_NODE_VERSION" ]; then'
        );
        fs.writeFileSync(fullPath, content);
        console.log('✅ Patched', fullPath);
      }
    } else if (entry.name === 'build.gradle' && fullPath.includes('nodejs-mobile-react-native')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('nodeVersionStdout.toString().trim() != "${_nodeVersionRequired}"')) {
        content = content.replace(
          'nodeVersionStdout.toString().trim() != "${_nodeVersionRequired}"',
          'false && nodeVersionStdout.toString().trim() != "${_nodeVersionRequired}"'
        );
        fs.writeFileSync(fullPath, content);
        console.log('✅ Patched', fullPath);
      }
    }
  }
};

const nodeModulesDir = path.join(__dirname, '..', 'node_modules');
if (fs.existsSync(nodeModulesDir)) {
  console.log('🔧 Running patch-version-assertions on node_modules...');
  patchDirectory(nodeModulesDir);
}
