module.exports = function override(config) {
    // Отключаем source-map-loader для node_modules
    config.module.rules = config.module.rules.map(rule => {
      if (rule.oneOf) {
        rule.oneOf = rule.oneOf.map(r => {
          if (r.loader && r.loader.includes('source-map-loader')) {
            r.exclude = [/node_modules/]; // Игнорируем source maps в node_modules
          }
          return r;
        });
      }
      return rule;
    });
    
    // React Compiler (babel-plugin-react-compiler)
    if (process.env.DISABLE_REACT_COMPILER !== '1') {
      try {
        const compilerPluginPath = require.resolve('babel-plugin-react-compiler');
        const oneOfRule = config.module.rules.find(r => Array.isArray(r.oneOf));
        if (oneOfRule) {
          oneOfRule.oneOf.forEach(r => {
            const isBabelLoader = r && r.loader && r.loader.includes('babel-loader');
            if (!isBabelLoader) return;
            r.options = r.options || {};
            r.options.plugins = r.options.plugins || [];
            const hasCompiler = r.options.plugins.some(p => {
              const name = Array.isArray(p) ? p[0] : p;
              return typeof name === 'string' && name.includes('babel-plugin-react-compiler');
            });
            if (!hasCompiler) r.options.plugins.push(compilerPluginPath);
          });
        }
      } catch (e) {
        // Плагин не установлен — тихо пропускаем
      }
    }
    return config;
  };