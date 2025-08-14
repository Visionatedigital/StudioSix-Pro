const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add .wasm to the list of extensions Webpack will resolve
      webpackConfig.resolve.extensions.push('.wasm');
      
      // Fix web-ifc-viewer ESM module resolution issues
      webpackConfig.resolve.extensionAlias = {
        ...webpackConfig.resolve.extensionAlias,
        '.js': ['.js', '.ts'],
        '.mjs': ['.mjs', '.js'],
      };
      
      // Configure module resolution for web-ifc packages
      webpackConfig.resolve.modules = [
        ...webpackConfig.resolve.modules,
        path.resolve(__dirname, 'node_modules')
      ];
      
      // Webpack aliases (if needed for future modules)
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
      };

      // Add Node.js polyfills and fallbacks for browser compatibility
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "fs": false,
        "path": require.resolve("path-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "buffer": require.resolve("buffer"),
        "util": require.resolve("util"),
        "assert": require.resolve("assert"),
        "url": require.resolve("url"),
        "zlib": false,
        "http": false,
        "https": false,
        "net": false,
        "tls": false,
      };

      // Exclude .wasm files from other loaders
      const wasmExtensionRegExp = /\.wasm$/;
      webpackConfig.module.rules.forEach((rule) => {
        (rule.oneOf || []).forEach((oneOf) => {
          if (oneOf.loader && (oneOf.loader.includes('file-loader') || oneOf.loader.includes('url-loader'))) {
            oneOf.exclude = oneOf.exclude || [];
            oneOf.exclude.push(wasmExtensionRegExp);
          }
        });
      });

      // Add a rule to handle .wasm files properly
      webpackConfig.module.rules.push({
        test: wasmExtensionRegExp,
        type: 'asset/resource',
        generator: {
          filename: 'static/wasm/[name].[hash][ext]'
        }
      });

      // Add specific handling for web-ifc WASM files
      webpackConfig.module.rules.push({
        test: /\.wasm$/,
        include: /node_modules\/web-ifc/,
        type: 'asset/resource',
        generator: {
          filename: 'static/wasm/[name][ext]'
        }
      });

      // Ensure experiments are enabled for WebAssembly
      webpackConfig.experiments = {
        ...webpackConfig.experiments,
        asyncWebAssembly: true,
        syncWebAssembly: true,
      };

      console.log('✅ CRACO: WebAssembly support configured for xeokit');
      console.log('✅ CRACO: Node.js polyfills configured for browser compatibility');
      
      return webpackConfig;
    },
  },
  devServer: {
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      // Add middleware to set correct MIME type for WASM files
      devServer.app.use((req, res, next) => {
        if (req.url.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        }
        next();
      });

      return middlewares;
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
}; 