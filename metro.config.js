const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Configuration de l'alias @
config.resolver.alias = {
  '@': path.resolve(__dirname),
};

// Assurez-vous que Metro cherche les bons fichiers
config.resolver.sourceExts = [
  'expo.ts',
  'expo.tsx',
  'expo.js',
  'expo.jsx',
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'wasm',
  'svg',
];

// Ajoutez le watchFolders pour être sûr que Metro surveille le bon dossier
config.watchFolders = [path.resolve(__dirname)];

module.exports = config;