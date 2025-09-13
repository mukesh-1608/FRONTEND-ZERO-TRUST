const webpack = require("webpack");
const path = require("path");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        vm: require.resolve("vm-browserify"),
        buffer: require.resolve("buffer/"),
        assert: require.resolve("assert/"),
        util: require.resolve("util/"),
        path: require.resolve("path-browserify"),
        process: path.resolve(__dirname, "node_modules/process/browser.js"), // <- fully specified
      };

      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: ["process/browser"], // this is fine for globals
        })
      );

      return webpackConfig;
    },
  },
};
