/* craco.config.js
   Extend CRA webpack to support .jss files as JavaScript modules
*/

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Ensure .jss is a resolvable extension
      if (webpackConfig.resolve && webpackConfig.resolve.extensions) {
        if (!webpackConfig.resolve.extensions.includes(".jss")) {
          webpackConfig.resolve.extensions.push(".jss");
        }
      }

      // Find babel-loader options from existing rule
      const oneOfRule = webpackConfig.module.rules.find((r) => Array.isArray(r.oneOf));
      if (oneOfRule) {
        const babelRule = oneOfRule.oneOf.find(
          (r) => r.loader && r.loader.includes("babel-loader") && r.test && r.test.toString().includes("jsx")
        );

        const babelOptions = babelRule ? babelRule.options : {};

        // Insert our .jss rule before asset/resource fallback
        const assetRuleIndex = oneOfRule.oneOf.findIndex((r) => r.type === "asset/resource");
        const jssRule = {
          test: /\.jss$/,
          include: /src/,
          loader: require.resolve("babel-loader"),
          options: babelOptions,
        };

        if (assetRuleIndex !== -1) {
          oneOfRule.oneOf.splice(assetRuleIndex, 0, jssRule);
        } else {
          oneOfRule.oneOf.push(jssRule);
        }
      }
      return webpackConfig;
    },
  },
};