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
    }
  }
};

const nodeModulesDir = path.join(__dirname, '..', 'node_modules');
if (fs.existsSync(nodeModulesDir)) {
  console.log('🔧 Running patch-version-assertions on node_modules...');
  patchDirectory(nodeModulesDir);
}
