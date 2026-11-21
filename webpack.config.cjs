const path = require('node:path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (_env, argv) => {
  const prod = argv.mode === 'production';
  return {
    entry: './src/app.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: prod ? 'assets/[name].[contenthash:8].js' : 'assets/[name].js',
      assetModuleFilename: 'assets/[name].[contenthash:8][ext][query]',
      publicPath: prod ? './' : '/',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [prod ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|webp)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: './src/index.html' }),
      new webpack.DefinePlugin({
        'process.env.WS_URL': JSON.stringify(process.env.WS_URL || ''),
      }),
      ...(prod ? [new MiniCssExtractPlugin({ filename: 'assets/[name].[contenthash:8].css' })] : []),
    ],
    devtool: prod ? false : 'source-map',
    devServer: {
      host: 'localhost',
      port: 8080,
      hot: true,
      open: true,
      historyApiFallback: true,
      client: { overlay: true },
    },
  };
};
