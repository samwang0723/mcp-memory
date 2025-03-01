const moduleAlias = require('module-alias');
const path = require('path');

// Register the module alias for @/
moduleAlias.addAliases({
  '@': path.resolve(__dirname, 'dist'),
});

// Log successful registration
console.log('Module aliases registered successfully.');
