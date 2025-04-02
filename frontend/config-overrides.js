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
    return config;
  };